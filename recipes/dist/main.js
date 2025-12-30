"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const path_1 = require("path");
const bodyParser = require("body-parser");
async function bootstrap() {
    const httpApp = await core_1.NestFactory.create(app_module_1.AppModule);
    const httpPort = parseInt(process.env.RECIPES_HTTP_PORT || '3005', 10);
    httpApp.use(bodyParser.json({ limit: '10mb' }));
    httpApp.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
    const filesDir = (0, path_1.join)(__dirname, '..', '..', '..', 'files');
    httpApp.useStaticAssets(filesDir, {
        prefix: '/files/',
    });
    const imagesDir = (0, path_1.join)(__dirname, '..', '..', '..', 'images');
    httpApp.useStaticAssets(imagesDir, {
        prefix: '/images/',
    });
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Recipes API')
        .setDescription('Recipes service endpoints')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(httpApp, config);
    swagger_1.SwaggerModule.setup('api/docs', httpApp, document);
    await httpApp.listen(httpPort);
    console.log(`🍲 Recipes HTTP on http://localhost:${httpPort}`);
    console.log(`📚 Swagger: http://localhost:${httpPort}/api/docs`);
    console.log(`📁 Static files served from: ${filesDir}`);
    console.log(`📷 Images served from: ${imagesDir}`);
}
bootstrap();
//# sourceMappingURL=main.js.map