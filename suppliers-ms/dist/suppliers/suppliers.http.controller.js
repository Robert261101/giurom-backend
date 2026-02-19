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
var SuppliersHttpController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuppliersHttpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const suppliers_service_1 = require("./suppliers.service");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const create_supplier_with_documents_dto_1 = require("./dto/create-supplier-with-documents.dto");
const approve_reception_dto_1 = require("./dto/approve-reception.dto");
const cancel_remaining_dto_1 = require("./dto/cancel-remaining.dto");
const cancel_order_items_dto_1 = require("./dto/cancel-order-items.dto");
const permissions_decorator_1 = require("../permissions/permissions.decorator");
const permissions_guard_1 = require("../permissions/permissions.guard");
let SuppliersHttpController = SuppliersHttpController_1 = class SuppliersHttpController {
    constructor(service) {
        this.service = service;
        this.logger = new common_1.Logger(SuppliersHttpController_1.name);
    }
    getSuppliers(_page, _limit, _search, _is_active, location_id, req) {
        let locationId;
        const maybeLid = location_id ? parseInt(location_id, 10) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            locationId = maybeLid;
        }
        else {
            const user = req?.user;
            locationId = user?.work_location_id || user?.work_location_default_id;
        }
        if (!locationId) {
            throw new common_1.BadRequestException("Parametrul location_id este obligatoriu pentru a obține furnizorii");
        }
        return this.service.findAll(locationId);
    }
    getSuppliersForOrders(location_id) {
        const locationId = location_id ? parseInt(location_id, 10) : undefined;
        return this.service.findForOrders(locationId);
    }
    create(dto, req) {
        const user = req?.user;
        const location_id = user?.work_location_id || user?.work_location_default_id;
        if (!location_id) {
            throw new common_1.BadRequestException("Nu se poate crea un furnizor fără o locație asignată. Vă rugăm să selectați o locație.");
        }
        return this.service.create(dto, location_id);
    }
    createWithDocs(dto) {
        return this.service.createWithDocuments(dto);
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
    findOne(id, location_id, req) {
        this.logger.log(`[DOCUMENTE] GET /suppliers/${id} ?location_id=${location_id}`);
        let locationId;
        const maybeLid = location_id ? parseInt(location_id, 10) : undefined;
        if (Number.isFinite(maybeLid) && maybeLid > 0) {
            locationId = maybeLid;
        }
        else {
            const user = req?.user;
            locationId = user?.work_location_id || user?.work_location_default_id;
        }
        return this.service.findOne(Number(id), locationId);
    }
    update(id, dto) {
        return this.service.update(Number(id), dto);
    }
    remove(id) {
        return this.service.remove(Number(id));
    }
    getProducts(supplierId) {
        return this.service.getSupplierProducts(Number(supplierId));
    }
    addProduct(dto) {
        return this.service.addProduct(dto);
    }
    updateProduct(productId, dto) {
        return this.service.updateSupplierProduct(Number(productId), dto);
    }
    removeProduct(productId) {
        return this.service.removeSupplierProduct(Number(productId));
    }
    getOrders(supplierId, location_id) {
        const locationId = location_id ? parseInt(location_id, 10) : undefined;
        return this.service.getSupplierOrders(Number(supplierId), locationId);
    }
    getOrdersBatch(supplierIdsRaw, dateFrom, dateTo, location_id) {
        if (!supplierIdsRaw) {
            return [];
        }
        const supplierIds = supplierIdsRaw
            .split(",")
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => Number.isFinite(id));
        if (supplierIds.length === 0) {
            return [];
        }
        const locationId = location_id ? parseInt(location_id, 10) : undefined;
        return this.service.getSupplierOrdersBatch(supplierIds, {
            dateFrom,
            dateTo,
            locationId,
        });
    }
    createOrder(dto) {
        return this.service.createOrder(dto);
    }
    deliver(orderId) {
        return this.service.markOrderAsDelivered(Number(orderId));
    }
    partialReception(dto) {
        return this.service.markOrderAsPartiallyReceived(dto);
    }
    approveReceptions(dto) {
        return this.service.approveReceptions(dto.orderId, dto.receptionIds);
    }
    rejectReceptions(dto) {
        return this.service.rejectReceptions(dto.orderId, dto.receptionIds, dto.reason);
    }
    getReceptionReport(startDate, endDate) {
        if (!startDate || !endDate) {
            throw new Error("start_date și end_date sunt obligatorii");
        }
        return this.service.getReceptionReport(startDate, endDate);
    }
    getReceptionEvents(startDate, endDate, orderId, orderItemId, productId, userId) {
        if (!startDate || !endDate) {
            throw new Error("start_date și end_date sunt obligatorii");
        }
        return this.service.getReceptionEvents(startDate, endDate, orderId ? Number(orderId) : undefined, orderItemId ? Number(orderItemId) : undefined, productId ? Number(productId) : undefined, userId ? Number(userId) : undefined);
    }
    getOrderReceptionsBatch(orderIdsRaw) {
        if (!orderIdsRaw) {
            return [];
        }
        const orderIds = orderIdsRaw
            .split(",")
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => Number.isFinite(id));
        if (orderIds.length === 0) {
            return [];
        }
        return this.service.getOrderReceptionsBatch(orderIds);
    }
    getOrderReceptions(orderId) {
        return this.service.getOrderReceptions(Number(orderId));
    }
    getOrderCancelledItems(orderId) {
        return this.service.getOrderCancelledItems(Number(orderId));
    }
    getOrderCancelledItemsBatch(orderIdsRaw) {
        if (!orderIdsRaw) {
            return [];
        }
        const orderIds = orderIdsRaw
            .split(",")
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => Number.isFinite(id));
        if (orderIds.length === 0) {
            return [];
        }
        return this.service.getOrderCancelledItemsBatch(orderIds);
    }
    updateStatus(orderId, body) {
        return this.service.updateOrderStatus(Number(orderId), body.status);
    }
    cancelRemaining(orderId, dto) {
        return this.service.cancelRemainingQuantity(Number(orderId), dto.reason);
    }
    cancelOrderItems(dto) {
        return this.service.cancelOrderItems(dto);
    }
    emailLink(supplierId, orderId) {
        return {
            emailLink: this.service.generateEmailLink(Number(supplierId), Number(orderId)),
        };
    }
    whatsappLink(supplierId, orderId) {
        return {
            whatsappLink: this.service.generateWhatsAppLink(Number(supplierId), Number(orderId)),
        };
    }
    addDocument(supplierId, body) {
        if (!body || typeof body !== 'object') {
            throw new common_1.BadRequestException('Body invalid sau lipsă (verifică că request-ul este JSON cu Content-Type: application/json).');
        }
        return this.service.addDocument(Number(supplierId), body);
    }
    createFolder(supplierId, body, location_id) {
        const locationId = location_id ? parseInt(location_id, 10) : undefined;
        return this.service.createFolder(Number(supplierId), body || {}, locationId);
    }
    updateFolder(supplierId, folderId, body) {
        return this.service.updateFolder(Number(supplierId), Number(folderId), body || {});
    }
    removeFolder(supplierId, folderId) {
        return this.service.removeFolder(Number(supplierId), Number(folderId));
    }
    syncFolderFromDisk(supplierId, folderId) {
        this.logger.log(`[DOCUMENTE] POST /suppliers/${supplierId}/folders/${folderId}/sync-from-disk`);
        return this.service.syncFolderFromDisk(Number(supplierId), Number(folderId));
    }
    removeDocument(documentId) {
        return this.service.removeDocument(Number(documentId));
    }
    async getSupplierFile(fileId, download, res) {
        const forceDownload = download === "true";
        const served = await this.service.serveDocument(fileId, forceDownload);
        const buffer = Buffer.from(served.data, "base64");
        res.setHeader("Content-Type", served.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `${forceDownload || served.disposition === "attachment" ? "attachment" : "inline"}; filename="${served.fileName}"`);
        res.setHeader("Content-Length", buffer.length.toString());
        return res.send(buffer);
    }
    async viewSupplierFile(fileId, res) {
        const served = await this.service.serveDocument(fileId, false);
        const buffer = Buffer.from(served.data, "base64");
        res.setHeader("Content-Type", served.mimeType || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${served.fileName}"`);
        res.setHeader("Content-Length", buffer.length.toString());
        return res.send(buffer);
    }
    getExpiringDocuments(targetDate) {
        return this.service.findExpiringDocuments(targetDate);
    }
    getExpiredDocuments() {
        return this.service.findExpiredDocuments();
    }
};
exports.SuppliersHttpController = SuppliersHttpController;
__decorate([
    (0, common_1.Get)(),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Query)("page")),
    __param(1, (0, common_1.Query)("limit")),
    __param(2, (0, common_1.Query)("search")),
    __param(3, (0, common_1.Query)("is_active")),
    __param(4, (0, common_1.Query)("location_id")),
    __param(5, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getSuppliers", null);
__decorate([
    (0, common_1.Get)("for-orders"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    __param(0, (0, common_1.Query)("location_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getSuppliersForOrders", null);
__decorate([
    (0, common_1.Post)(),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_dto_1.CreateSupplierDto, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Post)("with-documents"),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_with_documents_dto_1.CreateSupplierWithDocumentsDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "createWithDocs", null);
__decorate([
    (0, common_1.Post)(":supplierId/locations/:locationId"),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    (0, swagger_1.ApiOperation)({ summary: "Atribuie un furnizor la o locație" }),
    (0, swagger_1.ApiParam)({ name: "supplierId", description: "ID-ul furnizorului" }),
    (0, swagger_1.ApiParam)({ name: "locationId", description: "ID-ul locației" }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: "Furnizorul a fost atribuit cu succes la locație",
    }),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("locationId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "assignSupplierToLocation", null);
__decorate([
    (0, common_1.Get)(":supplierId/locations"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    (0, swagger_1.ApiOperation)({ summary: "Listă locațiile unui furnizor" }),
    (0, swagger_1.ApiParam)({ name: "supplierId", description: "ID-ul furnizorului" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Lista locațiilor furnizorului" }),
    __param(0, (0, common_1.Param)("supplierId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findSupplierLocations", null);
__decorate([
    (0, common_1.Get)("locations/:locationId/suppliers"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    (0, swagger_1.ApiOperation)({ summary: "Listă furnizorii unei locații" }),
    (0, swagger_1.ApiParam)({ name: "locationId", description: "ID-ul locației" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: "Lista furnizorilor locației" }),
    __param(0, (0, common_1.Param)("locationId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findLocationSuppliers", null);
__decorate([
    (0, common_1.Delete)(":supplierId/locations/:locationId"),
    (0, permissions_decorator_1.Permissions)("suppliers.delete"),
    (0, swagger_1.ApiOperation)({ summary: "Îndepărtează un furnizor dintr-o locație" }),
    (0, swagger_1.ApiParam)({ name: "supplierId", description: "ID-ul furnizorului" }),
    (0, swagger_1.ApiParam)({ name: "locationId", description: "ID-ul locației" }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: "Furnizorul a fost îndepărtat cu succes din locație",
    }),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("locationId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeSupplierFromLocation", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("location_id")),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, permissions_decorator_1.Permissions)("suppliers.update"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, permissions_decorator_1.Permissions)("suppliers.delete"),
    __param(0, (0, common_1.Param)("id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(":supplierId/products"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("supplierId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getProducts", null);
__decorate([
    (0, common_1.Post)("products"),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "addProduct", null);
__decorate([
    (0, common_1.Patch)("products/:productId"),
    (0, permissions_decorator_1.Permissions)("suppliers.update"),
    __param(0, (0, common_1.Param)("productId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Delete)("products/:productId"),
    (0, permissions_decorator_1.Permissions)("suppliers.delete"),
    __param(0, (0, common_1.Param)("productId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeProduct", null);
__decorate([
    (0, common_1.Get)(":supplierId/orders"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Query)("location_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrders", null);
__decorate([
    (0, common_1.Get)("orders/batch"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    __param(0, (0, common_1.Query)("supplier_ids")),
    __param(1, (0, common_1.Query)("date_from")),
    __param(2, (0, common_1.Query)("date_to")),
    __param(3, (0, common_1.Query)("location_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrdersBatch", null);
__decorate([
    (0, common_1.Post)("orders"),
    (0, permissions_decorator_1.Permissions)("order.create"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Patch)("orders/:orderId/deliver"),
    (0, permissions_decorator_1.Permissions)("order.update"),
    __param(0, (0, common_1.Param)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "deliver", null);
__decorate([
    (0, common_1.Post)("orders/partial-reception"),
    (0, permissions_decorator_1.Permissions)("order.reception"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "partialReception", null);
__decorate([
    (0, common_1.Post)("orders/receptions/approve"),
    (0, permissions_decorator_1.Permissions)("order.approve"),
    (0, swagger_1.ApiOperation)({ summary: "Aprobă recepțiile și creează stock items" }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [approve_reception_dto_1.ApproveReceptionDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "approveReceptions", null);
__decorate([
    (0, common_1.Post)("orders/receptions/reject"),
    (0, permissions_decorator_1.Permissions)("order.approve"),
    (0, swagger_1.ApiOperation)({ summary: "Respinge recepțiile" }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [approve_reception_dto_1.RejectReceptionDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "rejectReceptions", null);
__decorate([
    (0, common_1.Get)("orders/reception-report"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({ summary: "Raport recepții și returnări pe perioadă" }),
    __param(0, (0, common_1.Query)("start_date")),
    __param(1, (0, common_1.Query)("end_date")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getReceptionReport", null);
__decorate([
    (0, common_1.Get)("orders/reception-report/events"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({
        summary: "Evenimente individuale de recepție/returnare pe perioadă (cronologic)",
    }),
    __param(0, (0, common_1.Query)("start_date")),
    __param(1, (0, common_1.Query)("end_date")),
    __param(2, (0, common_1.Query)("order_id")),
    __param(3, (0, common_1.Query)("order_item_id")),
    __param(4, (0, common_1.Query)("product_id")),
    __param(5, (0, common_1.Query)("user_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getReceptionEvents", null);
__decorate([
    (0, common_1.Get)("orders/receptions/batch"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({
        summary: "Obține recepțiile pentru mai multe comenzi (batch)",
    }),
    (0, swagger_1.ApiQuery)({
        name: "order_ids",
        required: true,
        description: "Lista de ID-uri de comenzi, separate prin virgulă (ex: 1,2,3)",
    }),
    __param(0, (0, common_1.Query)("order_ids")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrderReceptionsBatch", null);
__decorate([
    (0, common_1.Get)("orders/:orderId/receptions"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({ summary: "Obține recepțiile pentru o comandă" }),
    __param(0, (0, common_1.Param)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrderReceptions", null);
__decorate([
    (0, common_1.Get)("orders/:orderId/cancelled-items"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({ summary: "Obține item-urile anulate pentru o comandă" }),
    __param(0, (0, common_1.Param)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrderCancelledItems", null);
__decorate([
    (0, common_1.Get)("orders/cancelled-items/batch"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    (0, swagger_1.ApiOperation)({
        summary: "Obține item-urile anulate pentru mai multe comenzi (batch)",
    }),
    __param(0, (0, common_1.Query)("order_ids")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getOrderCancelledItemsBatch", null);
__decorate([
    (0, common_1.Patch)("orders/:orderId/status"),
    (0, permissions_decorator_1.Permissions)("order.update"),
    __param(0, (0, common_1.Param)("orderId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)("orders/:orderId/cancel-remaining"),
    (0, permissions_decorator_1.Permissions)("order.cancel"),
    (0, swagger_1.ApiOperation)({
        summary: "[DEPRECATED] Anulează partea rămasă de recepționat pentru o comandă",
    }),
    __param(0, (0, common_1.Param)("orderId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, cancel_remaining_dto_1.CancelRemainingDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "cancelRemaining", null);
__decorate([
    (0, common_1.Post)("orders/cancel-items"),
    (0, permissions_decorator_1.Permissions)("order.cancel"),
    (0, swagger_1.ApiOperation)({
        summary: "Anulează item-uri dintr-o comandă (nouă abordare)",
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [cancel_order_items_dto_1.CancelOrderItemsDto]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "cancelOrderItems", null);
__decorate([
    (0, common_1.Get)(":supplierId/orders/:orderId/email-link"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "emailLink", null);
__decorate([
    (0, common_1.Get)(":supplierId/orders/:orderId/whatsapp-link"),
    (0, permissions_decorator_1.Permissions)("order.read"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("orderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "whatsappLink", null);
__decorate([
    (0, common_1.Post)(":supplierId/documents"),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "addDocument", null);
__decorate([
    (0, common_1.Post)(":supplierId/folders"),
    (0, permissions_decorator_1.Permissions)("suppliers.create"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)("location_id")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "createFolder", null);
__decorate([
    (0, common_1.Patch)(":supplierId/folders/:folderId"),
    (0, permissions_decorator_1.Permissions)("suppliers.update"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("folderId")),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "updateFolder", null);
__decorate([
    (0, common_1.Delete)(":supplierId/folders/:folderId"),
    (0, permissions_decorator_1.Permissions)("suppliers.delete"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("folderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeFolder", null);
__decorate([
    (0, common_1.Post)(":supplierId/folders/:folderId/sync-from-disk"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("supplierId")),
    __param(1, (0, common_1.Param)("folderId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "syncFolderFromDisk", null);
__decorate([
    (0, common_1.Delete)("documents/:documentId"),
    (0, permissions_decorator_1.Permissions)("suppliers.delete"),
    __param(0, (0, common_1.Param)("documentId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "removeDocument", null);
__decorate([
    (0, common_1.Get)("file/:fileId"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("fileId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)("download")),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], SuppliersHttpController.prototype, "getSupplierFile", null);
__decorate([
    (0, common_1.Get)("file/:fileId/view"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("fileId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SuppliersHttpController.prototype, "viewSupplierFile", null);
__decorate([
    (0, common_1.Get)("documents/expiring/:targetDate"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __param(0, (0, common_1.Param)("targetDate")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getExpiringDocuments", null);
__decorate([
    (0, common_1.Get)("documents/expired"),
    (0, permissions_decorator_1.Permissions)("suppliers.read"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SuppliersHttpController.prototype, "getExpiredDocuments", null);
exports.SuppliersHttpController = SuppliersHttpController = SuppliersHttpController_1 = __decorate([
    (0, swagger_1.ApiTags)("suppliers"),
    (0, common_1.Controller)("suppliers"),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [suppliers_service_1.SuppliersService])
], SuppliersHttpController);
//# sourceMappingURL=suppliers.http.controller.js.map