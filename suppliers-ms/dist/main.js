"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const express_1 = require("express");
const http_exception_filter_1 = require("./common/http-exception.filter");
async function bootstrap() {
    const httpApp = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const httpPort = parseInt(process.env.PORT || '3007', 10);
    httpApp.useGlobalFilters(new http_exception_filter_1.AllExceptionsFilter());
    httpApp.use((req, _res, next) => {
        console.log(`[REQUEST] ${req.method} ${req.url}`);
        next();
    });
    httpApp.use((0, express_1.json)({ limit: '50mb' }));
    httpApp.use((0, express_1.urlencoded)({ extended: true, limit: '50mb' }));
    httpApp.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Suppliers API')
        .setDescription('Suppliers service endpoints')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(httpApp, config);
    swagger_1.SwaggerModule.setup('api/docs', httpApp, document);
    await httpApp.listen(httpPort);
    console.log(`📠 Suppliers HTTP on http://localhost:${httpPort}`);
    console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map