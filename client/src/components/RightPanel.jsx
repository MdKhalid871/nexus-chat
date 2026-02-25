import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle } from 'lucide-react';

export default function RightPanel() {
  const { onlineUsers, openDM } = useChat();
  const { user } = useAuth();

  return (
    <aside className="w-56 flex flex-col glass border-l border-white/5 flex-shrink-0">
      <div className="p-4 border-b border-white/5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Online — {onlineUsers.length}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {onlineUsers.map(u => (
          <div key={u.userId}
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-3 transition-all group">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                {u.username?.[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 online-dot" style={{ width: 8, height: 8 }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">
                {u.username} {u.userId === user?.$id && <span className="text-slate-500">(You)</span>}
              </p>
            </div>
            {u.userId !== user?.$id && (
              <button onClick={() => openDM(u)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-brand-400">
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
