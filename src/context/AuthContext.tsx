import React, { createContext, useContext, useState } from 'react';
import type { User, Role } from '../types';
import { mockUsers } from '../data/mock';

interface AuthContextValue {
  currentUser: User | null;
  login: (email: string, password: string) => User;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('nydb2b_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = (email: string, password: string): User => {
    const user = mockUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!user) throw new Error('Email ou senha incorretos');
    setCurrentUser(user);
    sessionStorage.setItem('nydb2b_user', JSON.stringify(user));
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('nydb2b_user');
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function roleDefaultPath(role: Role): string {
  switch (role) {
    case 'cliente':
      return '/loja';
    case 'admin':
      return '/empresa';
    case 'superadmin':
      return '/superadmin';
  }
}
