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
      const avatarUrl = avatars.getInitials(session.name, 64, 64).toString();
      const userData = { ...session, avatar: avatarUrl };
      setUser(userData);
      connectSocket({ userId: session.$id, username: session.name, avatar: avatarUrl });
    } catch {
      setUser(null);
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

  async function loginWithGoogle() {
    account.createOAuth2Session('google', `${window.location.origin}/`, `${window.location.origin}/login`);
  }

  async function logout() {
    await account.deleteSession('current');
    disconnectSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
