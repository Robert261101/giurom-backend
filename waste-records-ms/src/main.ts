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
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'https://giurom.bitap.ro', 'https://giurom-frontend.vercel.app'];
}

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const httpPort = parseInt(process.env.WASTE_HTTP_PORT || '3014', 10);
  const config = new DocumentBuilder()
    .setTitle('Waste Records API')
    .setDescription('Waste records service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api/docs', app as any, document);
  await app.listen(httpPort);
  // eslint-disable-next-line no-console
  logger.log(`🗑️ Waste Records HTTP on http://localhost:${httpPort}`);
  // eslint-disable-next-line no-console
  logger.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}

bootstrap();


