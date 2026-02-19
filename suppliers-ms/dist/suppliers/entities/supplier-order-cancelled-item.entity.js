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
exports.SupplierOrderCancelledItem = void 0;
const typeorm_1 = require("typeorm");
const supplier_order_entity_1 = require("./supplier-order.entity");
const supplier_order_item_entity_1 = require("./supplier-order-item.entity");
let SupplierOrderCancelledItem = class SupplierOrderCancelledItem {
};
exports.SupplierOrderCancelledItem = SupplierOrderCancelledItem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "supplier_order_item_id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "price_per_unit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "subtotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "received_quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "returned_quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierOrderCancelledItem.prototype, "return_reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrderCancelledItem.prototype, "reception_date", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierOrderCancelledItem.prototype, "reception_user_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrderCancelledItem.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierOrderCancelledItem.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_order_entity_1.SupplierOrder, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'order_id' }),
    __metadata("design:type", supplier_order_entity_1.SupplierOrder)
], SupplierOrderCancelledItem.prototype, "order", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_order_item_entity_1.SupplierOrderItem, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'supplier_order_item_id' }),
    __metadata("design:type", supplier_order_item_entity_1.SupplierOrderItem)
], SupplierOrderCancelledItem.prototype, "orderItem", void 0);
exports.SupplierOrderCancelledItem = SupplierOrderCancelledItem = __decorate([
    (0, typeorm_1.Entity)('supplier_order_cancelled_items')
], SupplierOrderCancelledItem);
//# sourceMappingURL=supplier-order-cancelled-item.entity.js.map