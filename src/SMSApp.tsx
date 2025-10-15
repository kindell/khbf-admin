import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SMSLogin } from './SMSLogin';
import { SMSInbox } from './SMSInbox';
import { SMSThread } from './SMSThread';

const SESSION_STORAGE_KEY = 'khbf_sms_admin_session';

export function SMSApp() {
  const [adminSession, setAdminSession] = useState<{
    memberId: string;
    memberName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setAdminSession(session);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  function handleLogin(memberId: string, memberName: string) {
    const session = { memberId, memberName };
    setAdminSession(session);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  function handleLogout() {
    setAdminSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  // Show loading state while checking for saved session
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Laddar...</p>
      </div>
    );
  }

  // Not logged in - show login screen
  if (!adminSession) {
    return <SMSLogin onLoginSuccess={handleLogin} />;
  }

  // Logged in - show SMS app
  return (
    <Routes>
      <Route
        path="/"
        element={
          <SMSInbox
            adminMemberId={adminSession.memberId}
            adminMemberName={adminSession.memberName}
            onLogout={handleLogout}
          />
        }
      />
      <Route path="/:threadId" element={<SMSThread />} />
    </Routes>
  );
}
