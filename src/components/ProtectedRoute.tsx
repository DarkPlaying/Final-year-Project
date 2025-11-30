import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/lib/auth';
import { UserRole } from '@/types/auth';
import { useAuthState } from '@/hooks/useAuthState';

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
  const { user, loading } = useAuthState();
  const localUser = getCurrentUser();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not authenticated in Firebase
        navigate('/login', { replace: true });
      } else if (allowedRoles && localUser && !allowedRoles.includes(localUser.role)) {
        // User doesn't have the required role
        navigate('/', { replace: true });
      } else if (allowedRoles && !localUser) {
        // Authenticated in Firebase but missing local session data
        // Redirect to login to restore session
        navigate('/login', { replace: true });
      }
    }
  }, [user, loading, allowedRoles, localUser, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (allowedRoles && (!localUser || !allowedRoles.includes(localUser.role)))) {
    return null;
  }

  return <>{children}</>;
};
