import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Securitate - Helmet
  app.use(helmet.default());

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Validation Pipe cu class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Giurom API - Punct de Lucru și Adăugare Firmă')
    .setDescription(
      'API pentru modulele Punct de Lucru și Adăugare Firmă. ' +
      'Acest API permite gestionarea companiilor, documentelor acestora, ' +
      'locațiilor de lucru și template-urilor de sarcini.',
    )
    .setVersion('1.0')
    .addTag('companies', 'Operațiuni pentru companii și documentele acestora')
    .addTag('locations', 'Operațiuni pentru locațiile de lucru și template-uri')
    .addTag('employees', 'Operațiuni pentru angajați și dosarele de personal')
    .addTag('employee-work-location-history', 'Istoricul mutărilor angajaților între locațiile de lucru')
    .addTag('employee-files', 'Gestionarea fișierelor din dosarele angajaților')
    .addTag('generated-documents', 'Generarea și managementul documentelor pentru angajați')
    .addBearerAuth()
    .addServer('http://localhost:3001', 'Development Server')
    .addServer('https://api.giurom.com', 'Production Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      showCommonExtensions: true,
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Aplicația rulează pe http://localhost:${port}`);
  console.log(`📚 Documentația Swagger este disponibilă la http://localhost:${port}/api/docs`);
}

bootstrap(); 