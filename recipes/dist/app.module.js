"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const microservices_1 = require("@nestjs/microservices");
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const typeorm_1 = require("@nestjs/typeorm");
const axios_1 = require("@nestjs/axios");
const recipe_entity_1 = require("./recipes/entities/recipe.entity");
const recipe_category_entity_1 = require("./recipes/entities/recipe-category.entity");
const recipe_product_entity_1 = require("./recipes/entities/recipe-product.entity");
const recipe_preparation_entity_1 = require("./recipes/entities/recipe-preparation.entity");
const recipe_label_entity_1 = require("./recipes/entities/recipe-label.entity");
const recipe_media_entity_1 = require("./recipes/entities/recipe-media.entity");
const recipes_service_1 = require("./recipes/recipes.service");
const recipes_media_service_1 = require("./recipes/recipes-media.service");
const stock_ref_entity_1 = require("./external/stock-ref.entity");
const stock_transaction_ref_entity_1 = require("./external/stock-transaction-ref.entity");
const recipes_micro_controller_1 = require("./recipes.micro.controller");
const recipes_http_controller_1 = require("./recipes.http.controller");
const recipes_preparations_service_1 = require("./recipes/recipes-preparations.service");
const recipes_labels_service_1 = require("./recipes/recipes-labels.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            schedule_1.ScheduleModule.forRoot(),
            microservices_1.ClientsModule.register([
                {
                    name: 'NOTIFICATIONS_RMQ',
                    transport: microservices_1.Transport.RMQ,
                    options: {
                        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
                        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
                        queueOptions: { durable: false },
                    },
                },
            ]),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mariadb',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [recipe_entity_1.Recipe, recipe_category_entity_1.RecipeCategory, recipe_product_entity_1.RecipeProduct, recipe_preparation_entity_1.RecipePreparation, recipe_label_entity_1.RecipeLabel, recipe_media_entity_1.RecipeMedia, stock_ref_entity_1.StockRef, stock_transaction_ref_entity_1.StockTransactionRef],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
                timezone: '+00:00',
                extra: {
                    connectionLimit: 10,
                    acquireTimeout: 60000,
                    timeout: 60000,
                    reconnect: true,
                    charset: 'utf8mb4',
                    initStatements: [
                        "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
                        'SET CHARACTER SET utf8mb4',
                        'SET character_set_connection=utf8mb4',
                    ],
                },
            }),
            typeorm_1.TypeOrmModule.forFeature([recipe_entity_1.Recipe, recipe_category_entity_1.RecipeCategory, recipe_product_entity_1.RecipeProduct, recipe_preparation_entity_1.RecipePreparation, recipe_label_entity_1.RecipeLabel, recipe_media_entity_1.RecipeMedia, stock_ref_entity_1.StockRef, stock_transaction_ref_entity_1.StockTransactionRef]),
        ],
        controllers: [recipes_micro_controller_1.RecipesMicroController, recipes_http_controller_1.RecipesHttpController],
        providers: [recipes_service_1.RecipesService, recipes_media_service_1.RecipeMediaService, recipes_preparations_service_1.RecipePreparationsService, recipes_labels_service_1.RecipesLabelsService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map