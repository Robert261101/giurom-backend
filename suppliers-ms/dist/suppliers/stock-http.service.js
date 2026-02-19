"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StockHttpService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockHttpService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let StockHttpService = StockHttpService_1 = class StockHttpService {
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        this.logger = new common_1.Logger(StockHttpService_1.name);
        this.stockServiceUrl = this.configService.get('STOCK_HTTP_URL') || 'http://localhost:3006';
        this.serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
    }
    async createStockItem(dto) {
        try {
            this.logger.log(`Creating stock item for product ${dto.product_id} with quantity ${dto.quantity}`);
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.post(`${this.stockServiceUrl}/stock/items`, dto, {
                headers: {
                    'x-internal-service': 'suppliers-ms',
                    'x-service-secret': this.serviceSecret,
                },
            }));
            this.logger.log(`Successfully created stock item with ID: ${response.data.id}`);
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to create stock item for product ${dto.product_id}:`, error?.message || error);
            if (error?.response) {
                this.logger.error(`Stock service responded with status ${error.response.status}:`, error.response.data);
            }
            return null;
        }
    }
    async createStockItems(items) {
        this.logger.log(`📦 [StockHttpService] Creating ${items.length} stock items in batch`);
        const results = [];
        for (const item of items) {
            this.logger.log(`📦 [StockHttpService] Processing stock item: product_id=${item.product_id}, quantity=${item.quantity}, price=${item.price}`);
            const result = await this.createStockItem(item);
            if (result) {
                this.logger.log(`✅ [StockHttpService] Successfully created stock item with ID: ${result.id}`);
                results.push(result);
            }
            else {
                this.logger.error(`❌ [StockHttpService] Failed to create stock item for product_id=${item.product_id}, quantity=${item.quantity}`);
            }
        }
        this.logger.log(`📦 [StockHttpService] Created ${results.length} out of ${items.length} stock items`);
        return results;
    }
    async healthCheck() {
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.stockServiceUrl}/stock/items`, {
                headers: {
                    'x-internal-service': 'suppliers-ms',
                    'x-service-secret': this.serviceSecret,
                },
            }));
            return response.status === 200;
        }
        catch (error) {
            this.logger.warn(`Stock service health check failed:`, error?.message || error);
            return false;
        }
    }
};
exports.StockHttpService = StockHttpService;
exports.StockHttpService = StockHttpService = StockHttpService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], StockHttpService);
//# sourceMappingURL=stock-http.service.js.map