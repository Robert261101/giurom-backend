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
exports.EmployeeHttpController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const employee_service_1 = require("./employee.service");
const create_employee_dto_1 = require("./dto/create-employee.dto");
const update_employee_dto_1 = require("./dto/update-employee.dto");
const employee_entity_1 = require("./entities/employee.entity");
const buffer_1 = require("buffer");
let EmployeeHttpController = class EmployeeHttpController {
    constructor(employeeService) {
        this.employeeService = employeeService;
    }
    async create(createEmployeeDto) {
        return this.employeeService.create(createEmployeeDto);
    }
    async findAll(page = '1', limit = '10', is_active, department, contract_type, work_location_id) {
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const isActiveFilter = is_active !== undefined ? is_active === 'true' : undefined;
        const departmentFilter = department ? parseInt(department, 10) : undefined;
        return this.employeeService.findAll(pageNum, limitNum, isActiveFilter, departmentFilter, contract_type, work_location_id ? parseInt(work_location_id, 10) : undefined);
    }
    async getStatistics() {
        return this.employeeService.getStatistics();
    }
    async getEmployeeFiles(employeeId) {
        return this.employeeService.findFilesByEmployee(employeeId);
    }
    async getFilesByQuery(employee_id) {
        if (!employee_id) {
            return [];
        }
        const idNum = parseInt(employee_id, 10);
        if (!Number.isFinite(idNum)) {
            return [];
        }
        return this.employeeService.findFilesByEmployee(idNum);
    }
    async findByEmail(email) {
        return this.employeeService.findByEmail(email);
    }
    async findByPhone(phone) {
        return this.employeeService.findByPhone(phone);
    }
    async findByCNP(cnp) {
        return this.employeeService.findByCNP(cnp);
    }
    async findOne(id) {
        return this.employeeService.findOne(+id);
    }
    async update(id, updateEmployeeDto) {
        return this.employeeService.update(+id, updateEmployeeDto);
    }
    async toggleActive(id) {
        return this.employeeService.toggleActive(+id);
    }
    async remove(id) {
        return this.employeeService.remove(+id);
    }
    async getEmployeeFile(fileId, download, res) {
        const forceDownload = download === 'true';
        const served = await this.employeeService.serveFile(fileId, forceDownload);
        const buffer = buffer_1.Buffer.from(served.data, 'base64');
        res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.send(buffer);
    }
    async viewEmployeeFile(fileId, res) {
        const served = await this.employeeService.serveFile(fileId, false);
        const buffer = buffer_1.Buffer.from(served.data, 'base64');
        res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.send(buffer);
    }
    async addEmployeeFile(employeeId, body) {
        const dto = {
            employee_id: employeeId,
            file_name: body.file_name,
            file_type: body.file_type,
            file_link: body.file_link,
            file_content: body.file_content,
        };
        return this.employeeService.createFile(dto);
    }
    async addEmployeeDocumentWithContent(employeeId, body) {
        if (!body?.documents || body.documents.length === 0) {
            return { message: 'No documents provided' };
        }
        const first = body.documents[0];
        const fileName = first.fileName || first.name || 'document.bin';
        const file_link = `/files/employees/${employeeId}/${fileName}`;
        return this.employeeService.createFile({
            employee_id: employeeId,
            file_name: fileName,
            file_type: first.document_type || first.type || 'Altele',
            file_link,
            file_content: first.content,
        });
    }
};
exports.EmployeeHttpController = EmployeeHttpController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Creează un angajat nou',
        description: 'Adaugă un nou angajat în sistem cu toate informațiile necesare.',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.CREATED,
        description: 'Angajatul a fost creat cu succes',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_employee_dto_1.CreateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Listează toți angajații',
        description: 'Returnează o listă paginată cu toți angajații din sistem cu opțiuni de filtrare.',
    }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, description: 'Numărul de angajați per pagină (implicit: 10)' }),
    (0, swagger_1.ApiQuery)({ name: 'is_active', required: false, description: 'Filtrează după status activ' }),
    (0, swagger_1.ApiQuery)({ name: 'department', required: false, description: 'Filtrează după departament' }),
    (0, swagger_1.ApiQuery)({ name: 'work_location_id', required: false, description: 'Filtrează după locația implicită a angajatului' }),
    (0, swagger_1.ApiQuery)({ name: 'contract_type', required: false, description: 'Filtrează după tipul contractului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Lista angajaților a fost returnată cu succes',
    }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('is_active')),
    __param(3, (0, common_1.Query)('department')),
    __param(4, (0, common_1.Query)('contract_type')),
    __param(5, (0, common_1.Query)('work_location_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    (0, swagger_1.ApiOperation)({
        summary: 'Statistici angajați',
        description: 'Returnează statistici detaliate despre angajați.',
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statisticile au fost returnate cu succes',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)(':employeeId/files'),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "getEmployeeFiles", null);
__decorate([
    (0, common_1.Get)('files'),
    __param(0, (0, common_1.Query)('employee_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "getFilesByQuery", null);
__decorate([
    (0, common_1.Get)('email/:email'),
    (0, swagger_1.ApiOperation)({
        summary: 'Găsește angajat după email',
        description: 'Returnează detaliile angajatului cu email-ul specificat.',
    }),
    (0, swagger_1.ApiParam)({ name: 'email', description: 'Email-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost găsit',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Param)('email')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "findByEmail", null);
__decorate([
    (0, common_1.Get)('phone/:phone'),
    (0, swagger_1.ApiOperation)({
        summary: 'Găsește angajat după telefon',
        description: 'Returnează detaliile angajatului cu numărul de telefon specificat.',
    }),
    (0, swagger_1.ApiParam)({ name: 'phone', description: 'Numărul de telefon al angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost găsit',
        type: employee_entity_1.Employee,
    }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.NOT_FOUND,
        description: 'Angajatul nu a fost găsit',
    }),
    __param(0, (0, common_1.Param)('phone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "findByPhone", null);
__decorate([
    (0, common_1.Get)('cnp/:cnp'),
    (0, swagger_1.ApiOperation)({
        summary: 'Găsește angajat după CNP',
        description: 'Returnează detaliile angajatului cu CNP-ul specificat.',
    }),
    (0, swagger_1.ApiParam)({ name: 'cnp', description: 'CNP-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost găsit',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Param)('cnp')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "findByCNP", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Găsește angajat după ID',
        description: 'Returnează detaliile angajatului cu ID-ul specificat, incluzând toate relațiile.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost găsit',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Actualizează un angajat',
        description: 'Actualizează informațiile unui angajat existent.',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul angajatului de actualizat' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost actualizat cu succes',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_employee_dto_1.UpdateEmployeeDto]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/toggle-active'),
    (0, swagger_1.ApiOperation)({
        summary: 'Activează/dezactivează un angajat',
        description: 'Schimbă statusul activ al unui angajat (activ ↔ inactiv).',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul angajatului' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Statusul angajatului a fost schimbat cu succes',
        type: employee_entity_1.Employee,
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "toggleActive", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({
        summary: 'Șterge un angajat',
        description: 'Șterge definitiv un angajat din sistem. Atenție: această operație este ireversibilă!',
    }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID-ul angajatului de șters' }),
    (0, swagger_1.ApiResponse)({
        status: common_1.HttpStatus.OK,
        description: 'Angajatul a fost șters cu succes',
    }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('file/:fileId'),
    __param(0, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('download')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "getEmployeeFile", null);
__decorate([
    (0, common_1.Get)('file/:fileId/view'),
    __param(0, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "viewEmployeeFile", null);
__decorate([
    (0, common_1.Post)(':employeeId/files'),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "addEmployeeFile", null);
__decorate([
    (0, common_1.Post)(':employeeId/documents-with-content'),
    __param(0, (0, common_1.Param)('employeeId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], EmployeeHttpController.prototype, "addEmployeeDocumentWithContent", null);
exports.EmployeeHttpController = EmployeeHttpController = __decorate([
    (0, swagger_1.ApiTags)('employees'),
    (0, common_1.Controller)('employees'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [employee_service_1.EmployeeService])
], EmployeeHttpController);
//# sourceMappingURL=employee.http.controller.js.map