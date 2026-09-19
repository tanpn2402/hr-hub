import { createContext, useEffect, useState, useMemo, useCallback } from 'react';
import { IdenplaneClient, UserInfo } from 'idenplane-sdk';
import { config } from './config';

export type AuthContextType = {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const idenplane = useMemo(() => {
    return new IdenplaneClient({
      ...config,
      onLogout: () => {
        //
      }
    });
  }, []);

  useEffect(() => {
    function checkAuth() {
      try {
        const authStatus = idenplane.isAuthenticated();
        setIsAuthenticated(authStatus);

        if (authStatus) {
          const userData = idenplane.getUserInfo();
          setUser(userData);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, [idenplane]);

  // Utility method to check roles
  const hasRole = (role: string) => {
    if (!user || !user.roles) return false;
    return idenplane.hasClientRole(idenplane.getConfig().clientId, role);
  };

  // Utility method to check granular permissions
  const hasPermission = (permission: string) => {
    if (!user || !user.permissions) return false;
    return idenplane.hasPermission(permission);
  };

  const login = useCallback(() => {
    return idenplane.login();
  }, [idenplane]);

  const logout = useCallback(() => {
    return idenplane.logout();
  }, [idenplane]);


  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
