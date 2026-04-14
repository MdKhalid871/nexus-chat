import { useEffect, useRef } from 'react';
import { Hash, MessageCircle, Users } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import Message from './Message';
import MessageInput from './MessageInput';

export default function ChatArea() {
  const { activeRoom, activeDM, messages, dmMessages, typingUsers, sendRoomMessage, sendDM, onlineUsers } = useChat();
  const { user } = useAuth();
  const bottomRef = useRef();

  const roomMsgs = activeRoom ? (messages[activeRoom.$id] || []) : [];
  const dmMsgs = activeDM ? (dmMessages[activeDM.userId || activeDM.$id] || []) : [];
  const displayMsgs = activeRoom ? roomMsgs : dmMsgs;

  const typingInRoom = activeRoom ? Array.from(typingUsers[activeRoom.$id] || []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMsgs.length]);

  if (!activeRoom && !activeDM) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4 chat-bg">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center shadow-sm">
          <MessageCircle className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-400 text-sm">Select a channel or start a DM</p>
      </div>
    );
  }

  const title = activeRoom ? activeRoom.name : (activeDM?.name || activeDM?.username);
  const subtitle = activeRoom
    ? (activeRoom.description || `#${activeRoom.name}`)
    : `Direct message with ${activeDM?.name || activeDM?.username}`;
  const isOnline = activeDM ? onlineUsers.some(u => u.userId === (activeDM.userId || activeDM.$id)) : false;

  return (
    <div className="flex-1 flex flex-col min-w-0 chat-bg">

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          activeRoom ? 'bg-sky-50' : 'bg-violet-50'
        }`}>
          {activeRoom
            ? <Hash className="w-5 h-5 text-sky-500" />
            : (
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  {(activeDM?.name || activeDM?.username)?.[0]?.toUpperCase()}
                </div>
                {isOnline && <div className="absolute -bottom-0.5 -right-0.5 online-dot scale-75" />}
              </div>
            )
          }
        </div>
        <div>
          <h2 className="font-display font-semibold text-slate-800 text-sm">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        {activeRoom && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
            <Users className="w-3.5 h-3.5" />
            <span>Channel</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {displayMsgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              {activeRoom ? <Hash className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </div>
            <p className="text-sm">No messages yet. Be the first to say something!</p>
          </div>
        )}

        {displayMsgs.map((msg, i) => (
          <Message key={msg.id || i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {typingInRoom.length > 0 && (
          <div className="flex items-center gap-2 pl-2">
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
            <span className="text-xs text-slate-400">
              {typingInRoom.join(', ')} {typingInRoom.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={activeRoom ? sendRoomMessage : sendDM}
        placeholder={activeRoom ? `Message #${activeRoom.name}` : `Message ${activeDM?.name || activeDM?.username}`}
      />
    </div>
  );
}