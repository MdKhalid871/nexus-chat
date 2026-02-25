import { format } from 'date-fns';
import { FileText, Download, Image } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Message({ msg }) {
  const { user } = useAuth();
  const isOwn = msg.senderId === user?.$id;

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-500 bg-surface-3 px-3 py-1 rounded-full">{msg.text}</span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 msg-appear ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
          {msg.senderAvatar
            ? <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
            : msg.senderName?.[0]?.toUpperCase()}
        </div>
      </div>

      <div className={`max-w-[70%] flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-baseline gap-2">
          {!isOwn && <span className="text-xs font-semibold text-brand-400">{msg.senderName}</span>}
          <span className="text-xs text-slate-500">
            {format(new Date(msg.timestamp || Date.now()), 'h:mm a')}
          </span>
        </div>

        {/* Bubble */}
        {msg.type === 'image' && msg.fileUrl ? (
          <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'border-brand-500/20' : 'border-white/5'}`}>
            <img src={msg.fileUrl} alt={msg.fileName || 'Image'} className="max-w-xs max-h-60 object-cover" />
            {msg.text && (
              <div className={`px-3 py-2 text-sm ${isOwn ? 'bg-brand-600/80 text-white' : 'bg-surface-3 text-slate-200'}`}>
                {msg.text}
              </div>
            )}
          </div>
        ) : msg.type === 'file' && msg.fileUrl ? (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl ${isOwn ? 'bg-brand-600/80' : 'bg-surface-3'}`}>
            <FileText className="w-5 h-5 text-brand-300 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{msg.fileName}</p>
              <p className="text-xs text-slate-400">File attachment</p>
            </div>
            <a href={msg.fileUrl} download={msg.fileName} className="ml-2 text-slate-400 hover:text-white transition-colors">
              <Download className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn
            ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-sm'
            : 'bg-surface-3 text-slate-200 rounded-tl-sm border border-white/5'
            }`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}
