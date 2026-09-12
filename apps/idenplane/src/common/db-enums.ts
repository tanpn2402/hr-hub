// SQLite has no native enum type, so prisma/schema.sqlite.prisma stores these
// columns as plain String instead of a Prisma enum. That means Prisma Client
// does not export ClientType / MagicLinkStatus / NhiIdentityType /
// NhiLifecycleStatus / NhiCredentialType from '@prisma/client' under this
// schema. These shims reproduce the same runtime shape Prisma generates for a
// real enum (a const object plus a derived union type) so call sites that do
// `@IsEnum(ClientType)`, `registerEnumType(ClientType, ...)`, or
// `ClientType.CONFIDENTIAL` keep working unchanged — just import from here
// instead of '@prisma/client'.

export const ClientType = {
  CONFIDENTIAL: 'CONFIDENTIAL',
  PUBLIC: 'PUBLIC',
} as const;
export type ClientType = (typeof ClientType)[keyof typeof ClientType];

export const MagicLinkStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type MagicLinkStatus = (typeof MagicLinkStatus)[keyof typeof MagicLinkStatus];

export const NhiIdentityType = {
  MACHINE_TO_MACHINE: 'MACHINE_TO_MACHINE',
  IOT_DEVICE: 'IOT_DEVICE',
  SERVICE: 'SERVICE',
  AI_AGENT: 'AI_AGENT',
} as const;
export type NhiIdentityType = (typeof NhiIdentityType)[keyof typeof NhiIdentityType];

export const NhiLifecycleStatus = {
  PROVISIONING: 'PROVISIONING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DECOMMISSIONED: 'DECOMMISSIONED',
} as const;
export type NhiLifecycleStatus = (typeof NhiLifecycleStatus)[keyof typeof NhiLifecycleStatus];

export const NhiCredentialType = {
  API_KEY: 'API_KEY',
  CERTIFICATE: 'CERTIFICATE',
  JWT: 'JWT',
  OAUTH: 'OAUTH',
  MTLS: 'MTLS',
} as const;
export type NhiCredentialType = (typeof NhiCredentialType)[keyof typeof NhiCredentialType];
