"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const httpPort = parseInt(process.env.PORT || '3014', 10);
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Waste Records API')
        .setDescription('Waste records service endpoints')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    await app.listen(httpPort);
    console.log(`🗑️ Waste Records HTTP on http://localhost:${httpPort}`);
    console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map