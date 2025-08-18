import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP app
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.COMPANY_HTTP_PORT || '3003', 10);
  await httpApp.listen(httpPort);
  console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);

  // Connect TCP microservice (keep existing transport for internal comms)
  httpApp.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: process.env.COMPANY_MS_HOST || '0.0.0.0',
      port: parseInt(process.env.COMPANY_MS_PORT || '4002', 10),
    },
  });
  await httpApp.startAllMicroservices();
  console.log(`🏢 Company Microservice listening on ${process.env.COMPANY_MS_HOST || '0.0.0.0'}:${parseInt(process.env.COMPANY_MS_PORT || '4002', 10)}`);
}

bootstrap();