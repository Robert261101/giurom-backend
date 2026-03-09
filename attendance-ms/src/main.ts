import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'https://giurom-frontend.vercel.app', 'https://giurom.bitap.ro'];
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

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

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Attendance Microservice API')
    .setDescription('API pentru gestionarea prezenței și schimburilor de lucru')
    .setVersion('1.0')
    .addTag('attendance', 'Operații pentru prezență și schimburi')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3016;
  await app.listen(port);
  console.log(`🕒 Attendance Microservice is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap();


