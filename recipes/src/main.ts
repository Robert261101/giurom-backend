import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.RECIPES_HTTP_PORT || '3005', 10);
  const config = new DocumentBuilder()
    .setTitle('Recipes API')
    .setDescription('Recipes service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  console.log(`🍲 Recipes HTTP on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();


