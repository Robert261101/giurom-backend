import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Create HTTP app
  const httpApp = await NestFactory.create(AppModule);
  
  // Configure CORS
  httpApp.enableCors({
    origin: true, // Allow all origins for development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  const httpPort = parseInt(process.env.ORT || '3003', 10);
  
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Company API')
    .setDescription('API pentru gestionarea companiilor și documentelor asociate')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('companies', 'Operațiuni cu companii')
    .addTag('documents', 'Operațiuni cu documente companie')
    .build();
  
  const document = SwaggerModule.createDocument(httpApp, config);
  SwaggerModule.setup('api/docs', httpApp, document);
  
  await httpApp.listen(httpPort);
  console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}

bootstrap();