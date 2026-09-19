import axios, { AxiosHeaders, AxiosInstance, CreateAxiosDefaults, Method } from 'axios';
import { TraceContextService } from '../../modules/app/trace/trace-context.service';
import { TraceLogger } from '../../modules/app/trace/trace-logger.service';

export interface HttpResponse<T, V> {
  status: number;
  data?: T | V;
}

export abstract class BaseHTTPService {
  private readonly axiosInstance: AxiosInstance;
  protected readonly logger: TraceLogger;

  protected constructor(
    config: CreateAxiosDefaults,
    loggerName: string,
    protected readonly traceContext: TraceContextService,
  ) {
    this.axiosInstance = axios.create(config);
    this.logger = new TraceLogger(traceContext, loggerName);
  }

  protected async request<T, V>(
    method: Method,
    url: string,
    data?: unknown,
    // @ts-ignore
    headers?: AxiosHeaders | Record<string, string>,
  ): Promise<HttpResponse<T, V>> {
    this.logger.debug(`[BaseHTTPService] request [${method}] ${url}`);
    this.logger.debug(`[BaseHTTPService] request data: ${JSON.stringify(data ?? {})}`);

    try {
      const response = await this.axiosInstance.request<T>({
        method,
        url,
        data,
        headers,
        validateStatus: () => true,
      });

      const responseHeaders = JSON.stringify(response.headers ?? {});
      const responseBody = JSON.stringify(response.data ?? {});

      if (response.status >= 400) {
        this.logger.error(`[BaseHTTPService] response error [${response.status}] ${method} ${url}`);
        this.logger.error(`[BaseHTTPService] response headers: ${responseHeaders}`);
        this.logger.error(`[BaseHTTPService] response body: ${responseBody}`);
      } else {
        this.logger.log(`[BaseHTTPService] response [${response.status}] ${method} ${url}`);
        this.logger.log(`[BaseHTTPService] response headers: ${responseHeaders}`);
        this.logger.log(`[BaseHTTPService] response body: ${responseBody}`);
      }

      return {
        status: response.status,
        data: response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`[BaseHTTPService] request failed [${error.code ?? 'AXIOS_ERROR'}] ${method} ${url}: ${error.message}`);
        this.logger.error(`[BaseHTTPService] response status: ${error.response?.status ?? 'unknown'}`);
        this.logger.error(`[BaseHTTPService] response headers: ${JSON.stringify(error.response?.headers ?? {})}`);
        this.logger.error(`[BaseHTTPService] response body: ${JSON.stringify(error.response?.data ?? {})}`);
      } else {
        this.logger.error(`[BaseHTTPService] request failed [HTTP_ERROR] ${method} ${url}: ${String(error)}`);
      }

      throw error;
    }
  }
}
