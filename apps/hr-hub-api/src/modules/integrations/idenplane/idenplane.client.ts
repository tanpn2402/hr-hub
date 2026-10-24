import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, Method } from 'axios';
import { IdenplaneTokenIntrospection } from './idenplane.types';

export class IdenplaneAdminRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = IdenplaneAdminRequestError.name;
  }
}

@Injectable()
export class IdenplaneClient {
  private readonly logger = new Logger(IdenplaneClient.name);
  private readonly client: AxiosInstance;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret?: string;
  private readonly adminApiKey?: string;

  constructor(config: ConfigService) {
    this.client = axios.create({
      baseURL: config.getOrThrow<string>('IDENPLANE_URL').replace(/\/$/, ''),
      timeout: config.get<number>('IDENPLANE_HTTP_TIMEOUT_MS', 10000),
      validateStatus: () => true,
    });
    this.realm = config.getOrThrow<string>('IDENPLANE_REALM');
    this.clientId = config.getOrThrow<string>('IDENPLANE_CLIENT_ID');
    this.clientSecret = config.get<string>('IDENPLANE_CLIENT_SECRET');
    this.adminApiKey = config.get<string>('IDENPLANE_ADMIN_API_KEY');
  }

  getRealm(): string {
    return this.realm;
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
    } catch {
      this.logger.warn('Idenplane token introspection request failed');
      return null;
    }
  }

  async adminRequest<T>(method: Method, path: string, data?: unknown): Promise<T> {
    const adminApiKey = this.adminApiKey?.trim();
    if (!adminApiKey) {
      throw new ServiceUnavailableException('Idenplane administrative API is not configured');
    }

    try {
      const response = await this.client.request<T>({
        method,
        url: path,
        data,
        headers: { 'x-admin-api-key': adminApiKey },
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      throw new IdenplaneAdminRequestError(response.status, this.errorMessage(response.data, response.status));
    } catch (error) {
      if (error instanceof IdenplaneAdminRequestError) throw error;

      if (axios.isAxiosError(error)) {
        this.logger.warn(`Idenplane administrative request failed: ${error.code ?? error.message}`);
        throw new ServiceUnavailableException('Idenplane administrative API is unavailable');
      }

      throw error;
    }
  }

  private errorMessage(data: unknown, status: number): string {
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join(', ');
    }

    return `Idenplane administrative request failed with status ${status}`;
  }
}
