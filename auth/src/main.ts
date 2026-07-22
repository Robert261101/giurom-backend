import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/response.interceptor';

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
    'http://localhost:4200', 'http://localhost:3001', 'http://localhost:3000',
    'https://frontend.tau.com', 'https://giurom-frontend.vercel.app', 'https://giurom.bitap.ro',
  ];
}

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.SERVICE_SECRET) {
    throw new Error('SERVICE_SECRET must be set in production. Do not use default fallback.');
  }

  const app = await NestFactory.create(AppModule);
  
  // Configurare Swagger
  const config = new DocumentBuilder()
    .setTitle('Veziv Auth API')
    .setDescription('API pentru autentificare și autorizare')
    .setVersion('1.0')
    .addTag('auth')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Protecție HTTP Headers
  app.use(helmet());
  app.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  // Rate limiting — protecție brute-force per IP
  const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute
    max: 20, // 20 încercări de login per IP în 15 min
    message: { message: 'Prea multe încercări de autentificare. Încearcă din nou în 15 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !!(req.headers['x-internal-service'] && req.headers['x-service-secret']),
  });

  const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { message: 'Prea multe request-uri. Încearcă din nou mai târziu.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !!(req.headers['x-internal-service'] && req.headers['x-service-secret']),
  });

  app.use('/auth/login', loginRateLimit);
  app.use('/auth/validate-identifier', loginRateLimit);
  app.use('/auth/register/supplier', loginRateLimit);
  app.use('/2fa', loginRateLimit);
  app.use(generalRateLimit);
  // Validare globală a DTO-urilor - doar pentru body, nu pentru query params
  // Query params sunt validate doar dacă sunt DTO-uri (cu @Body decorator)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
    skipMissingProperties: false,
    skipNullProperties: false,
    skipUndefinedProperties: false,
    validateCustomDecorators: true,
    // Nu valida query params - doar body params
    // Query params sunt procesate manual în handler-uri
  }));
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Auth2 Microservice rulează pe portul ${port}`);
}
bootstrap();
