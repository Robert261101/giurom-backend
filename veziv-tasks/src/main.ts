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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurare container pentru validatori
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Configurare CORS - comentat pentru dezvoltare
  // app.enableCors({
  //   origin: ['http://localhost:3000', 'http://localhost:4200', 'https://frontend.tau.com'],
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true,
  // });

  // CORS permis pentru orice origin în dezvoltare
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Configurare validare
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Setăm prefix global pentru toate rutele - necesar pentru API Gateway
  app.setGlobalPrefix('tasks');

  // Configurare body parser pentru a permite payload-uri mari (ex: imagini base64)
  // Acceptăm până la 100MB în body pentru upload-uri mari
  try {
    const express = await import('express');
    app.use(express.json({ limit: process.env.BODY_PARSER_LIMIT || '100mb' }));
    app.use(
      express.urlencoded({
        limit: process.env.BODY_PARSER_LIMIT || '100mb',
        extended: true,
      }),
    );
    console.log(
      `🔧 [MAIN] Body parser limit set to ${process.env.BODY_PARSER_LIMIT || '100mb'}`,
    );
  } catch (e) {
    console.warn(
      '⚠️ [MAIN] Could not configure express body parser limits:',
      e,
    );
  }

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
