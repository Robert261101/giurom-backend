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
exports.SuppliersMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const suppliers_service_1 = require("./suppliers/suppliers.service");
const create_supplier_product_dto_1 = require("./suppliers/dto/create-supplier-product.dto");
const create_supplier_order_dto_1 = require("./suppliers/dto/create-supplier-order.dto");
let SuppliersMicroController = class SuppliersMicroController {
    constructor(service) {
        this.service = service;
    }
    create(payload) {
        if ('dto' in payload) {
            return this.service.create(payload.dto, payload.location_id);
        }
        return this.service.create(payload, undefined);
    }
    createWithDocuments(payload) {
        if ('dto' in payload) {
            return this.service.createWithDocuments(payload.dto, payload.location_id);
        }
        return this.service.createWithDocuments(payload, undefined);
    }
    findAll(payload) {
        let locationId;
        if (typeof payload === 'number') {
            locationId = payload;
        }
        else {
            locationId = payload.location_id;
        }
        if (!locationId) {
            throw new Error('location_id is required for suppliers.findAll');
        }
        return this.service.findAll(locationId);
    }
    findOne(payload) {
        if (typeof payload === 'number') {
            return this.service.findOne(payload, undefined);
        }
        return this.service.findOne(payload.id, payload.location_id);
    }
    update(payload) { return this.service.update(payload.id, payload.dto); }
    remove(id) { return this.service.remove(id); }
    addProduct(dto) { return this.service.addProduct(dto); }
    getSupplierProducts(supplierId) { return this.service.getSupplierProducts(supplierId); }
    updateSupplierProduct(payload) { return this.service.updateSupplierProduct(payload.productId, payload.dto); }
    removeSupplierProduct(productId) { return this.service.removeSupplierProduct(productId); }
    createOrder(dto) { return this.service.createOrder(dto); }
    getSupplierOrders(supplierId) { return this.service.getSupplierOrders(supplierId); }
    markOrderAsDelivered(orderId) { return this.service.markOrderAsDelivered(orderId); }
    updateOrderStatus(payload) { return this.service.updateOrderStatus(payload.orderId, payload.status); }
    addDocument(payload) {
        return this.service.addDocument(payload.supplierId, payload.documentData);
    }
    removeDocument(documentId) { return this.service.removeDocument(documentId); }
    findDocumentById(id) { return this.service['supplierDocumentRepo'].findOne({ where: { id } }); }
    serveDocument(payload) { return this.service.serveDocument(payload.file_id, !!payload.forceDownload); }
    emailLink(payload) { return { emailLink: this.service.generateEmailLink(payload.supplierId, payload.orderId) }; }
    whatsappLink(payload) { return { whatsappLink: this.service.generateWhatsAppLink(payload.supplierId, payload.orderId, payload.pdfUrl) }; }
};
exports.SuppliersMicroController = SuppliersMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "create", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.createWithDocuments'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "createWithDocuments", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "findAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "findOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "update", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "remove", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.products.add'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_product_dto_1.CreateSupplierProductDto]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "addProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.products.findBySupplier'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "getSupplierProducts", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.products.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "updateSupplierProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.products.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "removeSupplierProduct", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_order_dto_1.CreateSupplierOrderDto]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "createOrder", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.findBySupplier'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "getSupplierOrders", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.deliver'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "markOrderAsDelivered", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.updateStatus'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "updateOrderStatus", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.documents.add'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "addDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.documents.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "removeDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.documents.findById'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "findDocumentById", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.files.serveDocument'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "serveDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.emailLink'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "emailLink", null);
__decorate([
    (0, microservices_1.MessagePattern)('suppliers.orders.whatsappLink'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersMicroController.prototype, "whatsappLink", null);
exports.SuppliersMicroController = SuppliersMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersMicroController);
//# sourceMappingURL=suppliers.micro.controller.js.map