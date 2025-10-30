import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  
  // Configure CORS
  httpApp.enableCors({
    origin: [
      'http://localhost:3000', 
      'http://localhost:3001',
      'https://giurom-frontend.vercel.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  const httpPort = parseInt(process.env.PORT || '3004', 10);
  const config = new DocumentBuilder()
    .setTitle('Locations API')
    .setDescription('Locations service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Cast to any to avoid type mismatch between nested node_modules versions
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  console.log(`📍 Locations HTTP on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();