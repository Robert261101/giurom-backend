import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP application
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Start HTTP server
  const port = process.env.PORT || 3011;
  await app.listen(port);
  console.log(`🔔 Notifications Microservice is running on: http://localhost:${port}`);

  // Optionally create RabbitMQ microservice if RabbitMQ is available
  try {
    const microservice = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
        queueOptions: { durable: false },
      },
    });
    
    await microservice.listen();
    console.log(`🐰 RabbitMQ microservice is running on queue: notifications`);
  } catch (error) {
    console.log(`⚠️  RabbitMQ not available, running HTTP-only mode`);
  }
}

bootstrap();



