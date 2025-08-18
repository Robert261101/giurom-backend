import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.SUPPLIERS_HTTP_PORT || '3007', 10);
  await httpApp.listen(httpPort);
  console.log(`📠 Suppliers HTTP on http://localhost:${httpPort}`);

  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.SUPPLIERS_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.SUPPLIERS_MS_PORT || '4008', 10),
    },
  });
  await httpApp.startAllMicroservices();
  console.log(`📠 Suppliers microservice on ${process.env.SUPPLIERS_MS_HOST || '0.0.0.0'}:${parseInt(process.env.SUPPLIERS_MS_PORT || '4008', 10)}`);
}

bootstrap();


