import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AllExceptionsFilter } from './common/http-exception.filter';

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

  const httpApp = await NestFactory.create(AppModule, { bodyParser: false });
  const httpPort = parseInt(process.env.PORT || '3007', 10);

  httpApp.useGlobalFilters(new AllExceptionsFilter());

  // Log fiecare request (method + path) ca să vezi ce ajunge la suppliers-ms
  httpApp.use((req: any, _res: any, next: any) => {
    next();
  });

  // Limită body 50mb (implicit Express ~100KB dă 413) – pentru upload documente cu base64 (ex. furnizori)
  httpApp.use(json({ limit: '50mb' }));
  httpApp.use(urlencoded({ extended: true, limit: '50mb' }));

  httpApp.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const config = new DocumentBuilder()
    .setTitle('Suppliers API')
    .setDescription('Suppliers service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  logger.log(`📠 Suppliers HTTP on http://localhost:${httpPort}`);
  logger.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();


