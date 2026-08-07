import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import { join } from 'path';

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

  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.STOCK_HTTP_PORT || '3006', 10);

  httpApp.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  httpApp.use(bodyParser.json({ limit: '100mb' }));
  httpApp.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
  
  // Serve images from the images directory (products, waste, consume)
  const imagesDir = join(__dirname, '..', '..', '..', 'images');
  (httpApp as any).useStaticAssets(imagesDir, {
    prefix: '/images/',
  });
  
  const config = new DocumentBuilder()
    .setTitle('Stock API')
    .setDescription('Stock service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  logger.log(`📦 Stock HTTP on http://localhost:${httpPort}`);
  logger.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();