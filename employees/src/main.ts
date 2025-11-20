
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Rate limiting general pentru endpoint-uri (300 request-uri / 15 min - mărit pentru a evita 429)
  const generalRateLimit = rateLimit({ 
    windowMs: 15*60*1000, // 15 minute
    max: 300, 
    message: 'Prea multe request-uri, te rugăm să aștepți câteva momente.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip pentru request-uri interne (din microservicii)
      if (req.headers['x-internal-service'] || req.headers['x-service-secret']) {
        return true;
      }
      
      // Skip pentru request-uri de la Next.js API routes (care fac proxy)
      if (req.headers['user-agent']?.includes('node-fetch') || 
          req.headers['user-agent']?.includes('axios') ||
          req.headers['user-agent']?.includes('undici')) {
        return true;
      }
      
      return false;
    }
  });

  // Aplică rate limiting
  app.use(generalRateLimit);

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
  console.log(`👷 Employees HTTP service listening on http://localhost:${httpPort}`);

}

bootstrap();