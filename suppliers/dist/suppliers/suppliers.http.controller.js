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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersHttpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const suppliers_service_1 = require("./suppliers.service");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const create_supplier_with_documents_dto_1 = require("./dto/create-supplier-with-documents.dto");
const express_1 = require("express");
let SuppliersHttpController = class SuppliersHttpController {
    constructor(service) {
        this.service = service;
    }
    getSuppliers(_page, _limit, _search, _is_active) {
        return this.service.findAll();
    }
    create(dto) { return this.service.create(dto); }
    createWithDocs(dto) { return this.service.createWithDocuments(dto); }
    findOne(id) { return this.service.findOne(Number(id)); }
    update(id, dto) { return this.service.update(Number(id), dto); }
    remove(id) { return this.service.remove(Number(id)); }
    getProducts(supplierId) { return this.service.getSupplierProducts(Number(supplierId)); }
    addProduct(dto) { return this.service.addProduct(dto); }
    updateProduct(productId, dto) { return this.service.updateSupplierProduct(Number(productId), dto); }
    removeProduct(productId) { return this.service.removeSupplierProduct(Number(productId)); }
    getOrders(supplierId) { return this.service.getSupplierOrders(Number(supplierId)); }
    createOrder(dto) { return this.service.createOrder(dto); }
    deliver(orderId) { return this.service.markOrderAsDelivered(Number(orderId)); }
    updateStatus(orderId, body) { return this.service.updateOrderStatus(Number(orderId), body.status); }
    emailLink(supplierId, orderId) { return { emailLink: this.service.generateEmailLink(Number(supplierId), Number(orderId)) }; }
    whatsappLink(supplierId, orderId) { return { whatsappLink: this.service.generateWhatsAppLink(Number(supplierId), Number(orderId)) }; }
    addDocument(supplierId, body) { return this.service.addDocument(Number(supplierId), body); }
    removeDocument(documentId) { return this.service.removeDocument(Number(documentId)); }
    async getSupplierFile(fileId, download, res) {
        const forceDownload = download === 'true';
        const served = await this.service.serveDocument(fileId, forceDownload);
        const buffer = Buffer.from(served.data, 'base64');
        res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.send(buffer);
    }
    async viewSupplierFile(fileId, res) {
        const served = await this.service.serveDocument(fileId, false);
        const buffer = Buffer.from(served.data, 'base64');
        res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.send(buffer);
    }
    assignSupplierToLocation(supplierId, locationId) {
        return this.service.assignSupplierToLocation(Number(supplierId), Number(locationId));
    }
    findSupplierLocations(supplierId) {
        return this.service.findSupplierLocations(Number(supplierId));
    }
    findLocationSuppliers(locationId) {
        return this.service.findLocationSuppliers(Number(locationId));
    }
    removeSupplierFromLocation(supplierId, locationId) {
        return this.service.removeSupplierFromLocation(Number(supplierId), Number(locationId));
    }
};
exports.SuppliersHttpController = SuppliersHttpController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('is_active')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getSuppliers", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('with-documents'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_with_documents_dto_1.CreateSupplierWithDocumentsDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "createWithDocs", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':supplierId/products'),
    __param(0, (0, common_1.Param)('supplierId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)('products'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "addProduct", null);
__decorate([
    (0, common_1.Patch)('products/:productId'),
    __param(0, (0, common_1.Param)('productId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)('products/:productId'),
    __param(0, (0, common_1.Param)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeProduct", null);
__decorate([
    (0, common_1.Get)(':supplierId/orders'),
    __param(0, (0, common_1.Param)('supplierId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Patch)('orders/:orderId/deliver'),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "deliver", null);
__decorate([
    (0, common_1.Patch)('orders/:orderId/status'),
    __param(0, (0, common_1.Param)('orderId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Get)(':supplierId/orders/:orderId/email-link'),
    __param(0, (0, common_1.Param)('supplierId')),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "emailLink", null);
__decorate([
    (0, common_1.Get)(':supplierId/orders/:orderId/whatsapp-link'),
    __param(0, (0, common_1.Param)('supplierId')),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "whatsappLink", null);
__decorate([
    (0, common_1.Post)(':supplierId/documents'),
    __param(0, (0, common_1.Param)('supplierId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "addDocument", null);
__decorate([
    (0, common_1.Delete)('documents/:documentId'),
    __param(0, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeDocument", null);
__decorate([
    (0, common_1.Get)('file/:fileId'),
    __param(0, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('download')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, typeof (_a = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], SuppliersHttpController.prototype, "getSupplierFile", null);
__decorate([
    (0, common_1.Get)('file/:fileId/view'),
    __param(0, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, typeof (_b = typeof express_1.Response !== "undefined" && express_1.Response) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], SuppliersHttpController.prototype, "viewSupplierFile", null);
__decorate([
    (0, common_1.Post)(':supplierId/locations/:locationId'),
    (0, swagger_1.ApiOperation)({ summary: 'Atribuie un furnizor la o locație' }),
    (0, swagger_1.ApiParam)({ name: 'supplierId', description: 'ID-ul furnizorului' }),
    (0, swagger_1.ApiParam)({ name: 'locationId', description: 'ID-ul locației' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Furnizorul a fost atribuit cu succes la locație' }),
    __param(0, (0, common_1.Param)('supplierId')),
    __param(1, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "assignSupplierToLocation", null);
__decorate([
    (0, common_1.Get)(':supplierId/locations'),
    (0, swagger_1.ApiOperation)({ summary: 'Listă locațiile unui furnizor' }),
    (0, swagger_1.ApiParam)({ name: 'supplierId', description: 'ID-ul furnizorului' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista locațiilor furnizorului' }),
    __param(0, (0, common_1.Param)('supplierId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findSupplierLocations", null);
__decorate([
    (0, common_1.Get)('locations/:locationId/suppliers'),
    (0, swagger_1.ApiOperation)({ summary: 'Listă furnizorii unei locații' }),
    (0, swagger_1.ApiParam)({ name: 'locationId', description: 'ID-ul locației' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Lista furnizorilor locației' }),
    __param(0, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findLocationSuppliers", null);
__decorate([
    (0, common_1.Delete)(':supplierId/locations/:locationId'),
    (0, swagger_1.ApiOperation)({ summary: 'Îndepărtează un furnizor dintr-o locație' }),
    (0, swagger_1.ApiParam)({ name: 'supplierId', description: 'ID-ul furnizorului' }),
    (0, swagger_1.ApiParam)({ name: 'locationId', description: 'ID-ul locației' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Furnizorul a fost îndepărtat cu succes din locație' }),
    __param(0, (0, common_1.Param)('supplierId')),
    __param(1, (0, common_1.Param)('locationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeSupplierFromLocation", null);
exports.SuppliersHttpController = SuppliersHttpController = __decorate([
    (0, swagger_1.ApiTags)('suppliers'),
    (0, common_1.Controller)('suppliers'),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersHttpController);
//# sourceMappingURL=suppliers.http.controller.js.map