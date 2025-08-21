import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.SUPPLIERS_HTTP_PORT || '3007', 10);
  const config = new DocumentBuilder()
    .setTitle('Suppliers API')
    .setDescription('Suppliers service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  console.log(`📠 Suppliers HTTP on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();


