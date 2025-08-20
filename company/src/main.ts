import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP app
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.COMPANY_HTTP_PORT || '3003', 10);
  await httpApp.listen(httpPort);
  console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);

}

bootstrap();