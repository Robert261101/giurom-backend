"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: ['http://localhost:3000', 'http://localhost:3001'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT || 3020;
    await app.listen(port);
    console.log(`🔔 Notifications Microservice is running on: http://localhost:${port}`);
    try {
        const microservice = await core_1.NestFactory.createMicroservice(app_module_1.AppModule, {
            transport: microservices_1.Transport.RMQ,
            options: {
                urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
                queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
                queueOptions: { durable: false },
            },
        });
        await microservice.listen();
        console.log(`🐰 RabbitMQ microservice is running on queue: notifications`);
    }
    catch (error) {
        console.log(`⚠️  RabbitMQ not available, running HTTP-only mode`);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map