import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.RECIPES_HTTP_PORT || '3005', 10);
  await httpApp.listen(httpPort);
  console.log(`🍲 Recipes HTTP on http://localhost:${httpPort}`);

}

bootstrap();


