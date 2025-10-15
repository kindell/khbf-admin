import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthSession {
  memberId: string;
  memberName: string;
  phoneNumber: string;
}

interface AuthContextType {
  session: AuthSession | null;
  loading: boolean;
  login: (memberId: string, memberName: string, phoneNumber: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'khbf_admin_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  function login(memberId: string, memberName: string, phoneNumber: string) {
    const newSession = { memberId, memberName, phoneNumber };
    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
  }

  function logout() {
    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
