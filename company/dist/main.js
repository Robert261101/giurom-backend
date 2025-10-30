"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const httpApp = await core_1.NestFactory.create(app_module_1.AppModule);
    const httpPort = parseInt(process.env.PORT || '3003', 10);
    await httpApp.listen(httpPort);
    console.log(`🏢 Company HTTP listening on http://localhost:${httpPort}`);
}
bootstrap();
//# sourceMappingURL=main.js.map