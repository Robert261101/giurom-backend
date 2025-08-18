import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.LOCATIONS_HTTP_PORT || '3004', 10);
  await httpApp.listen(httpPort);
  console.log(`📍 Locations HTTP on http://localhost:${httpPort}`);

}

bootstrap();