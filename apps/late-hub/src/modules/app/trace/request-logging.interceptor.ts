import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { TraceContextService } from './trace-context.service';
import { TraceLogger } from './trace-logger.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: TraceLogger;

  constructor(private readonly traceContext: TraceContextService) {
    this.logger = new TraceLogger(traceContext, 'HttpRequest');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const traceId = randomUUID();
    const startedAt = Date.now();
    const requestUrl = request.originalUrl ?? request.url;
    const clientIp = this.getClientIp(request);

    response.setHeader('X-Trace-Id', traceId);

    return new Observable<unknown>((subscriber) => {
      let subscription: { unsubscribe: () => void } | undefined;

      this.traceContext.run(traceId, () => {
        this.logger.log(`START [${request.method}] ${requestUrl} ${clientIp} ${this.serialize(request.body)}`);

        subscription = next
          .handle()
          .pipe(
            tap((data) => {
              this.logger.log(
                `END [${request.method}] ${requestUrl} ${clientIp} ${response.statusCode} ${this.serialize(data)} ${Date.now() - startedAt}ms`,
              );
            }),
            catchError((error: unknown) => {
              const errorStatus =
                typeof (error as { getStatus?: unknown })?.getStatus === 'function'
                  ? (error as { getStatus: () => number }).getStatus()
                  : response.statusCode;
              this.logger.error(
                `END [${request.method}] ${requestUrl} ${clientIp} ${errorStatus} ${this.serialize({})} ${Date.now() - startedAt}ms`,
              );
              throw error;
            }),
          )
          .subscribe(subscriber);
      });

      return () => subscription?.unsubscribe();
    });
  }

  private getClientIp(request: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  }): string {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0];

    return forwardedIp?.trim() || String(request.headers?.['x-real-ip'] ?? request.ip ?? request.socket?.remoteAddress ?? 'unknown');
  }

  private serialize(value: unknown): string {
    if (value === undefined || value === null) return 'NULL';

    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      serialized = '[Unserializable]';
    }

    return serialized.length > 10000 ? `${serialized.substring(0, 10000)}...` : serialized;
  }
}
