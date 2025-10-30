"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const httpApp = await core_1.NestFactory.create(app_module_1.AppModule);
    const httpPort = parseInt(process.env.PORT || '3007', 10);
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