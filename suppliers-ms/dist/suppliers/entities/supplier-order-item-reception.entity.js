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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierOrderItemReception = exports.ReceptionStatus = void 0;
const typeorm_1 = require("typeorm");
const supplier_order_entity_1 = require("./supplier-order.entity");
var ReceptionStatus;
(function (ReceptionStatus) {
    ReceptionStatus["PENDING"] = "pending";
    ReceptionStatus["APPROVED"] = "approved";
    ReceptionStatus["REJECTED"] = "rejected";
})(ReceptionStatus || (exports.ReceptionStatus = ReceptionStatus = {}));
let SupplierOrderItemReception = class SupplierOrderItemReception {
};
exports.SupplierOrderItemReception = SupplierOrderItemReception;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "supplier_order_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_order_entity_1.SupplierOrder, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'supplier_order_id' }),
    __metadata("design:type", supplier_order_entity_1.SupplierOrder)
], SupplierOrderItemReception.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "supplier_order_item_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "received_delta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "returned_delta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierOrderItemReception.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrderItemReception.prototype, "occurred_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], SupplierOrderItemReception.prototype, "stock_item_id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ReceptionStatus,
        default: ReceptionStatus.PENDING
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], SupplierOrderItemReception.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrderItemReception.prototype, "created_at", void 0);
exports.SupplierOrderItemReception = SupplierOrderItemReception = __decorate([
    (0, typeorm_1.Entity)('supplier_order_item_receptions')
], SupplierOrderItemReception);
//# sourceMappingURL=supplier-order-item-reception.entity.js.map