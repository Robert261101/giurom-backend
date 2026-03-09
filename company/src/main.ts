import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'https://giurom.bitap.ro', 'https://giurom-frontend.vercel.app'];
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

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
  console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);

}

bootstrap();