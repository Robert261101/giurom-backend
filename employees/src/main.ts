import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
// import rateLimit from 'express-rate-limit'; // Rate limiting dezactivat

function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const fromEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (isProd) {
    if (fromEnv.length === 0) throw new Error('ALLOWED_ORIGINS must be set in production (e.g. https://giurom.bitap.ro)');
    return fromEnv;
  }
  return fromEnv.length > 0 ? fromEnv : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'https://giurom.bitap.ro', 'https://giurom-frontend.vercel.app'];
}

const logger = new Logger('Bootstrap');

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate limiting dezactivat
  // const generalRateLimit = rateLimit({ 
  //   windowMs: 15*60*1000, // 15 minute
  //   max: 300, 
  //   message: 'Prea multe request-uri, te rugăm să aștepți câteva momente.',
  //   standardHeaders: true,
  //   legacyHeaders: false,
  //   skip: (req) => {
  //     // Skip pentru request-uri interne (din microservicii)
  //     if (req.headers['x-internal-service'] || req.headers['x-service-secret']) {
  //       return true;
  //     }
  //     
  //     // Skip pentru request-uri de la Next.js API routes (care fac proxy)
  //     if (req.headers['user-agent']?.includes('node-fetch') || 
  //         req.headers['user-agent']?.includes('axios') ||
  //         req.headers['user-agent']?.includes('undici')) {
  //       return true;
  //     }
  //     
  //     return false;
  //   }
  // });

  // Rate limiting dezactivat
  // app.use(generalRateLimit);

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('Employees Microservice')
    .setDescription('API pentru gestionarea angajaților')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start HTTP server
  const httpPort = parseInt(process.env.PORT || '3011', 10);
  await app.listen(httpPort);
  logger.log(`👷 Employees HTTP service listening on http://localhost:${httpPort}`);

}

bootstrap();