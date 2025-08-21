import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.LOCATIONS_HTTP_PORT || '3004', 10);
  const config = new DocumentBuilder()
    .setTitle('Locations API')
    .setDescription('Locations service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  // Cast to any to avoid type mismatch between nested node_modules versions
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  console.log(`📍 Locations HTTP on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();