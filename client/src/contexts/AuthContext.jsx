import { createContext, useContext, useEffect, useState } from 'react';
import { account, avatars } from '../lib/appwrite';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const session = await account.get();
      const avatarUrl = avatars.getInitials(session.name || 'User', 64, 64).toString();
      const userData = { ...session, avatar: avatarUrl };
      setUser(userData);
      connectSocket({ userId: session.$id, username: session.name, avatar: avatarUrl });
      return userData;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    await account.createEmailPasswordSession(email, password);
    await checkSession();
  }

  async function register(email, password, name) {
    await account.create('unique()', email, password, name);
    await login(email, password);
  }

  /**
   * Google OAuth — Fix for Appwrite v14
   *
   * Uses a dedicated /oauth-callback route as the success URL so the app
   * can explicitly call checkSession() after the redirect returns.
   *
   * You MUST add these URLs to your Appwrite project:
   *   Platform → Web → Hostname: your-vercel-app.vercel.app
   *   OAuth2 → Google → Redirect URLs: https://your-vercel-app.vercel.app/oauth-callback
   *
   * AND in Google Cloud Console → Credentials → OAuth Client:
   *   Authorised redirect URIs: https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/<your-project-id>
   */
  function loginWithGoogle() {
    const origin = window.location.origin;
    account.createOAuth2Session(
      'google',
      `${origin}/oauth-callback`,   // success — our handler calls checkSession
      `${origin}/login`             // failure
    );
  }

  async function logout() {
    try {
      await account.deleteSession('current');
    } catch { /* already expired */ }
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithGoogle, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);