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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyHttpController = void 0;
const common_1 = require("@nestjs/common");
const company_service_1 = require("./company/company.service");
const create_company_dto_1 = require("./company/dto/create-company.dto");
const create_company_with_documents_dto_1 = require("./company/dto/create-company-with-documents.dto");
const update_company_dto_1 = require("./company/dto/update-company.dto");
const update_company_document_dto_1 = require("./company/dto/update-company-document.dto");
let CompanyHttpController = class CompanyHttpController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.createCompany(dto); }
    createWithDocs(dto) { return this.service.createCompanyWithDocuments(dto); }
    findAll(page = '1', limit = '10', search, status) {
        return this.service.findAllCompanies(parseInt(page, 10), parseInt(limit, 10), search, status);
    }
    stats() { return this.service.getCompanyStatistics(); }
    findOne(id) { return this.service.findCompanyById(parseInt(id, 10)); }
    findByCui(cui) { return this.service.findCompanyByCui(cui); }
    update(id, dto) { return this.service.updateCompany(parseInt(id, 10), dto); }
    remove(id) { return this.service.removeCompany(parseInt(id, 10)); }
    getDocs(companyId) { return this.service.findCompanyDocuments(parseInt(companyId, 10)); }
    getDoc(documentId) { return this.service.findDocumentById(parseInt(documentId, 10)); }
    createDoc(companyId, dto) {
        return this.service.createCompanyDocument({ ...dto, company_id: parseInt(companyId, 10) });
    }
    updateDoc(documentId, dto) {
        return this.service.updateCompanyDocument(parseInt(documentId, 10), dto);
    }
    removeDoc(documentId) { return this.service.removeCompanyDocument(parseInt(documentId, 10)); }
};
exports.CompanyHttpController = CompanyHttpController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_dto_1.CreateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('with-documents'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_with_documents_dto_1.CreateCompanyWithDocumentsDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "createWithDocs", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('cui/:cui'),
    __param(0, (0, common_1.Param)('cui')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "findByCui", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_dto_1.UpdateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':companyId/documents'),
    __param(0, (0, common_1.Param)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "getDocs", null);
__decorate([
    (0, common_1.Get)('documents/:documentId'),
    __param(0, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "getDoc", null);
__decorate([
    (0, common_1.Post)(':companyId/documents'),
    __param(0, (0, common_1.Param)('companyId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "createDoc", null);
__decorate([
    (0, common_1.Patch)('documents/:documentId'),
    __param(0, (0, common_1.Param)('documentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_company_document_dto_1.UpdateCompanyDocumentDto]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "updateDoc", null);
__decorate([
    (0, common_1.Delete)('documents/:documentId'),
    __param(0, (0, common_1.Param)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyHttpController.prototype, "removeDoc", null);
exports.CompanyHttpController = CompanyHttpController = __decorate([
    (0, common_1.Controller)('companies'),
    __metadata("design:paramtypes", [company_service_1.CompanyService])
], CompanyHttpController);
//# sourceMappingURL=company.http.controller.js.map