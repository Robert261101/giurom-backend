import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: process.env.EMPLOYEES_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.EMPLOYEES_MS_PORT || '4001', 10),
    },
  });

  await app.listen();
  // eslint-disable-next-line no-console
  console.log(`👷 Employees microservice listening on ${process.env.EMPLOYEES_MS_HOST || '0.0.0.0'}:${parseInt(process.env.EMPLOYEES_MS_PORT || '4001', 10)}`);
}

bootstrap();