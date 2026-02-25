import { useRef, useState } from 'react';
import { Send, Paperclip, Image, X } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function MessageInput({ onSend, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const { emitTypingStart, emitTypingStop, muted } = useChat();
  const typingTimer = useRef(null);

  function handleInput(e) {
    setText(e.target.value);
    emitTypingStart();
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(emitTypingStop, 2000);
  }

  async function handleSend() {
    if ((!text.trim() && !file) || muted) return;
    let fileData = null;

    if (file) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${SERVER}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        fileData = { fileUrl: data.url, fileName: data.name, fileType: data.mimetype };
      } catch { }
      setUploading(false);
    }

    onSend(text.trim() || null, fileData);
    setText('');
    setFile(null);
    emitTypingStop();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function pickFile(accept) {
    fileRef.current.accept = accept;
    fileRef.current.click();
  }

  function onFileChange(e) {
    if (e.target.files[0]) setFile(e.target.files[0]);
  }

  return (
    <div className="p-4 border-t border-white/5">
      {file && (
        <div className="mb-2 flex items-center gap-2 bg-surface-3 rounded-xl px-3 py-2">
          <Image className="w-4 h-4 text-brand-400" />
          <span className="text-xs text-slate-300 flex-1 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 bg-surface-3 border border-white/5 rounded-2xl flex items-end gap-2 px-4 py-2.5 focus-within:border-brand-500/40 transition-all">
          <textarea
            value={text}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder={muted ? '🤫 You are temporarily muted…' : placeholder}
            disabled={muted}
            rows={1}
            style={{ resize: 'none', maxHeight: 120 }}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none leading-relaxed disabled:opacity-40"
          />
          <div className="flex items-center gap-1 pb-0.5">
            <button onClick={() => pickFile('image/*')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all">
              <Image className="w-4 h-4" />
            </button>
            <button onClick={() => pickFile('*')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all">
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button onClick={handleSend} disabled={(!text.trim() && !file) || uploading || muted}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
          {uploading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send className="w-4 h-4 text-white" />}
        </button>
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
    </div>
  );
}
