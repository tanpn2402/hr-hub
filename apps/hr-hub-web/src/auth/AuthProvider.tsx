import { createContext, useEffect, useState, useCallback } from 'react';
import { UserInfo } from 'idenplane-sdk';

import { idenplane } from '@/lib/idenplane';

export type AuthContextType = {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  /** True when the user has at least one of the roles (realm or client roles, case-insensitive). */
  hasAnyRole: (roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function checkAuth() {
      try {
        const authStatus = idenplane.isAuthenticated();
        setIsAuthenticated(authStatus);

        if (authStatus) {
          const userData = idenplane.getUserInfo();

          console.log('UserInfo', idenplane.getUserInfo());
          console.log('UserRole', idenplane.getClientRoles(idenplane.getConfig().clientId));

          setUser(userData);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, [idenplane]);

  // Utility method to check roles
  const hasRole = (role: string) => {
    if (!user) return false;
    return idenplane.hasClientRole(idenplane.getConfig().clientId, role);
  };

  // Same role set the API sees: realm roles + client roles, compared case-insensitively.
  const hasAnyRole = useCallback(
    (roles: string[]) => {
      if (!user) return false;
      const owned = new Set(
        [...idenplane.getRealmRoles(), ...idenplane.getClientRoles(idenplane.getConfig().clientId)].map((role) =>
          role.toLowerCase(),
        ),
      );
      return roles.some((role) => owned.has(role.toLowerCase()));
    },
    [user],
  );

  // Utility method to check granular permissions
  const hasPermission = (permission: string) => {
    if (!user) return false;
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
    hasAnyRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
