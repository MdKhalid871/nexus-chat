import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  const [messages, setMessages] = useState({}); // roomId/userId -> messages[]
  const [dmMessages, setDmMessages] = useState({}); // toUserId -> messages[]
  const [typingUsers, setTypingUsers] = useState({}); // roomId -> Set of usernames
  const [trollWarning, setTrollWarning] = useState(null);
  const [privateInfoWarning, setPrivateInfoWarning] = useState(null);
  const [notification, setNotification] = useState(null);
  const [muted, setMuted] = useState(false);
  const typingTimerRef = useRef({});

  useEffect(() => {
    if (!user) return;
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
      const res = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/rooms`);
      const data = await res.json();
      setRooms(data);
      if (data.length > 0 && !activeRoom) {
        joinRoom(data[0]);
      }
    } catch { }
  }

  function joinRoom(room) {
    const socket = getSocket();
    if (activeRoom) socket.emit('leave_room', { roomId: activeRoom.$id });
    setActiveRoom(room);
    setActiveDM(null);
    socket.emit('join_room', { roomId: room.$id });
    // Load history
    fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/messages/${room.$id}`)
      .then(r => r.json())
      .then(msgs => setMessages(prev => ({ ...prev, [room.$id]: msgs })))
      .catch(() => { });
  }

  function openDM(targetUser) {
    setActiveDM(targetUser);
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
    setMessages(prev => ({ ...prev, [msg.roomId]: [...(prev[msg.roomId] || []), sysMsg] }));
  }

  function handleTyping({ userId, username, roomId, isDM }) {
    if (userId === user?.$id) return;
    if (roomId) {
      setTypingUsers(prev => ({
        ...prev,
        [roomId]: new Set([...(prev[roomId] || []), username])
      }));
    }
  }

  function handleStopTyping({ userId, username, roomId, isDM }) {
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
    if (!activeRoom || muted) return;
    const socket = getSocket();
    socket.emit('room_message', {
      roomId: activeRoom.$id,
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
    if (activeRoom) socket.emit('typing_start', { roomId: activeRoom.$id });
    else if (activeDM) socket.emit('typing_start', { toUserId: activeDM.$id || activeDM.userId });
  }

  function emitTypingStop() {
    const socket = getSocket();
    if (activeRoom) socket.emit('typing_stop', { roomId: activeRoom.$id });
    else if (activeDM) socket.emit('typing_stop', { toUserId: activeDM.$id || activeDM.userId });
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
