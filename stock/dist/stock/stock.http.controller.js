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
exports.StockHttpController = void 0;
const common_1 = require("@nestjs/common");
const stock_service_1 = require("./stock.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const create_stock_dto_1 = require("./dto/create-stock.dto");
const update_stock_dto_1 = require("./dto/update-stock.dto");
const create_stock_transaction_dto_1 = require("./dto/create-stock-transaction.dto");
const create_waste_record_dto_1 = require("./dto/create-waste-record.dto");
const update_waste_record_dto_1 = require("./dto/update-waste-record.dto");
const assign_category_dto_1 = require("./dto/assign-category.dto");
let StockHttpController = class StockHttpController {
    constructor(service) {
        this.service = service;
    }
    createProduct(dto) { return this.service.createProduct(dto); }
    getProducts() { return this.service.findAllProducts(); }
    getProduct(id) { return this.service.findProduct(Number(id)); }
    updateProduct(id, dto) { return this.service.updateProduct(Number(id), dto); }
    deleteProduct(id) { return this.service.deleteProduct(Number(id)); }
    createStock(dto) { return this.service.createStock(dto); }
    getStocks() { return this.service.findAllStocks(); }
    getStock(id) { return this.service.findStock(Number(id)); }
    updateStock(id, dto) { return this.service.updateStock(Number(id), dto); }
    deleteStock(id) { return this.service.deleteStock(Number(id)); }
    createTx(dto) { return this.service.createTransaction(dto); }
    getTxs() { return this.service.findAllTransactions(); }
    consume(dto) {
        return this.service.consumeProduct(Number(dto.product_id), Number(dto.quantity), dto.target);
    }
    createWasteRecord(dto) { return this.service.createWasteRecord(dto); }
    getWasteRecords() { return this.service.findAllWasteRecords(); }
    getWasteRecord(id) { return this.service.findWasteRecord(Number(id)); }
    updateWasteRecord(id, dto) { return this.service.updateWasteRecord(Number(id), dto); }
    deleteWasteRecord(id) { return this.service.deleteWasteRecord(Number(id)); }
    getCategories() { return this.service.findAllCategories(); }
    getCategoriesByType(type) { return this.service.findCategoriesByType(type); }
    getProductsWithCategories() { return this.service.findProductsWithCategories(); }
    assignCategoriesToProduct(id, assignCategoryDto) {
        return this.service.assignCategoriesToProduct(Number(id), assignCategoryDto);
    }
};
exports.StockHttpController = StockHttpController;
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Get)('products'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "deleteProduct", null);
__decorate([
    (0, common_1.Post)('items'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_stock_dto_1.CreateStockDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "createStock", null);
__decorate([
    (0, common_1.Get)('items'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getStocks", null);
__decorate([
    (0, common_1.Get)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getStock", null);
__decorate([
    (0, common_1.Patch)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_stock_dto_1.UpdateStockDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "updateStock", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "deleteStock", null);
__decorate([
    (0, common_1.Post)('transactions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_stock_transaction_dto_1.CreateStockTransactionDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "createTx", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getTxs", null);
__decorate([
    (0, common_1.Post)('consume'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "consume", null);
__decorate([
    (0, common_1.Post)('waste-records'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_waste_record_dto_1.CreateWasteRecordDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "createWasteRecord", null);
__decorate([
    (0, common_1.Get)('waste-records'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getWasteRecords", null);
__decorate([
    (0, common_1.Get)('waste-records/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getWasteRecord", null);
__decorate([
    (0, common_1.Patch)('waste-records/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_waste_record_dto_1.UpdateWasteRecordDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "updateWasteRecord", null);
__decorate([
    (0, common_1.Delete)('waste-records/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "deleteWasteRecord", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('categories/type/:type'),
    __param(0, (0, common_1.Param)('type')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getCategoriesByType", null);
__decorate([
    (0, common_1.Get)('products-with-categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "getProductsWithCategories", null);
__decorate([
    (0, common_1.Post)('products/:id/categories'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_category_dto_1.AssignCategoryDto]),
    __metadata("design:returntype", void 0)
], StockHttpController.prototype, "assignCategoriesToProduct", null);
exports.StockHttpController = StockHttpController = __decorate([
    (0, common_1.Controller)('stock'),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockHttpController);
//# sourceMappingURL=stock.http.controller.js.map