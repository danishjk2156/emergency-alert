import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api';

const AuthContext = createContext(null);

const read = () => ({ token: api.getToken(), user: api.getStoredUser() });

/** Session state shared by the whole app. Citizens and admins use the same session; `role` decides access. */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(read);
  const [checking, setChecking] = useState(Boolean(session.token));

  // Stay in sync with api.js (401 handling) and other tabs.
  useEffect(() => {
    const sync = () => setSession(read());
    const onStorage = (e) => {
      if (e.key === api.TOKEN_KEY || e.key === api.USER_KEY || e.key === null) sync();
    };
    window.addEventListener(api.SESSION_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(api.SESSION_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Validate a stored token once on load. Servers without /auth/me keep the local session.
  useEffect(() => {
    if (!session.token) {
      setChecking(false);
      return undefined;
    }
    let alive = true;
    api
      .getMe()
      .then((me) => {
        if (alive && me) api.saveSession(session.token, { ...session.user, ...me });
      })
      .catch((e) => {
        if (alive && e.status === 401) api.clearSession();
      })
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((email, password) => api.login(email, password), []);
  const register = useCallback((data) => api.register(data), []);
  const logout = useCallback(() => api.logout(), []);

  const value = useMemo(() => {
    const user = session.token ? session.user : null;
    return {
      user,
      checking,
      isSignedIn: Boolean(user),
      isAdmin: api.isAdminUser(user),
      login,
      register,
      logout,
    };
  }, [session, checking, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
