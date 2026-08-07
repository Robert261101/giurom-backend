import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { ensurePr35CompanySchema } from './database/ensure-pr35-schema';

// DB_* sunt în company/.env — trebuie încărcate înainte de migrarea automată la boot
loadEnv({ path: join(__dirname, '..', '.env') });

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'https://giurom.bitap.ro', 'https://giurom-frontend.vercel.app'];
}

const logger = new Logger('Bootstrap');

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

  await ensurePr35CompanySchema();

  const httpApp = await NestFactory.create(AppModule, { bodyParser: false });
  httpApp.use(json({ limit: '50mb' }));
  httpApp.use(urlencoded({ extended: true, limit: '50mb' }));

  httpApp.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const httpPort = parseInt(process.env.COMPANY_HTTP_PORT || '3003', 10);
  await httpApp.listen(httpPort);
  logger.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);

}

bootstrap();