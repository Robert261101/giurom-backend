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
exports.CompanyMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const company_service_1 = require("./company/company.service");
const create_company_dto_1 = require("./company/dto/create-company.dto");
const create_company_with_documents_dto_1 = require("./company/dto/create-company-with-documents.dto");
const create_company_document_dto_1 = require("./company/dto/create-company-document.dto");
let CompanyMicroController = class CompanyMicroController {
    constructor(companyService) {
        this.companyService = companyService;
    }
    create(dto) {
        return this.companyService.createCompany(dto);
    }
    createWithDocuments(dto) {
        return this.companyService.createCompanyWithDocuments(dto);
    }
    findAll(payload) {
        return this.companyService.findAllCompanies(payload.page, payload.limit, payload.search, payload.status);
    }
    statistics() {
        return this.companyService.getCompanyStatistics();
    }
    findById(id) {
        return this.companyService.findCompanyById(id);
    }
    findByCui(cui) {
        return this.companyService.findCompanyByCui(cui);
    }
    update(payload) {
        return this.companyService.updateCompany(payload.id, payload.dto);
    }
    remove(id) {
        return this.companyService.removeCompany(id);
    }
    createDocument(dto) {
        return this.companyService.createCompanyDocument(dto);
    }
    findCompanyDocuments(companyId) {
        return this.companyService.findCompanyDocuments(companyId);
    }
    findDocumentById(documentId) {
        return this.companyService.findDocumentById(documentId);
    }
    updateDocument(payload) {
        return this.companyService.updateCompanyDocument(payload.documentId, payload.dto);
    }
    removeDocument(documentId) {
        return this.companyService.removeCompanyDocument(documentId);
    }
};
exports.CompanyMicroController = CompanyMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('company.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_dto_1.CreateCompanyDto]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "create", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.createWithDocuments'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_with_documents_dto_1.CreateCompanyWithDocumentsDto]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "createWithDocuments", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "findAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "statistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.findById'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "findById", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.findByCui'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "findByCui", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "update", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "remove", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.documents.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_company_document_dto_1.CreateCompanyDocumentDto]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "createDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.documents.findByCompany'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "findCompanyDocuments", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.documents.findById'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "findDocumentById", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.documents.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "updateDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('company.documents.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], CompanyMicroController.prototype, "removeDocument", null);
exports.CompanyMicroController = CompanyMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [company_service_1.CompanyService])
], CompanyMicroController);
//# sourceMappingURL=company.micro.controller.js.map