import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Body parser config
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));

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
        exposeDefaultValues: true,
      },
      validateCustomDecorators: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        console.log('Validation errors:', JSON.stringify(errors, null, 2));
        const firstError = errors[0];
        console.log('First error details:', {
          property: firstError?.property,
          value: firstError?.value,
          constraints: firstError?.constraints,
          target: firstError?.target
        });
        const constraints = firstError?.constraints;
        const message = constraints ? Object.values(constraints)[0] : 'Date de intrare invalide';
        return new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message,
          field: firstError?.property,
          value: firstError?.value,
          constraints: firstError?.constraints
        });
      },
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Giurom API')
    .setDescription(
      'API complet pentru sistemul de management Giurom. ' +
      'Acest API permite gestionarea companiilor, angajaților, pontajului, rețetelor, stocului și furnizorilor. ' +
      'Toate endpoint-urile sunt documentate și pot fi testate direct din această interfață.'
    )
    .setVersion('1.0')
    .addTag('companies', 'Operațiuni pentru companii și documentele acestora')
    .addTag('locations', 'Operațiuni pentru locațiile de lucru și template-uri')
    .addTag('employees', 'Operațiuni pentru angajați și dosarele de personal')
    .addTag('employee-work-location-history', 'Istoricul mutărilor angajaților între locațiile de lucru')
    .addTag('employee-files', 'Gestionarea fișierelor din dosarele angajaților')
    .addTag('generated-documents', 'Generarea și managementul documentelor pentru angajați')
    .addTag('attendance', 'Modulul de pontaj și business intelligence - schimburi, prezențe și puncte de inflexiune')
    .addTag('recipes', 'Modulul Rețetar - gestionarea rețetelor, categoriilor și produselor cu relații many-to-many')
    .addTag('stock', 'Modulul Stoc - produse, cantități, tranzacții')
    .addTag('recipe-labels', 'Modulul Etichete - PDF cu date identificare preparare')
    .addTag('waste-records', 'Modulul pierderi - înregistrarea pierderilor de produse/rețete')
    .addTag('suppliers', 'Modulul Furnizori - gestionarea furnizorilor, produselor, comenzilor și documentelor cu structură cloud automată')
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