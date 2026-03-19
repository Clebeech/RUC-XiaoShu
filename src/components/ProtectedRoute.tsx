import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const isLoggedIn = Boolean(getAuthToken());
    
    if (!isLoggedIn) {
      toast.error('请先登录', { duration: 2000 });
    }
    
    setIsAuthenticated(isLoggedIn);
  }, []);

  // 初始加载时不渲染任何内容，避免闪烁
  if (isAuthenticated === null) {
    return null; 
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
