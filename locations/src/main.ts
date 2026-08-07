import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'https://giurom-frontend.vercel.app', 'https://giurom.bitap.ro'];
}

const logger = new Logger('Bootstrap');

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

  const httpApp = await NestFactory.create(AppModule);
  // body-parser 100mb (express vine din @nestjs/platform-express)
  const express = require('express');
  httpApp.use(express.json({ limit: '100mb' }));
  httpApp.use(express.urlencoded({ limit: '100mb', extended: true }));
  
  httpApp.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const httpPort = parseInt(process.env.LOCATIONS_HTTP_PORT || '3004', 10);
  const config = new DocumentBuilder()
    .setTitle('Locations API')
    .setDescription('Locations service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Cast to any to avoid type mismatch between nested node_modules versions
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  logger.log(`📍 Locations HTTP on http://localhost:${httpPort}`);
  logger.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();