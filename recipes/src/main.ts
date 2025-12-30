import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule);
  const httpPort = parseInt(process.env.RECIPES_HTTP_PORT || '3005', 10);
  
  // Increase payload size limit for file uploads
  httpApp.use(bodyParser.json({ limit: '10mb' }));
  httpApp.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  
  // Serve static files from the files directory (in the project root, not in backend)
  const filesDir = join(__dirname, '..', '..', '..', 'files');
  (httpApp as any).useStaticAssets(filesDir, {
    prefix: '/files/',
  });
  
  // Serve images from the images directory (products, waste, consume)
  const imagesDir = join(__dirname, '..', '..', '..', 'images');
  (httpApp as any).useStaticAssets(imagesDir, {
    prefix: '/images/',
  });
  
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
  console.log(`📁 Static files served from: ${filesDir}`);
  console.log(`📷 Images served from: ${imagesDir}`);

}

bootstrap();