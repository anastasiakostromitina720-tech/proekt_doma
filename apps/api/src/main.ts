import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { EnvService } from './config/env.service';

// Keep request bodies small for the MVP. Our largest documented payload is
// ~2KB (project.description), so 100KB is a generous ceiling that still
// protects against accidental/abusive uploads. When the floor-plan JSON
// endpoint lands, we'll bump this deliberately (or apply a scoped limit).
const MAX_BODY_SIZE = '100kb';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // We register body parsers manually below so we can set an explicit limit.
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));

  const env = app.get(EnvService);

  // Behind a reverse proxy (nginx, cloudflare), trust the first hop so
  // that `req.ip` reflects the real client.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(json({ limit: MAX_BODY_SIZE }));
  app.use(urlencoded({ extended: true, limit: MAX_BODY_SIZE }));
  app.use(cookieParser());

  // CORS is credentialed because auth uses httpOnly cookies.
  // Origin list must be explicit — '*' is not allowed with credentials.
  app.enableCors({
    origin: env.get('WEB_ORIGIN'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
  });

  app.setGlobalPrefix(env.get('API_GLOBAL_PREFIX'));

  // NOTE: we intentionally do NOT register a global ValidationPipe.
  // Validation is done per-endpoint via ZodValidationPipe against schemas
  // from @app/contracts, keeping a single source of truth with the frontend.

  // Order matters: NestJS picks the first filter whose `@Catch(...)` metadata
  // matches the thrown exception. `AllExceptionsFilter` has `@Catch()` (no
  // args) and therefore matches EVERYTHING — it must come last, otherwise
  // `PrismaExceptionFilter` would never run.
  app.useGlobalFilters(new PrismaExceptionFilter(), new AllExceptionsFilter());

  app.enableShutdownHooks();

  const port = env.get('PORT');
  const prefix = env.get('API_GLOBAL_PREFIX');

  await app.listen(port, '0.0.0.0');

  app
    .get(Logger)
    .log(`API listening on http://localhost:${port}/${prefix} (env=${env.get('NODE_ENV')})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
