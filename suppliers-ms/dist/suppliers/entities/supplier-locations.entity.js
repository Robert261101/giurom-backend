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
exports.SupplierLocations = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const supplier_entity_1 = require("./supplier.entity");
let SupplierLocations = class SupplierLocations {
};
exports.SupplierLocations = SupplierLocations;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al asocierii',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SupplierLocations.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul furnizorului',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierLocations.prototype, "supplier_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației',
        example: 2,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierLocations.prototype, "id_location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data creării asocierii',
        example: '2023-12-15T10:30:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierLocations.prototype, "created_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierLocations.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Furnizorul asociat',
        type: () => supplier_entity_1.Supplier,
    }),
    (0, typeorm_1.ManyToOne)(() => supplier_entity_1.Supplier, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'supplier_id' }),
    __metadata("design:type", supplier_entity_1.Supplier)
], SupplierLocations.prototype, "supplier", void 0);
exports.SupplierLocations = SupplierLocations = __decorate([
    (0, typeorm_1.Entity)('supplier_locations')
], SupplierLocations);
//# sourceMappingURL=supplier-locations.entity.js.map