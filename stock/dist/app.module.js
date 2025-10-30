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
const config_1 = require("@nestjs/config");
const path_1 = require("path");
const typeorm_1 = require("@nestjs/typeorm");
const product_entity_1 = require("./stock/entities/product.entity");
const stock_entity_1 = require("./stock/entities/stock.entity");
const stock_transaction_entity_1 = require("./stock/entities/stock-transaction.entity");
const waste_record_entity_1 = require("./stock/entities/waste-record.entity");
const category_entity_1 = require("./stock/entities/category.entity");
const stock_service_1 = require("./stock/stock.service");
const category_service_1 = require("./stock/category.service");
const stock_micro_controller_1 = require("./stock/stock.micro.controller");
const stock_http_controller_1 = require("./stock/stock.http.controller");
const category_controller_1 = require("./stock/category.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mariadb',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [product_entity_1.Product, stock_entity_1.Stock, stock_transaction_entity_1.StockTransaction, waste_record_entity_1.WasteRecord, category_entity_1.Category],
                synchronize: process.env.DB_SYNCHRONIZE === 'true',
                logging: process.env.DB_LOGGING === 'true',
                charset: 'utf8mb4',
                timezone: '+00:00',
                extra: {
                    connectionLimit: 10,
                    charset: 'utf8mb4',
                },
            }),
            typeorm_1.TypeOrmModule.forFeature([product_entity_1.Product, stock_entity_1.Stock, stock_transaction_entity_1.StockTransaction, waste_record_entity_1.WasteRecord, category_entity_1.Category]),
        ],
        controllers: [stock_micro_controller_1.StockMicroController, stock_http_controller_1.StockHttpController, category_controller_1.CategoryController],
        providers: [stock_service_1.StockService, category_service_1.CategoryService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map