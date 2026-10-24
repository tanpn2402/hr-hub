export interface IdenplaneTokenIntrospection {
  active: boolean;
  sub?: string;
  username?: string;
  preferred_username?: string;
  email?: string;
  scope?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<
    string,
    {
      roles?: string[];
    }
  >;
}

export interface IdenplaneUser {
  id: string;
  username: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  enabled: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IdenplaneUsersPage {
  users: IdenplaneUser[];
  total: number;
}

export interface IdenplaneRoleAssignmentResult {
  assigned: string[];
}
