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
const axios_1 = require("@nestjs/axios");
const path_1 = require("path");
const typeorm_1 = require("@nestjs/typeorm");
const supplier_entity_1 = require("./suppliers/entities/supplier.entity");
const supplier_folder_entity_1 = require("./suppliers/entities/supplier-folder.entity");
const supplier_product_entity_1 = require("./suppliers/entities/supplier-product.entity");
const supplier_order_entity_1 = require("./suppliers/entities/supplier-order.entity");
const supplier_order_item_entity_1 = require("./suppliers/entities/supplier-order-item.entity");
const supplier_order_document_entity_1 = require("./suppliers/entities/supplier-order-document.entity");
const supplier_document_entity_1 = require("./suppliers/entities/supplier-document.entity");
const supplier_locations_entity_1 = require("./suppliers/entities/supplier-locations.entity");
const suppliers_service_1 = require("./suppliers/suppliers.service");
const stock_http_service_1 = require("./suppliers/stock-http.service");
const suppliers_micro_controller_1 = require("./suppliers.micro.controller");
const suppliers_http_controller_1 = require("./suppliers/suppliers.http.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: [(0, path_1.join)(__dirname, '..', '.env')] }),
            axios_1.HttpModule.register({
                timeout: 10000,
                maxRedirects: 5,
            }),
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mariadb',
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                entities: [
                    supplier_entity_1.Supplier,
                    supplier_folder_entity_1.SupplierFolder,
                    supplier_product_entity_1.SupplierProduct,
                    supplier_order_entity_1.SupplierOrder,
                    supplier_order_item_entity_1.SupplierOrderItem,
                    supplier_order_document_entity_1.SupplierOrderDocument,
                    supplier_document_entity_1.SupplierDocument,
                    supplier_locations_entity_1.SupplierLocations,
                    supplier_locations_entity_1.WorkLocation,
                ],
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
            typeorm_1.TypeOrmModule.forFeature([
                supplier_entity_1.Supplier,
                supplier_folder_entity_1.SupplierFolder,
                supplier_product_entity_1.SupplierProduct,
                supplier_order_entity_1.SupplierOrder,
                supplier_order_item_entity_1.SupplierOrderItem,
                supplier_order_document_entity_1.SupplierOrderDocument,
                supplier_document_entity_1.SupplierDocument,
                supplier_locations_entity_1.SupplierLocations,
                supplier_locations_entity_1.WorkLocation,
            ]),
        ],
        controllers: [suppliers_micro_controller_1.SuppliersMicroController, suppliers_http_controller_1.SuppliersHttpController],
        providers: [suppliers_service_1.SuppliersService, stock_http_service_1.StockHttpService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map