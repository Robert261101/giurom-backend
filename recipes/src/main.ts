import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.RECIPES_HTTP_PORT || '3005', 10);
  await httpApp.listen(httpPort);
  console.log(`🍲 Recipes HTTP on http://localhost:${httpPort}`);

  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.RECIPES_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.RECIPES_MS_PORT || '4005', 10),
    },
  });
  await httpApp.startAllMicroservices();
  console.log(`🍲 Recipes microservice on ${process.env.RECIPES_MS_HOST || '0.0.0.0'}:${parseInt(process.env.RECIPES_MS_PORT || '4005', 10)}`);
}

bootstrap();


