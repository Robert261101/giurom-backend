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
exports.StockTransaction = exports.TransactionType = void 0;
const typeorm_1 = require("typeorm");
const stock_entity_1 = require("./stock.entity");
var TransactionType;
(function (TransactionType) {
    TransactionType["ENTRY"] = "entry";
    TransactionType["EXIT"] = "exit";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
let StockTransaction = class StockTransaction {
};
exports.StockTransaction = StockTransaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], StockTransaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StockTransaction.prototype, "stock_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: TransactionType }),
    __metadata("design:type", String)
], StockTransaction.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], StockTransaction.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], StockTransaction.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], StockTransaction.prototype, "target", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], StockTransaction.prototype, "timestamp", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => stock_entity_1.Stock, (stock) => stock.transactions, { onDelete: 'CASCADE', onUpdate: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'stock_id' }),
    __metadata("design:type", stock_entity_1.Stock)
], StockTransaction.prototype, "stock", void 0);
exports.StockTransaction = StockTransaction = __decorate([
    (0, typeorm_1.Entity)('stock_transactions')
], StockTransaction);
//# sourceMappingURL=stock-transaction.entity.js.map