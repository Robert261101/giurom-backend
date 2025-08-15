import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = parseInt(process.env.GATEWAY_PORT || '3002', 10);

  // Basic CORS (adjust as needed)
  app.enableCors({ origin: true, credentials: true });

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🌐 Gateway listening on http://0.0.0.0:${port}`);
}

bootstrap(); 