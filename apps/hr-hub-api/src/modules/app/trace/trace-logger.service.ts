import { Logger } from '@nestjs/common';
import { TraceContextService } from './trace-context.service';

export class TraceLogger extends Logger {
  constructor(
    private readonly traceContext: TraceContextService,
    context: string,
  ) {
    super(context);
  }

  private formatMessage(message: string): string {
    return `[${this.traceContext.getTraceId() ?? 'no-trace'}] ${message}`;
  }

  log(message: string, ...optionalParams: [...any, string?]): void {
    super.log(this.formatMessage(message), ...optionalParams);
  }

  error(message: string | Error, stack?: string, context?: string): void {
    if (message instanceof Error) {
      super.error(this.formatMessage(message.message), message.stack, context ?? this.context);
      return;
    }

    super.error(this.formatMessage(message), stack, context ?? this.context);
  }

  warn(message: string, ...optionalParams: [...any, string?]): void {
    super.warn(this.formatMessage(message), ...optionalParams);
  }

  debug(message: string, ...optionalParams: [...any, string?]): void {
    super.debug(this.formatMessage(message), ...optionalParams);
  }

  verbose(message: string, ...optionalParams: [...any, string?]): void {
    super.verbose(this.formatMessage(message), ...optionalParams);
  }
}
