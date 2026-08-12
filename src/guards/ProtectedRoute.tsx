import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  commercant?: boolean;
}

export default function ProtectedRoute({ children, roles, commercant }: ProtectedRouteProps) {
  const { session, getAccessToken } = useSessionStore();
  const token = getAccessToken();

  if (!token && !session) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    if (!session || !roles.includes(session.role)) {
      return <Navigate to="/login" replace />;
    }
  }

  if (commercant) {
    if (!session || session.role !== 'COMMERCANT') {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}
