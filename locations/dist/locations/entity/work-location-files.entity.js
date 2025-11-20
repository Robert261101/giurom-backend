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
exports.WorkLocationFiles = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const work_location_entity_1 = require("./work-location.entity");
let WorkLocationFiles = class WorkLocationFiles {
};
exports.WorkLocationFiles = WorkLocationFiles;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul unic al fișierului',
        example: 1,
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkLocationFiles.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID-ul locației',
        example: 1,
    }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], WorkLocationFiles.prototype, "work_location_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Numele fișierului',
        example: 'Contract_Locatie_1.pdf',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], WorkLocationFiles.prototype, "file_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tipul fișierului',
        example: 'pdf',
        maxLength: 100,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], WorkLocationFiles.prototype, "file_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Link-ul către fișier',
        example: '/files/locations/1/document.pdf',
        maxLength: 255,
    }),
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 255,
        charset: 'utf8mb4',
        collation: 'utf8mb4_unicode_ci'
    }),
    __metadata("design:type", String)
], WorkLocationFiles.prototype, "file_link", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Data ultimei actualizări',
        example: '2023-12-15T14:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)({ type: 'datetime' }),
    __metadata("design:type", Date)
], WorkLocationFiles.prototype, "updated_at", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Locația asociată cu acest fișier',
        type: () => work_location_entity_1.WorkLocation,
    }),
    (0, typeorm_1.ManyToOne)(() => work_location_entity_1.WorkLocation, location => location.location_files),
    (0, typeorm_1.JoinColumn)({ name: 'work_location_id' }),
    __metadata("design:type", work_location_entity_1.WorkLocation)
], WorkLocationFiles.prototype, "workLocation", void 0);
exports.WorkLocationFiles = WorkLocationFiles = __decorate([
    (0, typeorm_1.Entity)('work_location_files')
], WorkLocationFiles);
//# sourceMappingURL=work-location-files.entity.js.map