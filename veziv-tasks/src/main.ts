import * as dotenv from 'dotenv';
dotenv.config();
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/response.interceptor';
import { useContainer } from 'class-validator';
import { randomUUID } from 'crypto';

// Configurare timezone pentru România
process.env.TZ = 'Europe/Bucharest';
console.log('🕐 Timezone configurat pentru România:', process.env.TZ);

// Polyfill pentru crypto - fix pentru eroarea @nestjs/schedule
// @nestjs/schedule încearcă să acceseze crypto.randomUUID() dar în unele contexte crypto nu e disponibil global
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = { randomUUID };
  console.log('✅ Crypto polyfill aplicat pentru @nestjs/schedule');
}

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) {
      throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    }
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:4200',
    'https://giurom-frontend.vercel.app', 'https://giurom.bitap.ro',
  ];
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

  const app = await NestFactory.create(AppModule);

  // Configurare container pentru validatori
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Configurare validare
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.setGlobalPrefix('tasks');

  const express = await import('express');
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Configurare Swagger
  const config = new DocumentBuilder()
    .setTitle('Veziv Tasks Service API')
    .setDescription('API pentru gestionarea task-urilor')
    .setVersion('1.0')
    .addServer('http://localhost:3008', 'Development Server')
    // .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('tasks/docs', app, document);

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  console.log(`Veziv Tasks Service rulează pe portul ${port}`);
}
bootstrap();
