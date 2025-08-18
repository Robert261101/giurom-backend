import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.LOCATIONS_HTTP_PORT || '3004', 10);
  await httpApp.listen(httpPort);
  console.log(`📍 Locations HTTP on http://localhost:${httpPort}`);

  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.LOCATIONS_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.LOCATIONS_MS_PORT || '4003', 10),
    },
  });
  await httpApp.startAllMicroservices();
  console.log(`📍 Locations microservice on ${process.env.LOCATIONS_MS_HOST || '0.0.0.0'}:${parseInt(process.env.LOCATIONS_MS_PORT || '4003', 10)}`);
}

bootstrap();