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
exports.StockTransactionRef = exports.TransactionTypeRef = void 0;
const typeorm_1 = require("typeorm");
var TransactionTypeRef;
(function (TransactionTypeRef) {
    TransactionTypeRef["ENTRY"] = "entry";
    TransactionTypeRef["EXIT"] = "exit";
})(TransactionTypeRef || (exports.TransactionTypeRef = TransactionTypeRef = {}));
let StockTransactionRef = class StockTransactionRef {
};
exports.StockTransactionRef = StockTransactionRef;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], StockTransactionRef.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], StockTransactionRef.prototype, "stock_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: TransactionTypeRef }),
    __metadata("design:type", String)
], StockTransactionRef.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], StockTransactionRef.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150 }),
    __metadata("design:type", String)
], StockTransactionRef.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, nullable: true }),
    __metadata("design:type", Object)
], StockTransactionRef.prototype, "target", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], StockTransactionRef.prototype, "timestamp", void 0);
exports.StockTransactionRef = StockTransactionRef = __decorate([
    (0, typeorm_1.Entity)('stock_transactions')
], StockTransactionRef);
//# sourceMappingURL=stock-transaction-ref.entity.js.map