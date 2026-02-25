import { format } from 'date-fns';
import { FileText, Download, Video, File } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Message({ msg }) {
  const { user } = useAuth();
  const isOwn = msg.senderId === user?.$id;

  // System message
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-500 bg-surface-3 px-3 py-1 rounded-full">
          {msg.text}
        </span>
      </div>
    );
  }

  // Determine what type of content to render
  const hasFile = !!msg.fileUrl;
  const isImage = msg.type === 'image' || msg.fileType?.startsWith('image/');
  const isVideo = msg.type === 'video' || msg.fileType?.startsWith('video/');
  const isFile = hasFile && !isImage && !isVideo;

  return (
    <div className={`flex gap-3 msg-appear ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-3`}>

      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
          {msg.senderAvatar ? (
            <img
              src={msg.senderAvatar}
              alt={msg.senderName}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            msg.senderName?.[0]?.toUpperCase()
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`max-w-[70%] flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>

        {/* Name + Time */}
        <div className={`flex items-baseline gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {!isOwn && (
            <span className="text-xs font-semibold text-brand-400">{msg.senderName}</span>
          )}
          <span className="text-xs text-slate-500">
            {msg.timestamp ? format(new Date(msg.timestamp), 'h:mm a') : ''}
          </span>
        </div>

        {/* Image */}
        {isImage && msg.fileUrl && (
          <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'border-brand-500/20' : 'border-white/5'}`}>
            <img
              src={msg.fileUrl}
              alt={msg.fileName || 'Image'}
              className="max-w-xs max-h-64 object-cover block"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
              }}
            />
            {/* Fallback if image fails to load */}
            <div className="hidden items-center gap-2 px-4 py-3 bg-surface-3 text-sm text-slate-400">
              <FileText className="w-4 h-4" />
              <span>{msg.fileName || 'Image'}</span>
            </div>
            {/* Caption if text + image */}
            {msg.text && (
              <div className={`px-3 py-2 text-sm ${isOwn ? 'bg-brand-600/80 text-white' : 'bg-surface-3 text-slate-200'}`}>
                {msg.text}
              </div>
            )}
          </div>
        )}

        {/* Video */}
        {isVideo && msg.fileUrl && (
          <div className={`rounded-2xl overflow-hidden border ${isOwn ? 'border-brand-500/20' : 'border-white/5'}`}>
            <video
              src={msg.fileUrl}
              controls
              className="max-w-xs max-h-64 block"
            />
          </div>
        )}

        {/* File Attachment */}
        {isFile && msg.fileUrl && (
          <a
            href={msg.fileUrl}
            download={msg.fileName}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:opacity-80 ${
              isOwn ? 'bg-brand-600/80' : 'bg-surface-3 border border-white/5'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-brand-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-medium truncate">{msg.fileName || 'File'}</p>
              <p className="text-xs text-slate-400">{msg.fileType || 'Attachment'}</p>
            </div>
            <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </a>
        )}

        {/* Plain text (only if no file, or file has caption) */}
        {msg.text && !hasFile && (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
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