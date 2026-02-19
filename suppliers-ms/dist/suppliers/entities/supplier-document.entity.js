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
exports.SupplierDocument = exports.DocumentType = void 0;
const typeorm_1 = require("typeorm");
const supplier_folder_entity_1 = require("./supplier-folder.entity");
var DocumentType;
(function (DocumentType) {
    DocumentType["CONTRACT"] = "contract";
    DocumentType["INVOICE"] = "invoice";
    DocumentType["CERTIFICATE"] = "certificate";
    DocumentType["ORDER"] = "order";
    DocumentType["OTHER"] = "other";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
let SupplierDocument = class SupplierDocument {
};
exports.SupplierDocument = SupplierDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SupplierDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], SupplierDocument.prototype, "folder_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: DocumentType }),
    __metadata("design:type", String)
], SupplierDocument.prototype, "document_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierDocument.prototype, "file_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierDocument.prototype, "file_path", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true, default: null }),
    __metadata("design:type", Object)
], SupplierDocument.prototype, "expire_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }),
    __metadata("design:type", String)
], SupplierDocument.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierDocument.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], SupplierDocument.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => supplier_folder_entity_1.SupplierFolder, (folder) => folder.documents, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'folder_id' }),
    __metadata("design:type", supplier_folder_entity_1.SupplierFolder)
], SupplierDocument.prototype, "folder", void 0);
exports.SupplierDocument = SupplierDocument = __decorate([
    (0, typeorm_1.Entity)('supplier_documents')
], SupplierDocument);
//# sourceMappingURL=supplier-document.entity.js.map