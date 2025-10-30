import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.PORT || '3014', 10);
  const config = new DocumentBuilder()
    .setTitle('Waste Records API')
    .setDescription('Waste records service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api/docs', app as any, document);
  await app.listen(httpPort);
  // eslint-disable-next-line no-console
  console.log(`🗑️ Waste Records HTTP on http://localhost:${httpPort}`);
  // eslint-disable-next-line no-console
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}

bootstrap();


