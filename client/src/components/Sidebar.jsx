import { Hash, MessageCircle, Users, Settings, LogOut, Plus, ChevronDown } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export default function Sidebar() {
  const { rooms, onlineUsers, activeRoom, activeDM, joinRoom, openDM } = useChat();
  const { user, logout } = useAuth();
  const [showOnline, setShowOnline] = useState(true);
  const [showRooms, setShowRooms] = useState(true);

  const others = onlineUsers.filter(u => u.userId !== user?.$id);

  return (
    <aside className="w-64 flex flex-col glass border-r border-white/5 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
            <span className="text-white font-display font-bold text-sm">N</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-white">Nexus Chat</h1>
            <p className="text-xs text-slate-500">{others.length + 1} online</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Rooms */}
        <div>
          <button className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1 hover:text-slate-300 transition-colors"
            onClick={() => setShowRooms(v => !v)}>
            <span>Channels</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showRooms ? '' : '-rotate-90'}`} />
          </button>

          {showRooms && rooms.map(room => (
            <button key={room.$id} onClick={() => joinRoom(room)}
              className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 text-left ${activeRoom?.$id === room.$id ? 'active' : ''}`}>
              <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{room.name}</p>
                {room.description && <p className="text-xs text-slate-500 truncate">{room.description}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* Direct Messages */}
        <div>
          <button className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 px-1 hover:text-slate-300 transition-colors"
            onClick={() => setShowOnline(v => !v)}>
            <span>Direct Messages</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showOnline ? '' : '-rotate-90'}`} />
          </button>

          {showOnline && others.map(u => (
            <button key={u.userId} onClick={() => openDM(u)}
              className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 text-left ${activeDM?.userId === u.userId ? 'active' : ''}`}>
              <div className="relative flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  {u.username?.[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 online-dot" />
              </div>
              <span className="text-sm text-slate-200 truncate">{u.username}</span>
            </button>
          ))}

          {others.length === 0 && (
            <p className="text-xs text-slate-600 px-3 py-2">No other users online</p>
          )}
        </div>
      </div>

      {/* Footer / User */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-3 transition-all group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button onClick={logout}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
