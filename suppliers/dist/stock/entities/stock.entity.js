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
exports.Stock = exports.StockStatus = void 0;
const typeorm_1 = require("typeorm");
const product_entity_1 = require("./product.entity");
const stock_transaction_entity_1 = require("./stock-transaction.entity");
var StockStatus;
(function (StockStatus) {
    StockStatus["VALID"] = "valid";
    StockStatus["EXPIRED"] = "expired";
    StockStatus["BELOW_MINIMUM"] = "below_minimum";
})(StockStatus || (exports.StockStatus = StockStatus = {}));
let Stock = class Stock {
};
exports.Stock = Stock;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Stock.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Stock.prototype, "product_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Stock.prototype, "location_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Stock.prototype, "supplier_order_item_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Stock.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Stock.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Stock.prototype, "entry_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Stock.prototype, "expiration_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Stock.prototype, "last_update", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: StockStatus, default: StockStatus.VALID }),
    __metadata("design:type", String)
], Stock.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Stock.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], Stock.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.stocks, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], Stock.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => stock_transaction_entity_1.StockTransaction, (tx) => tx.stock),
    __metadata("design:type", Array)
], Stock.prototype, "transactions", void 0);
exports.Stock = Stock = __decorate([
    (0, typeorm_1.Entity)('stock')
], Stock);
//# sourceMappingURL=stock.entity.js.map