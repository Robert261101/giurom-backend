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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const stock_service_1 = require("./stock.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const create_stock_dto_1 = require("./dto/create-stock.dto");
const create_stock_transaction_dto_1 = require("./dto/create-stock-transaction.dto");
let StockMicroController = class StockMicroController {
    constructor(stockService) {
        this.stockService = stockService;
    }
    createProduct(dto) { return this.stockService.createProduct(dto); }
    findAllProducts() { return this.stockService.findAllProducts(); }
    findProduct(id) { return this.stockService.findProduct(id); }
    updateProduct(payload) { return this.stockService.updateProduct(payload.id, payload.dto); }
    deleteProduct(id) { return this.stockService.deleteProduct(id); }
    createStock(dto) { return this.stockService.createStock(dto); }
    findAllStocks() { return this.stockService.findAllStocks(); }
    findStock(id) { return this.stockService.findStock(id); }
    updateStock(payload) { return this.stockService.updateStock(payload.id, payload.dto); }
    deleteStock(id) { return this.stockService.deleteStock(id); }
    createTransaction(dto) { return this.stockService.createTransaction(dto); }
    findAllTransactions() { return this.stockService.findAllTransactions(); }
};
exports.StockMicroController = StockMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('stock.products.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "createProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.products.findAll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "findAllProducts", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.products.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "findProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.products.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "updateProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.products.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "deleteProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.items.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_stock_dto_1.CreateStockDto]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "createStock", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.items.findAll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "findAllStocks", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.items.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "findStock", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.items.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "updateStock", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.items.delete'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "deleteStock", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.transactions.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_stock_transaction_dto_1.CreateStockTransactionDto]),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "createTransaction", null);
__decorate([
    (0, microservices_1.MessagePattern)('stock.transactions.findAll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockMicroController.prototype, "findAllTransactions", null);
exports.StockMicroController = StockMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockMicroController);
//# sourceMappingURL=stock.micro.controller.js.map