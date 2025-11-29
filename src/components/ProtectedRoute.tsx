import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * ProtectedRoute component to ensure only authenticated users with proper roles can access certain routes
 * Redirects to login if not authenticated or to home if role is not allowed
 */
export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  useEffect(() => {
    if (!user) {
      // Not authenticated, redirect to login
      navigate('/login', { replace: true });
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // User doesn't have the required role
      navigate('/', { replace: true });
    }
  }, [user, allowedRoles, navigate]);

  if (!user || (allowedRoles && !allowedRoles.includes(user.role))) {
    return null;
  }

  return <>{children}</>;
};
