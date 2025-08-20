import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.WASTE_HTTP_PORT || '3012', 10);
  await app.listen(httpPort);
  // eslint-disable-next-line no-console
  console.log(`🗑️ Waste Records HTTP on http://localhost:${httpPort}`);
}

bootstrap();


