import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const httpApp = await NestFactory.create(AppModule, { bodyParser: false });
  const httpPort = parseInt(process.env.PORT || '3007', 10);

  httpApp.useGlobalFilters(new AllExceptionsFilter());

  // Log fiecare request (method + path) ca să vezi ce ajunge la suppliers-ms
  httpApp.use((req: any, _res: any, next: any) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // Limită body 50mb (implicit Express ~100KB dă 413) – pentru upload documente cu base64 (ex. furnizori)
  httpApp.use(json({ limit: '50mb' }));
  httpApp.use(urlencoded({ extended: true, limit: '50mb' }));

  // CORS pentru upload direct din frontend (ex. localhost:3000) – evită 413 la proxy Next.js
  httpApp.enableCors({
    origin: true, // acceptă orice origin (dev); în producție poți restricționa la domeniul frontend-ului
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
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


