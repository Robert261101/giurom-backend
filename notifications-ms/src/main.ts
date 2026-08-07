import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as crypto from 'crypto';


if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = crypto;
}

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

  // Create HTTP application
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Start HTTP server
  const port = process.env.PORT || 3011;
  await app.listen(port);
  logger.log(`🔔 Notifications Microservice is running on: http://localhost:${port}`);

  // Optionally create RabbitMQ microservice if RabbitMQ is available
  try {
    const microservice = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
        queueOptions: { durable: false },
      },
    });
    
    await microservice.listen();
    logger.log(`🐰 RabbitMQ microservice is running on queue: notifications`);
  } catch (error: any) {
    console.warn(
      `⚠️  RabbitMQ not available, running HTTP-only mode. Notificările de task/creare nu vor ajunge. Eroare: ${error?.message ?? error}`,
    );
  }
}

bootstrap();



