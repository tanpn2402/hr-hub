import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from './auth.types';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  // {
  //   id: '7eb62319-c670-4ac2-b30b-5c15999c78d9',
  //   username: 'tan.pham',
  //   email: 'tan.pham@tx-tech.co',
  //   roles: [ 'staff' ],
  //   permissions: [ 'email', 'profile', 'openid', 'roles' ],
  //   provider: 'idenplane',
  //   providerUserId: '7eb62319-c670-4ac2-b30b-5c15999c78d9'
  // }
  return request.user as AuthenticatedUser;
});
