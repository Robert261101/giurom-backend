import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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

  // Create TCP microservice
  const microservice = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.EMPLOYEES_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.EMPLOYEES_MS_PORT || '4001', 10),
    },
  });

  await microservice.listen();
  console.log(`👷 Employees TCP microservice listening on ${process.env.EMPLOYEES_MS_HOST || '0.0.0.0'}:${parseInt(process.env.EMPLOYEES_MS_PORT || '4001', 10)}`);
}

bootstrap();