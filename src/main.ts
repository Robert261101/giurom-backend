import * as dotenv from 'dotenv';
dotenv.config();
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/response.interceptor';
import { useContainer } from 'class-validator';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurare container pentru validatori
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  
  // Configurare CORS - comentat pentru dezvoltare
  // app.enableCors({
  //   origin: ['http://localhost:3000', 'http://localhost:4200', 'https://frontend.tau.com'],
  //   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  //   credentials: true,
  // });
  
  // CORS permis pentru orice origin în dezvoltare
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  // Configurare validare
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Prefix global pentru API
  app.setGlobalPrefix('api');

  // Configurare Swagger
  const config = new DocumentBuilder()
    .setTitle('Veziv Tasks Service API')
    .setDescription('API pentru gestionarea task-urilor')
    .setVersion('1.0')
    // .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  console.log(`Veziv Tasks Service rulează pe portul ${port}`);
}
bootstrap();
