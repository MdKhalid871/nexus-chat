import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare } from 'lucide-react';

/**
 * OAuthCallback page
 * After Google OAuth redirects back here, we call checkSession() which picks
 * up the session Appwrite created and logs the user in.
 */
export default function OAuthCallback() {
  const { checkSession } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Completing sign in…');

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const userData = await checkSession();
        if (cancelled) return;
        if (userData) {
          setStatus('Signed in! Redirecting…');
          setTimeout(() => navigate('/'), 500);
        } else {
          setStatus('Sign in failed. Redirecting to login…');
          setTimeout(() => navigate('/login'), 1500);
        }
      } catch {
        if (!cancelled) {
          setStatus('Something went wrong. Redirecting to login…');
          setTimeout(() => navigate('/login'), 1500);
        }
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mesh-bg min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2"
          style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
        >
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display text-xl font-bold gradient-text">Nexus Chat</h2>
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-brand-500/40 border-t-brand-500 rounded-full animate-spin" />
          {status}
        </div>
      </div>
    </div>
  );
}