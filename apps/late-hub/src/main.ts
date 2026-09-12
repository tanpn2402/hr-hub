import 'winston-daily-rotate-file';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { format, transports, createLogger } from 'winston';
import TransportStream from 'winston-transport';
import { WinstonModule, utilities as nestWinstonUtilities } from 'nest-winston';
import { AppModule } from './modules/app/app.module';

async function bootstrap() {
  const bootstrapLogger = createLogger({
    format: format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
  });

  process.on('uncaughtException', (error) => bootstrapLogger.error('Uncaught exception', { error }));
  process.on('unhandledRejection', (reason) => bootstrapLogger.error('Unhandled rejection', { reason }));

  const config = new ConfigService();
  const loggerTransports: TransportStream[] = (process.env.LOGGER_TRANSPORTS ?? 'console')
    .split(',')
    .map((type) => type.trim().toLowerCase())
    .flatMap<TransportStream>((type) => {
      if (type === 'console') {
        return [
          new transports.Console({
            format: nestWinstonUtilities.format.nestLike('LateHub', { colors: true, prettyPrint: true }),
          }),
        ];
      }

      if (type === 'file') {
        return [
          new transports.DailyRotateFile({
            dirname: process.env.LOGGER_FILE_DIRNAME ?? './logs',
            filename: `${(process.env.LOGGER_FILE_NAME ?? 'application').replace('.log', '')}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            level: process.env.LOGGER_FILE_LEVEL ?? 'info',
            maxSize: process.env.LOGGER_FILE_MAX_SIZE ?? '10m',
            zippedArchive: process.env.LOGGER_FILE_ZIPPED_ARCHIVE === 'Y',
            format: nestWinstonUtilities.format.nestLike('LateHub', { colors: false, prettyPrint: true }),
          }),
        ];
      }

      return [];
    });

  const logger = createLogger({
    format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), format.json()),
    transports: loggerTransports.length > 0 ? loggerTransports : [new transports.Console()],
  });

  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({ instance: logger }),
  });

  if (config.get('CORS_ENABLED') === 'Y') {
    app.enableCors({ origin: config.get('CORS_ORIGIN'), credentials: true });
  }

  const port = config.get<number>('SERVER_PORT', 3000);
  await app.listen(port);
  logger.info(`HTTP server listening on port ${port}`);
}

void bootstrap();
