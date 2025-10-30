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
exports.SupplierOrder = exports.OrderStatus = void 0;
const typeorm_1 = require("typeorm");
const supplier_entity_1 = require("./supplier.entity");
const supplier_order_item_entity_1 = require("./supplier-order-item.entity");
const supplier_order_document_entity_1 = require("./supplier-order-document.entity");
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["DRAFT"] = "draft";
    OrderStatus["SENT"] = "sent";
    OrderStatus["CONFIRMED"] = "confirmed";
    OrderStatus["CANCELLED"] = "cancelled";
    OrderStatus["DELIVERED"] = "delivered";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
let SupplierOrder = class SupplierOrder {
};
exports.SupplierOrder = SupplierOrder;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SupplierOrder.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrder.prototype, "supplier_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrder.prototype, "order_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrder.prototype, "delivery_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT }),
    __metadata("design:type", String)
], SupplierOrder.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SupplierOrder.prototype, "total_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierOrder.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrder.prototype, "created_by_user_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrder.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrder.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_entity_1.Supplier, (supplier) => supplier.orders, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'supplier_id' }),
    __metadata("design:type", supplier_entity_1.Supplier)
], SupplierOrder.prototype, "supplier", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => supplier_order_item_entity_1.SupplierOrderItem, (item) => item.order, { cascade: true }),
    __metadata("design:type", Array)
], SupplierOrder.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => supplier_order_document_entity_1.SupplierOrderDocument, (document) => document.order),
    __metadata("design:type", Array)
], SupplierOrder.prototype, "documents", void 0);
exports.SupplierOrder = SupplierOrder = __decorate([
    (0, typeorm_1.Entity)('supplier_orders')
], SupplierOrder);
//# sourceMappingURL=supplier-order.entity.js.map