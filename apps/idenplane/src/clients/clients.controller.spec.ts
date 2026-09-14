jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { ClientsController } from './clients.controller.js';
import type { Realm } from '@prisma/client';

describe('ClientsController', () => {
  let controller: ClientsController;
  let clientsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findByClientId: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    regenerateSecret: jest.Mock;
    getServiceAccount: jest.Mock;
  };

  const realm = { id: 'realm-1', name: 'test-realm' } as Realm;

  beforeEach(() => {
    clientsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByClientId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      regenerateSecret: jest.fn(),
      getServiceAccount: jest.fn(),
    };

    controller = new ClientsController(clientsService as any);
  });

  // ClientsService returns redirectUris/postLogoutRedirectUris/webOrigins/
  // grantTypes as JSON-serialized strings (SQLite has no native String[]
  // column) — the controller must parse them back into arrays via
  // toClientResponse() before they reach the mock "expected" shape below.
  const rawArrayFields = {
    redirectUris: '["https://example.com/cb"]',
    postLogoutRedirectUris: '[]',
    webOrigins: '[]',
    grantTypes: '["authorization_code"]',
  };
  const parsedArrayFields = {
    redirectUris: ['https://example.com/cb'],
    postLogoutRedirectUris: [],
    webOrigins: [],
    grantTypes: ['authorization_code'],
  };

  describe('create', () => {
    it('should call clientsService.create with realm and dto, parsing array fields', async () => {
      const dto = { clientId: 'my-app', name: 'My App' };
      const raw = { id: 'c1', ...dto, ...rawArrayFields };
      clientsService.create.mockReturnValue(raw);

      const result = await controller.create(realm, dto);

      expect(clientsService.create).toHaveBeenCalledWith(realm, dto);
      expect(result).toEqual({ id: 'c1', ...dto, ...parsedArrayFields });
    });
  });

  describe('findAll', () => {
    it('should call clientsService.findAll with realm, parsing array fields', async () => {
      const raw = [
        { id: 'c1', ...rawArrayFields },
        { id: 'c2', ...rawArrayFields },
      ];
      clientsService.findAll.mockReturnValue(raw);

      const result = await controller.findAll(realm);

      expect(clientsService.findAll).toHaveBeenCalledWith(realm);
      expect(result).toEqual([
        { id: 'c1', ...parsedArrayFields },
        { id: 'c2', ...parsedArrayFields },
      ]);
    });
  });

  describe('findOne', () => {
    it('should call clientsService.findByClientId with realm and clientId, parsing array fields', async () => {
      const raw = { id: 'c1', clientId: 'my-app', ...rawArrayFields };
      clientsService.findByClientId.mockReturnValue(raw);

      const result = await controller.findOne(realm, 'my-app');

      expect(clientsService.findByClientId).toHaveBeenCalledWith(
        realm,
        'my-app',
      );
      expect(result).toEqual({
        id: 'c1',
        clientId: 'my-app',
        ...parsedArrayFields,
      });
    });
  });

  describe('update', () => {
    it('should call clientsService.update with realm, clientId, and dto, parsing array fields', async () => {
      const dto = { name: 'Updated App' };
      const raw = { id: 'c1', clientId: 'my-app', ...dto, ...rawArrayFields };
      clientsService.update.mockReturnValue(raw);

      const result = await controller.update(realm, 'my-app', dto);

      expect(clientsService.update).toHaveBeenCalledWith(realm, 'my-app', dto);
      expect(result).toEqual({
        id: 'c1',
        clientId: 'my-app',
        ...dto,
        ...parsedArrayFields,
      });
    });
  });

  describe('remove', () => {
    it('should call clientsService.remove with realm and clientId', async () => {
      clientsService.remove.mockReturnValue(undefined);

      const result = await controller.remove(realm, 'my-app');

      expect(clientsService.remove).toHaveBeenCalledWith(realm, 'my-app');
      expect(result).toBeUndefined();
    });
  });

  describe('regenerateSecret', () => {
    it('should call clientsService.regenerateSecret with realm and clientId', () => {
      const expected = { secret: 'new-secret-value' };
      clientsService.regenerateSecret.mockReturnValue(expected);

      const result = controller.regenerateSecret(realm, 'my-app');

      expect(clientsService.regenerateSecret).toHaveBeenCalledWith(
        realm,
        'my-app',
      );
      expect(result).toEqual(expected);
    });
  });

  describe('getServiceAccount', () => {
    it('should call clientsService.getServiceAccount with realm and clientId', () => {
      const expected = { id: 'sa-1', username: 'service-account-my-app' };
      clientsService.getServiceAccount.mockReturnValue(expected);

      const result = controller.getServiceAccount(realm, 'my-app');

      expect(clientsService.getServiceAccount).toHaveBeenCalledWith(
        realm,
        'my-app',
      );
      expect(result).toEqual(expected);
    });
  });
});
