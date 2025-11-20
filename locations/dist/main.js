"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const httpApp = await core_1.NestFactory.create(app_module_1.AppModule);
    httpApp.enableCors({
        origin: [
            'http://localhost:3000',
            'http://localhost:3001',
            'https://giurom-frontend.vercel.app'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    const httpPort = parseInt(process.env.LOCATIONS_HTTP_PORT || '3004', 10);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Locations API')
        .setDescription('Locations service endpoints')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(httpApp, config);
    swagger_1.SwaggerModule.setup('api/docs', httpApp, document);
    await httpApp.listen(httpPort);
    console.log(`📍 Locations HTTP on http://localhost:${httpPort}`);
    console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map