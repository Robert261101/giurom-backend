import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.SUPPLIERS_HTTP_PORT || '3007', 10);
  await httpApp.listen(httpPort);
  console.log(`📠 Suppliers HTTP on http://localhost:${httpPort}`);

}

bootstrap();


