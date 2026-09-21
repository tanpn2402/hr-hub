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
  resource_access?: Record<string, {
    roles?: string[];
  }>;
}
