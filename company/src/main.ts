import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP app
  const httpApp = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend communication
  httpApp.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  
  const httpPort = parseInt(process.env.COMPANY_HTTP_PORT || '3003', 10);
  await httpApp.listen(httpPort);
  console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);

}

bootstrap();