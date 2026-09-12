import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TraceStore {
  traceId: string;
}

@Injectable()
export class TraceContextService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<TraceStore>();

  run<T>(traceId: string, callback: () => T): T {
    return this.asyncLocalStorage.run({ traceId }, callback);
  }

  getTraceId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.traceId;
  }
}
