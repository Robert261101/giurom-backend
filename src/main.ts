import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
    origin: ['http://localhost:4200','https://frontend.tau.com'],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    credentials: true,
  });
  // Rate limiting
  app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }));
  // Validare globală a DTO-urilor
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Veziv Auth2 rulează pe portul ${port}`);
}
bootstrap();
