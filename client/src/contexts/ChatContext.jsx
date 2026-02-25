import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

const FALLBACK_ROOMS = [
  { $id: 'general', name: 'General', description: 'General chat for everyone', isPrivate: false },
  { $id: 'random', name: 'Random', description: 'Off-topic discussions', isPrivate: false },
  { $id: 'tech', name: 'Tech Talk', description: 'All things technology', isPrivate: false },
];

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState(FALLBACK_ROOMS);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  const [messages, setMessages] = useState({});
  const [dmMessages, setDmMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [trollWarning, setTrollWarning] = useState(null);
  const [privateInfoWarning, setPrivateInfoWarning] = useState(null);
  const [notification, setNotification] = useState(null);
  const [muted, setMuted] = useState(false);
  const activeRoomRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    if (!activeRoomRef.current) {
      joinRoom(FALLBACK_ROOMS[0]);
    }

    fetchRooms();

    const socket = getSocket();

    socket.on('online_users', setOnlineUsers);
    socket.on('room_message', handleRoomMessage);
    socket.on('direct_message', handleDMMessage);
    socket.on('system_message', handleSystemMessage);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('troll_warning', handleTrollWarning);
    socket.on('private_info_warning', handlePrivateInfoWarning);
    socket.on('muted', ({ message }) => { setMuted(true); showNotification(message, 'warning'); });
    socket.on('unmuted', ({ message }) => { setMuted(false); showNotification(message, 'success'); });
    socket.on('trigger_room_message', (data) => socket.emit('room_message', data));

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
    };
  }, [user]);

  async function fetchRooms() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/rooms`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setRooms(data);
        }
      }
    } catch {
      console.log('Server unreachable — using fallback rooms');
    }
  }

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

    const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    fetch(`${SERVER}/messages/${roomId}`)
      .then(r => r.json())
      .then(msgs => {
        if (Array.isArray(msgs)) {
          setMessages(prev => ({ ...prev, [roomId]: msgs }));
        }
      })
      .catch(() => { });
  }

  function openDM(targetUser) {
    setActiveDM(targetUser);
    activeRoomRef.current = null;
    setActiveRoom(null);
  }

  function handleRoomMessage(msg) {
    setMessages(prev => ({
      ...prev,
      [msg.roomId]: [...(prev[msg.roomId] || []), msg]
    }));
  }

  function handleDMMessage(msg) {
    const key = msg.senderId === user?.$id ? msg.toUserId : msg.senderId;
    setDmMessages(prev => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
  }

  function handleSystemMessage(msg) {
    const sysMsg = { ...msg, id: Date.now(), type: 'system', text: msg.text };
    setMessages(prev => ({
      ...prev,
      [msg.roomId]: [...(prev[msg.roomId] || []), sysMsg]
    }));
  }

  function handleTyping({ userId, username, roomId }) {
    if (userId === user?.$id) return;
    if (roomId) {
      setTypingUsers(prev => ({
        ...prev,
        [roomId]: new Set([...(prev[roomId] || []), username])
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

  function showNotification(message, type = 'info') {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }

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

  return (
    <ChatContext.Provider value={{
      onlineUsers, rooms, activeRoom, activeDM, messages, dmMessages,
      typingUsers, trollWarning, privateInfoWarning, notification, muted,
      joinRoom, openDM, sendRoomMessage, sendDM,
      emitTypingStart, emitTypingStop, setTrollWarning, setPrivateInfoWarning,
      confirmPrivateInfoSend, showNotification
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);