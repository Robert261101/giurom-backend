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
exports.EmployeeMicroController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const employee_service_1 = require("./employee.service");
const create_employee_dto_1 = require("./dto/create-employee.dto");
let EmployeeMicroController = class EmployeeMicroController {
    constructor(employeeService) {
        this.employeeService = employeeService;
    }
    create(createEmployeeDto) {
        return this.employeeService.create(createEmployeeDto);
    }
    findAll(payload) {
        return this.employeeService.findAll(payload.page, payload.limit, payload.is_active, payload.department, payload.contract_type);
    }
    getStatistics() {
        return this.employeeService.getStatistics();
    }
    findByEmail(email) {
        return this.employeeService.findByEmail(email);
    }
    findByCNP(cnp) {
        return this.employeeService.findByCNP(cnp);
    }
    findOne(id) {
        return this.employeeService.findOne(id);
    }
    update(payload) {
        return this.employeeService.update(payload.id, payload.dto);
    }
    toggleActive(id) {
        return this.employeeService.toggleActive(id);
    }
    remove(id) {
        return this.employeeService.remove(id);
    }
    createFile(createFileDto) {
        return this.employeeService.createFile(createFileDto);
    }
    findOneFile(id) {
        return this.employeeService.findOneFile(id);
    }
    findFilesByEmployee(employee_id) {
        return this.employeeService.findFilesByEmployee(employee_id);
    }
    serveFile(payload) {
        return this.employeeService.serveFile(payload.file_id, payload.forceDownload);
    }
    removeFile(id) {
        return this.employeeService.removeFile(id);
    }
    filesFindAll(payload) {
        return this.employeeService.findAllFiles
            ? this.employeeService.findAllFiles(payload.page, payload.limit, payload.employee_id, payload.file_type)
            : null;
    }
    filesStatistics() {
        return this.employeeService.filesStatistics
            ? this.employeeService.filesStatistics()
            : null;
    }
    filesFindByType(file_type) {
        return this.employeeService.findFilesByType
            ? this.employeeService.findFilesByType(file_type)
            : null;
    }
    filesUpdate(payload) {
        return this.employeeService.updateFile
            ? this.employeeService.updateFile(payload.id, payload.dto)
            : null;
    }
    filesRemoveAllByEmployee(employee_id) {
        return this.employeeService.removeAllFilesByEmployee
            ? this.employeeService.removeAllFilesByEmployee(employee_id)
            : null;
    }
    filesValidateAccess(payload) {
        return this.employeeService.validateFileAccess
            ? this.employeeService.validateFileAccess(payload.file_id, payload.employee_id)
            : null;
    }
    createDocument(dto) {
        return this.employeeService['documentsRepository'] && this.employeeService.createDocument
            ? this.employeeService.createDocument(dto)
            : null;
    }
    documentsFindAll(payload) {
        return this.employeeService.documentsFindAll
            ? this.employeeService.documentsFindAll(payload)
            : null;
    }
    documentFindOne(id) {
        return this.employeeService.documentFindOne
            ? this.employeeService.documentFindOne(id)
            : null;
    }
    documentsFindByEmployee(employee_id) {
        return this.employeeService.documentsFindByEmployee
            ? this.employeeService.documentsFindByEmployee(employee_id)
            : null;
    }
    documentsFindByStatus(status) {
        return this.employeeService.documentsFindByStatus
            ? this.employeeService.documentsFindByStatus(status)
            : null;
    }
    documentsFindByDocId(doc_id) {
        return this.employeeService.documentsFindByDocId
            ? this.employeeService.documentsFindByDocId(doc_id)
            : null;
    }
    documentsFindExpired() {
        return this.employeeService.documentsFindExpired
            ? this.employeeService.documentsFindExpired()
            : null;
    }
    documentsUpdate(payload) {
        return this.employeeService.documentsUpdate
            ? this.employeeService.documentsUpdate(payload.id, payload.dto)
            : null;
    }
    documentsSign(id) {
        return this.employeeService.documentsSign
            ? this.employeeService.documentsSign(id)
            : null;
    }
    documentsCancel(id) {
        return this.employeeService.documentsCancel
            ? this.employeeService.documentsCancel(id)
            : null;
    }
    documentsRemove(id) {
        return this.employeeService.documentsRemove
            ? this.employeeService.documentsRemove(id)
            : null;
    }
    documentsStatistics() {
        return this.employeeService.documentsStatistics
            ? this.employeeService.documentsStatistics()
            : null;
    }
    createWorkHistory(dto) {
        return this.employeeService.createWorkHistory
            ? this.employeeService.createWorkHistory(dto)
            : null;
    }
    workHistoryFindAll(payload) {
        return this.employeeService.workHistoryFindAll
            ? this.employeeService.workHistoryFindAll(payload)
            : null;
    }
    workHistoryFindOne(id) {
        return this.employeeService.workHistoryFindOne
            ? this.employeeService.workHistoryFindOne(id)
            : null;
    }
    workHistoryFindByEmployee(employee_id) {
        return this.employeeService.workHistoryFindByEmployee
            ? this.employeeService.workHistoryFindByEmployee(employee_id)
            : null;
    }
    workHistoryFindByWorkLocation(work_location_id) {
        return this.employeeService.workHistoryFindByWorkLocation
            ? this.employeeService.workHistoryFindByWorkLocation(work_location_id)
            : null;
    }
    workHistoryUpdate(payload) {
        return this.employeeService.workHistoryUpdate
            ? this.employeeService.workHistoryUpdate(payload.id, payload.dto)
            : null;
    }
    workHistoryRemove(id) {
        return this.employeeService.workHistoryRemove
            ? this.employeeService.workHistoryRemove(id)
            : null;
    }
    workHistoryStatistics() {
        return this.employeeService.workHistoryStatistics
            ? this.employeeService.workHistoryStatistics()
            : null;
    }
};
exports.EmployeeMicroController = EmployeeMicroController;
__decorate([
    (0, microservices_1.MessagePattern)('employees.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_employee_dto_1.CreateEmployeeDto]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "create", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.getStatistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "getStatistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.findByEmail'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findByEmail", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.findByCNP'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findByCNP", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "update", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.toggleActive'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "toggleActive", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "remove", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "createFile", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findOneFile", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.findByEmployee'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "findFilesByEmployee", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.serveFile'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "serveFile", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "removeFile", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesFindAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesStatistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.findByType'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesFindByType", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesUpdate", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.removeAllByEmployee'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesRemoveAllByEmployee", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.files.validateAccess'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "filesValidateAccess", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "createDocument", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsFindAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentFindOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findByEmployee'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsFindByEmployee", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findByStatus'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsFindByStatus", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findByDocId'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsFindByDocId", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.findExpired'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsFindExpired", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsUpdate", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.sign'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsSign", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.cancel'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsCancel", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsRemove", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.documents.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "documentsStatistics", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.create'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "createWorkHistory", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.findAll'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryFindAll", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.findOne'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryFindOne", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.findByEmployee'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryFindByEmployee", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.findByWorkLocation'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryFindByWorkLocation", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.update'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryUpdate", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.remove'),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryRemove", null);
__decorate([
    (0, microservices_1.MessagePattern)('employees.workhistory.statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeMicroController.prototype, "workHistoryStatistics", null);
exports.EmployeeMicroController = EmployeeMicroController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [employee_service_1.EmployeeService])
], EmployeeMicroController);
//# sourceMappingURL=employee.micro.controller.js.map