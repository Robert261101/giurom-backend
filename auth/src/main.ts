import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
// import rateLimit from 'express-rate-limit'; // Rate limiting dezactivat
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/response.interceptor';

async function bootstrap() {
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
  // CORS
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://frontend.tau.com',
      'http://localhost:3001',  // Frontend BNK
      'http://localhost:3000'   // Frontend BNK (alternativ)
    ],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    credentials: true,
  });
  // Rate limiting dezactivat
  // const publicAuthPaths = ['/auth/validate-identifier', '/auth/login', '/auth/verify', '/auth/send-verification-code', '/2fa'];
  // 
  // // Rate limiting permisiv pentru endpoint-uri publice (200 request-uri / 15 min)
  // const authPublicRateLimit = rateLimit({ 
  //   windowMs: 15*60*1000, // 15 minute
  //   max: 200, // 200 request-uri per IP pentru endpoint-uri publice
  //   message: 'Prea multe încercări de autentificare, te rugăm să aștepți câteva momente.',
  //   standardHeaders: true,
  //   legacyHeaders: false,
  //   skip: (req) => {
  //     // Aplică doar pentru endpoint-uri publice
  //     return !publicAuthPaths.some(path => req.path.includes(path));
  //   }
  // });
  // 
  // // Rate limiting general pentru restul endpoint-urilor (300 request-uri / 15 min - mărit pentru a evita 429)
  // const generalRateLimit = rateLimit({ 
  //   windowMs: 15*60*1000, // 15 minute
  //   max: 300, 
  //   message: 'Prea multe request-uri, te rugăm să aștepți câteva momente.',
  //   standardHeaders: true,
  //   legacyHeaders: false,
  //   skip: (req) => {
  //     // Skip pentru endpoint-uri publice (sunt acoperite de authPublicRateLimit)
  //     if (publicAuthPaths.some(path => req.path.includes(path))) {
  //       return true;
  //     }
  //     
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
  // 
  // // Rate limiting dezactivat
  // app.use(authPublicRateLimit);
  // app.use(generalRateLimit);
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
