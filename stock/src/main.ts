import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.STOCK_HTTP_PORT || '3006', 10);
  await httpApp.listen(httpPort);
  console.log(`📦 Stock HTTP on http://localhost:${httpPort}`);

  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.STOCK_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.STOCK_MS_PORT || '4004', 10),
    },
  });
  await httpApp.startAllMicroservices();
  console.log(`📦 Stock microservice on ${process.env.STOCK_MS_HOST || '0.0.0.0'}:${parseInt(process.env.STOCK_MS_PORT || '4004', 10)}`);
}

bootstrap();