import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IdenplaneTokenIntrospection } from './idenplane.types';

@Injectable()
export class IdenplaneClient {
  private readonly logger = new Logger(IdenplaneClient.name);
  private readonly client: AxiosInstance;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;

  constructor(config: ConfigService) {
    this.client = axios.create({
      baseURL: config.getOrThrow<string>('IDENPLANE_URL').replace(/\/$/, ''),
      timeout: config.get<number>('IDENPLANE_HTTP_TIMEOUT_MS', 10000),
      validateStatus: () => true,
    });
    this.realm = config.getOrThrow<string>('IDENPLANE_REALM');
    this.clientId = config.getOrThrow<string>('IDENPLANE_CLIENT_ID');
    this.clientSecret = config.get<string>('IDENPLANE_CLIENT_SECRET');
  }

  async introspect(token: string): Promise<IdenplaneTokenIntrospection | null> {
    try {
      const response = await this.client.post<IdenplaneTokenIntrospection>(
        `/realms/${encodeURIComponent(this.realm)}/protocol/openid-connect/token/introspect`,
        {
          token,
          client_id: this.clientId,
          ...(this.clientSecret ? { client_secret: this.clientSecret } : {}),
        },
      );

      return response.status === 200 ? response.data : null;
    } catch (error) {
      this.logger.warn('Idenplane token introspection request failed');
      return null;
    }
  }
}
