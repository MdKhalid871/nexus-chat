import { useRef, useState } from 'react';
import { Send, Paperclip, Image, X, FileText, AlertCircle } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function MessageInput({ onSend, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // image preview URL
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const imageRef = useRef();
  const fileRef = useRef();
  const { emitTypingStart, emitTypingStop, muted } = useChat();
  const typingTimer = useRef(null);

  function handleInput(e) {
    setText(e.target.value);
    emitTypingStart();
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(emitTypingStop, 2000);
  }

  function onFileChange(e, type) {
    const selected = e.target.files[0];
    if (!selected) return;

    // Check file size (50MB limit)
    if (selected.size > 50 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 50MB.');
      return;
    }

    setUploadError('');
    setFile(selected);

    // If image, create preview
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }

    // Reset input so same file can be picked again
    e.target.value = '';
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    setUploadError('');
  }

  async function handleSend() {
    if ((!text.trim() && !file) || muted || uploading) return;
    setUploadError('');

    let fileData = null;

    if (file) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('file', file);

        const res = await fetch(`${SERVER}/upload`, {
          method: 'POST',
          body: fd,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        console.log('✅ Upload success:', data);

        fileData = {
          fileUrl: data.url,
          fileName: data.name,
          fileType: data.mimetype,
        };
      } catch (err) {
        console.error('❌ Upload error:', err);
        setUploadError(`Upload failed: ${err.message}. Is the server running?`);
        setUploading(false);
        return; // Don't send if upload failed
      }
      setUploading(false);
    }

    // Send message with or without file
    onSend(text.trim() || null, fileData);
    setText('');
    setFile(null);
    setPreview(null);
    emitTypingStop();
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isImage = file?.type?.startsWith('image/');

  return (
    <div className="p-4 border-t border-white/5">

      {/* File Preview */}
      {file && (
        <div className="mb-3 relative">
          {isImage && preview ? (
            // Image preview
            <div className="relative inline-block">
              <img
                src={preview}
                alt="preview"
                className="max-h-40 max-w-xs rounded-xl border border-white/10 object-cover"
              />
              <button
                onClick={removeFile}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            // File preview
            <div className="flex items-center gap-3 bg-surface-3 border border-white/5 rounded-xl px-4 py-3 max-w-xs">
              <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={removeFile} className="text-slate-500 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{uploadError}</p>
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 bg-surface-3 border border-white/5 rounded-2xl flex items-end gap-2 px-4 py-2.5 focus-within:border-brand-500/40 transition-all">
          <textarea
            value={text}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder={muted ? '🤫 You are temporarily muted…' : placeholder}
            disabled={muted}
            rows={1}
            style={{ resize: 'none', maxHeight: 120, minHeight: 24 }}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none leading-relaxed disabled:opacity-40"
          />

          {/* Attachment buttons */}
          <div className="flex items-center gap-1 pb-0.5 flex-shrink-0">
            {/* Image picker */}
            <button
              type="button"
              onClick={() => imageRef.current.click()}
              title="Send image"
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all"
            >
              <Image className="w-4 h-4" />
            </button>

            {/* Any file picker */}
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              title="Send file"
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-400 hover:bg-brand-500/10 transition-all"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!text.trim() && !file) || uploading || muted}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        >
          {uploading
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <Send className="w-4 h-4 text-white" />
          }
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileChange(e, 'image')}
      />
      <input
        ref={fileRef}
        type="file"
        accept="*"
        className="hidden"
        onChange={(e) => onFileChange(e, 'file')}
      />
    </div>
  );
}