import { useChat } from '../contexts/ChatContext';
import { AlertTriangle, X, Shield, CheckCircle } from 'lucide-react';

export default function Overlays() {
  const { trollWarning, privateInfoWarning, notification, setTrollWarning, setPrivateInfoWarning, confirmPrivateInfoSend } = useChat();

  return (
    <>
      {/* Troll Warning */}
      {trollWarning && (
        <div className="fixed bottom-24 right-6 z-50 animate-bounce-in max-w-sm">
          <div className="glass rounded-2xl p-5 border border-amber-500/20 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">💙</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-400 mb-1">A gentle note from Nexus</p>
                <p className="text-sm text-slate-300 leading-relaxed">{trollWarning.message}</p>
              </div>
              <button onClick={() => setTrollWarning(null)} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Info Warning */}
      {privateInfoWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 max-w-md w-full mx-4 animate-bounce-in border border-red-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-white">Security Alert</h3>
                <p className="text-xs text-red-400">{privateInfoWarning.type} detected</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">{privateInfoWarning.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setPrivateInfoWarning(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-surface-3 transition-all">
                Cancel
              </button>
              <button onClick={confirmPrivateInfoSend}
                className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-sm text-red-300 hover:bg-red-500/30 transition-all">
                Send Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in max-w-sm">
          <div className={`glass rounded-2xl px-5 py-4 flex items-center gap-3 border shadow-2xl ${
            notification.type === 'success' ? 'border-green-500/20' :
            notification.type === 'warning' ? 'border-amber-500/20' : 'border-brand-500/20'
          }`}>
            {notification.type === 'success'
              ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
            <p className="text-sm text-slate-200">{notification.message}</p>
          </div>
        </div>
      )}
    </>
  );
}
