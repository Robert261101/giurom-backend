import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.STOCK_HTTP_PORT || '3006', 10);
  await httpApp.listen(httpPort);
  console.log(`📦 Stock HTTP on http://localhost:${httpPort}`);

}

bootstrap();