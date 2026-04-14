import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

const SERVER = () => import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// ── Only General as default ───────────────────────────────────────────────────
const FALLBACK_ROOMS = [
  { $id: 'general', name: 'General', description: 'General chat for everyone', isPrivate: false },
];

// ── localStorage helpers (keyed per user so different users don't clash) ──────
function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function ChatProvider({ children }) {
  const { user } = useAuth();

  const [onlineUsers,        setOnlineUsers]        = useState([]);
  const [rooms,               setRooms]               = useState(FALLBACK_ROOMS);
  const [activeRoom,          setActiveRoom]          = useState(null);
  const [activeDM,            setActiveDM]            = useState(null);
  const [messages,            setMessages]            = useState({});
  const [dmMessages,          setDmMessages]          = useState({});
  const [typingUsers,         setTypingUsers]         = useState({});
  const [trollWarning,        setTrollWarning]        = useState(null);
  const [privateInfoWarning,  setPrivateInfoWarning]  = useState(null);
  const [notification,        setNotification]        = useState(null);
  const [muted,               setMuted]               = useState(false);

  // Private groups the user has joined — persisted to localStorage per user
  const [joinedGroups, setJoinedGroups] = useState([]);

  // DM contacts the user has opened — persisted to localStorage per user
  const [dmContacts, setDmContacts] = useState([]);

  const activeRoomRef = useRef(null);

  // ── Load persisted data once user is known ───────────────────────────────────
  useEffect(() => {
    if (!user?.$id) return;

    const savedGroups = lsGet(`nexus_joined_groups_${user.$id}`, []);
    const savedContacts = lsGet(`nexus_dm_contacts_${user.$id}`, []);
    setJoinedGroups(savedGroups);
    setDmContacts(savedContacts);
  }, [user?.$id]);

  // ── Persist joinedGroups whenever it changes ──────────────────────────────────
  useEffect(() => {
    if (!user?.$id) return;
    lsSet(`nexus_joined_groups_${user.$id}`, joinedGroups);
  }, [joinedGroups, user?.$id]);

  // ── Persist dmContacts whenever it changes ────────────────────────────────────
  useEffect(() => {
    if (!user?.$id) return;
    lsSet(`nexus_dm_contacts_${user.$id}`, dmContacts);
  }, [dmContacts, user?.$id]);

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (!activeRoomRef.current) joinRoom(FALLBACK_ROOMS[0]);

    fetchRooms();

    const socket = getSocket();

    socket.on('online_users',         setOnlineUsers);
    socket.on('room_message',         handleRoomMessage);
    socket.on('direct_message',       handleDMMessage);
    socket.on('system_message',       handleSystemMessage);
    socket.on('typing',               handleTyping);
    socket.on('stop_typing',          handleStopTyping);
    socket.on('troll_warning',        handleTrollWarning);
    socket.on('private_info_warning', handlePrivateInfoWarning);
    socket.on('muted',   ({ message }) => { setMuted(true);  showNotification(message, 'warning'); });
    socket.on('unmuted', ({ message }) => { setMuted(false); showNotification(message, 'success'); });
    socket.on('trigger_room_message', (data) => socket.emit('room_message', data));

    // ── New public room broadcast (so all users see newly created public channels)
    socket.on('new_public_room', (room) => {
      setRooms(prev => {
        if (prev.find(r => r.$id === room.$id)) return prev;
        return [...prev, room];
      });
    });

    return () => {
      socket.off('online_users');
      socket.off('room_message');
      socket.off('direct_message');
      socket.off('system_message');
      socket.off('typing');
      socket.off('stop_typing');
      socket.off('troll_warning');
      socket.off('private_info_warning');
      socket.off('muted');
      socket.off('unmuted');
      socket.off('trigger_room_message');
      socket.off('new_public_room');
    };
  }, [user]);

  // ── Fetch public rooms ────────────────────────────────────────────────────────
  async function fetchRooms() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${SERVER()}/rooms`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setRooms(data);
      }
    } catch {
      console.log('Server unreachable — using fallback rooms');
    }
  }

  // ── User search (for DMs) ─────────────────────────────────────────────────────
  async function searchUsers(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const res = await fetch(`${SERVER()}/users/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter(u => u.$id !== user?.$id);
    } catch {
      return [];
    }
  }

  // ── DM Contacts management ────────────────────────────────────────────────────
  function addDMContact(targetUser) {
    const id = targetUser.$id || targetUser.userId;
    setDmContacts(prev => {
      if (prev.find(c => (c.$id || c.userId) === id)) return prev;
      return [...prev, { ...targetUser, $id: id, userId: id }];
    });
  }

  function removeDMContact(userId) {
    setDmContacts(prev => prev.filter(c => (c.$id || c.userId) !== userId));
    // If the removed contact is active, clear the DM view
    setActiveDM(prev => {
      if (prev && (prev.$id === userId || prev.userId === userId)) return null;
      return prev;
    });
  }

  // ── Group creation ────────────────────────────────────────────────────────────
  async function createGroup(name, description, isPrivate) {
    const res = await fetch(`${SERVER()}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, isPrivate, creatorId: user?.$id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create group');
    }
    const group = await res.json();

    if (!isPrivate) {
      // Public room — server will broadcast to all via socket; add locally too
      setRooms(prev => {
        if (prev.find(r => r.$id === group.$id)) return prev;
        return [...prev, group];
      });
    } else {
      // Private group — save to this user's persisted joinedGroups
      setJoinedGroups(prev => {
        if (prev.find(g => g.$id === group.$id)) return prev;
        return [...prev, group];
      });
    }

    return group;
  }

  // ── Join private group via invite code ────────────────────────────────────────
  async function joinGroupByCode(inviteCode) {
    const res = await fetch(`${SERVER()}/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Invalid invite code');
    }
    const group = await res.json();
    setJoinedGroups(prev => {
      if (prev.find(g => g.$id === group.$id)) return prev;
      return [...prev, group];
    });
    joinRoom(group);
    return group;
  }

  // ── Join a room ───────────────────────────────────────────────────────────────
  function joinRoom(room) {
    const socket = getSocket();
    const roomId = room.$id || room.id;
    const normalizedRoom = { ...room, $id: roomId };

    if (activeRoomRef.current) {
      socket.emit('leave_room', { roomId: activeRoomRef.current.$id });
    }

    activeRoomRef.current = normalizedRoom;
    setActiveRoom(normalizedRoom);
    setActiveDM(null);
    socket.emit('join_room', { roomId });

    // Save public channel to user's joined channels if not already there
    if (!normalizedRoom.isPrivate) {
      setJoinedGroups(prev => {
        // public rooms are in `rooms` list, no need to duplicate into joinedGroups
        return prev;
      });
    }

    // Fetch persisted room history
    fetch(`${SERVER()}/messages/${roomId}`)
      .then(r => r.json())
      .then(msgs => {
        if (Array.isArray(msgs)) {
          setMessages(prev => ({ ...prev, [roomId]: msgs }));
        }
      })
      .catch(() => {});
  }

  // ── Open a DM — also fetches offline history ──────────────────────────────────
  function openDM(targetUser) {
    const targetId = targetUser.$id || targetUser.userId;
    const contact = { ...targetUser, $id: targetId, userId: targetId };
    setActiveDM(contact);
    activeRoomRef.current = null;
    setActiveRoom(null);

    // Persist this contact
    addDMContact(contact);

    if (user?.$id && targetId) {
      fetch(`${SERVER()}/dms/${user.$id}/${targetId}`)
        .then(r => r.json())
        .then(msgs => {
          if (Array.isArray(msgs)) {
            const normalised = msgs.map(m => ({
              id: m.$id,
              type: m.fileType?.startsWith('image/') ? 'image'
                  : m.fileType?.startsWith('video/') ? 'video'
                  : m.fileUrl ? 'file' : 'text',
              senderId:    m.senderId,
              senderName:  m.senderName,
              senderAvatar: m.senderAvatar || '',
              toUserId:    m.recipientId,
              text:        m.text || null,
              fileUrl:     m.fileUrl || null,
              fileName:    m.fileName || null,
              fileType:    m.fileType || null,
              timestamp:   m.timestamp || m.$createdAt,
              isDM: true,
            }));
            setDmMessages(prev => ({ ...prev, [targetId]: normalised }));
          }
        })
        .catch(() => {});
    }
  }

  // ── Message handlers ──────────────────────────────────────────────────────────
  function handleRoomMessage(msg) {
    setMessages(prev => ({
      ...prev,
      [msg.roomId]: [...(prev[msg.roomId] || []), msg],
    }));
  }

  function handleDMMessage(msg) {
    const key = msg.senderId === user?.$id ? msg.toUserId : msg.senderId;
    setDmMessages(prev => {
      const existing = prev[key] || [];
      if (existing.find(m => m.id === msg.id)) return prev;
      return { ...prev, [key]: [...existing, msg] };
    });
  }

  function handleSystemMessage(msg) {
    const sysMsg = { ...msg, id: Date.now() + Math.random(), type: 'system' };
    setMessages(prev => ({
      ...prev,
      [msg.roomId]: [...(prev[msg.roomId] || []), sysMsg],
    }));
  }

  function handleTyping({ userId, username, roomId }) {
    if (userId === user?.$id) return;
    if (roomId) {
      setTypingUsers(prev => ({
        ...prev,
        [roomId]: new Set([...(prev[roomId] || []), username]),
      }));
    }
  }

  function handleStopTyping({ username, roomId }) {
    if (roomId) {
      setTypingUsers(prev => {
        const set = new Set(prev[roomId] || []);
        set.delete(username);
        return { ...prev, [roomId]: set };
      });
    }
  }

  function handleTrollWarning({ message, severity }) {
    setTrollWarning({ message, severity });
    setTimeout(() => setTrollWarning(null), 8000);
  }

  function handlePrivateInfoWarning(data) {
    setPrivateInfoWarning(data);
  }

  // ── Send helpers ──────────────────────────────────────────────────────────────
  function sendRoomMessage(text, fileData = null) {
    if (!activeRoomRef.current || muted) return;
    const socket = getSocket();
    socket.emit('room_message', {
      roomId: activeRoomRef.current.$id,
      text: text || null,
      ...(fileData || {}),
    });
    emitTypingStop();
  }

  function sendDM(text, fileData = null) {
    if (!activeDM) return;
    const socket = getSocket();
    socket.emit('direct_message', {
      toUserId: activeDM.$id || activeDM.userId,
      text: text || null,
      ...(fileData || {}),
    });
  }

  function emitTypingStart() {
    const socket = getSocket();
    if (activeRoomRef.current) {
      socket.emit('typing_start', { roomId: activeRoomRef.current.$id });
    } else if (activeDM) {
      socket.emit('typing_start', { toUserId: activeDM.$id || activeDM.userId });
    }
  }

  function emitTypingStop() {
    const socket = getSocket();
    if (activeRoomRef.current) {
      socket.emit('typing_stop', { roomId: activeRoomRef.current.$id });
    } else if (activeDM) {
      socket.emit('typing_stop', { toUserId: activeDM.$id || activeDM.userId });
    }
  }

  function confirmPrivateInfoSend() {
    if (!privateInfoWarning) return;
    const socket = getSocket();
    socket.emit('room_message', { ...privateInfoWarning.pendingMessage, confirmed: true });
    setPrivateInfoWarning(null);
  }

  function showNotification(message, type = 'info') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }

  return (
    <ChatContext.Provider value={{
      onlineUsers, rooms, joinedGroups, activeRoom, activeDM,
      messages, dmMessages, typingUsers,
      trollWarning, privateInfoWarning, notification, muted,
      dmContacts,
      // actions
      joinRoom, openDM, sendRoomMessage, sendDM,
      emitTypingStart, emitTypingStop,
      setTrollWarning, setPrivateInfoWarning,
      confirmPrivateInfoSend, showNotification,
      searchUsers, createGroup, joinGroupByCode,
      fetchRooms, addDMContact, removeDMContact,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);