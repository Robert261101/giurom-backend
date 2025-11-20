import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.STOCK_HTTP_PORT || '3006', 10);
  
  // Increase payload size limit for image uploads (base64 can be ~33% larger)
  httpApp.use(bodyParser.json({ limit: '10mb' }));
  httpApp.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  
  const config = new DocumentBuilder()
    .setTitle('Stock API')
    .setDescription('Stock service endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(httpApp as any, config);
  SwaggerModule.setup('api/docs', httpApp as any, document);
  await httpApp.listen(httpPort);
  console.log(`📦 Stock HTTP on http://localhost:${httpPort}`);
  console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);

}

bootstrap();