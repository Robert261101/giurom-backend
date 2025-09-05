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
exports.EmployeeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const employee_entity_1 = require("./entities/employee.entity");
const employee_files_entity_1 = require("./entities/employee-files.entity");
const generated_documents_entity_1 = require("./entities/generated-documents.entity");
const employee_work_location_history_entity_1 = require("./entities/employee-work-location-history.entity");
const fs = require("fs");
const path = require("path");
let EmployeeService = class EmployeeService {
    constructor(employeeRepository, filesRepository, documentsRepository, workLocationHistoryRepository) {
        this.employeeRepository = employeeRepository;
        this.filesRepository = filesRepository;
        this.documentsRepository = documentsRepository;
        this.workLocationHistoryRepository = workLocationHistoryRepository;
    }
    getEmployeesFilesRootDir() {
        const repoRoot = path.resolve(__dirname, '../../..');
        return path.join(repoRoot, 'files', 'employees');
    }
    async create(createEmployeeDto) {
        const existingEmployee = await this.employeeRepository.findOne({
            where: { email: createEmployeeDto.email }
        });
        if (existingEmployee) {
            throw new common_1.ConflictException('Un angajat cu acest email există deja');
        }
        const existingCNP = await this.employeeRepository.findOne({
            where: { personal_number: createEmployeeDto.personal_number }
        });
        if (existingCNP) {
            throw new common_1.ConflictException('Un angajat cu acest CNP există deja');
        }
        const hireDate = new Date(createEmployeeDto.hire_date);
        hireDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (hireDate.getTime() > today.getTime()) {
            throw new common_1.BadRequestException('Data angajării nu poate fi în viitor');
        }
        const birthDate = new Date(createEmployeeDto.birth_date);
        const minAge = new Date();
        minAge.setFullYear(minAge.getFullYear() - 16);
        if (birthDate > minAge) {
            throw new common_1.BadRequestException('Angajatul trebuie să aibă cel puțin 16 ani');
        }
        if (createEmployeeDto.termination_date) {
            const terminationDate = new Date(createEmployeeDto.termination_date);
            if (terminationDate <= hireDate) {
                throw new common_1.BadRequestException('Data încetării contractului trebuie să fie după data angajării');
            }
        }
        const employee = this.employeeRepository.create(createEmployeeDto);
        return await this.employeeRepository.save(employee);
    }
    async findAll(page = 1, limit = 10, is_active, department, contract_type, work_location_id) {
        const queryBuilder = this.employeeRepository.createQueryBuilder('employee');
        if (is_active !== undefined) {
            queryBuilder.andWhere('employee.is_active = :is_active', { is_active });
        }
        if (department) {
            queryBuilder.andWhere('employee.department_default_id = :department', { department });
        }
        if (contract_type) {
            queryBuilder.andWhere('employee.contract_type = :contract_type', { contract_type });
        }
        if (work_location_id) {
            queryBuilder.andWhere('employee.work_location_default_id = :work_location_id', { work_location_id });
        }
        const offset = (page - 1) * limit;
        const [employees, total] = await queryBuilder
            .orderBy('employee.created_at', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return {
            employees,
            total,
            totalPages,
        };
    }
    async findOne(id) {
        const employee = await this.employeeRepository.findOne({
            where: { id }
        });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
        }
        const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
            this.workLocationHistoryRepository.find({ where: { employee_id: id } }),
            this.filesRepository.find({ where: { employee_id: id } }),
            this.documentsRepository.find({ where: { employee_id: id } }),
        ]);
        employee.workLocationHistory = workLocationHistory;
        employee.employeeFiles = employeeFiles;
        employee.generatedDocuments = generatedDocuments;
        return employee;
    }
    async findByEmail(email) {
        const employee = await this.employeeRepository.findOne({
            where: { email }
        });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu email-ul ${email} nu a fost găsit`);
        }
        const id = employee.id;
        const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
            this.workLocationHistoryRepository.find({ where: { employee_id: id } }),
            this.filesRepository.find({ where: { employee_id: id } }),
            this.documentsRepository.find({ where: { employee_id: id } }),
        ]);
        employee.workLocationHistory = workLocationHistory;
        employee.employeeFiles = employeeFiles;
        employee.generatedDocuments = generatedDocuments;
        return employee;
    }
    async findByCNP(cnp) {
        const employee = await this.employeeRepository.findOne({ where: { personal_number: cnp } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu CNP-ul ${cnp} nu a fost găsit`);
        }
        const id = employee.id;
        const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
            this.workLocationHistoryRepository.find({ where: { employee_id: id } }),
            this.filesRepository.find({ where: { employee_id: id } }),
            this.documentsRepository.find({ where: { employee_id: id } }),
        ]);
        employee.workLocationHistory = workLocationHistory;
        employee.employeeFiles = employeeFiles;
        employee.generatedDocuments = generatedDocuments;
        return employee;
    }
    async update(id, updateEmployeeDto) {
        const employee = await this.findOne(id);
        if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
            const existingEmployee = await this.employeeRepository.findOne({
                where: { email: updateEmployeeDto.email }
            });
            if (existingEmployee) {
                throw new common_1.ConflictException('Un angajat cu acest email există deja');
            }
        }
        if (updateEmployeeDto.personal_number && updateEmployeeDto.personal_number !== employee.personal_number) {
            const existingCNP = await this.employeeRepository.findOne({
                where: { personal_number: updateEmployeeDto.personal_number }
            });
            if (existingCNP) {
                throw new common_1.ConflictException('Un angajat cu acest CNP există deja');
            }
        }
        if (updateEmployeeDto.hire_date) {
            const hireDate = new Date(updateEmployeeDto.hire_date);
            hireDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (hireDate.getTime() > today.getTime()) {
                throw new common_1.BadRequestException('Data angajării nu poate fi în viitor');
            }
        }
        if (updateEmployeeDto.birth_date) {
            const birthDate = new Date(updateEmployeeDto.birth_date);
            const minAge = new Date();
            minAge.setFullYear(minAge.getFullYear() - 16);
            if (birthDate > minAge) {
                throw new common_1.BadRequestException('Angajatul trebuie să aibă cel puțin 16 ani');
            }
        }
        await this.employeeRepository.update(id, updateEmployeeDto);
        return await this.findOne(id);
    }
    async remove(id) {
        const employee = await this.findOne(id);
        await this.employeeRepository.delete(id);
        return {
            message: `Angajatul ${employee.first_name} ${employee.last_name} a fost șters cu succes`,
        };
    }
    async toggleActive(id) {
        const employee = await this.findOne(id);
        employee.is_active = !employee.is_active;
        return await this.employeeRepository.save(employee);
    }
    async getStatistics() {
        const total = await this.employeeRepository.count();
        const active = await this.employeeRepository.count({ where: { is_active: true } });
        const inactive = total - active;
        const contractTypes = await this.employeeRepository.createQueryBuilder('employee')
            .select('employee.contract_type', 'contract_type')
            .addSelect('COUNT(employee.id)', 'count')
            .groupBy('employee.contract_type')
            .getRawMany();
        const byContractType = contractTypes.reduce((acc, curr) => {
            acc[curr.contract_type] = parseInt(curr.count);
            return acc;
        }, {});
        const genders = await this.employeeRepository.createQueryBuilder('employee')
            .select('employee.gender', 'gender')
            .addSelect('COUNT(employee.id)', 'count')
            .groupBy('employee.gender')
            .getRawMany();
        const byGender = genders.reduce((acc, curr) => {
            acc[curr.gender] = parseInt(curr.count);
            return acc;
        }, {});
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const hiredThisMonth = await this.employeeRepository.count({
            where: {
                hire_date: (0, typeorm_2.MoreThanOrEqual)(startOfMonth),
            },
        });
        return {
            total,
            active,
            inactive,
            byContractType,
            byGender,
            hiredThisMonth,
        };
    }
    async createFile(createFileDto) {
        console.log('📥 Received createFileDto:', {
            employee_id: createFileDto.employee_id,
            file_name: createFileDto.file_name,
            file_type: createFileDto.file_type,
            has_content: !!createFileDto.file_content,
            content_length: createFileDto.file_content?.length || 0
        });
        const employee = await this.employeeRepository.findOne({
            where: { id: createFileDto.employee_id }
        });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${createFileDto.employee_id} nu a fost găsit`);
        }
        if (!employee.is_active) {
            throw new common_1.BadRequestException('Nu se pot adăuga fișiere pentru un angajat inactiv');
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileExtension = createFileDto.file_name.split('.').pop() || 'txt';
        const baseFileName = createFileDto.file_name.replace(/\.[^/.]+$/, "") || 'file';
        const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;
        console.log(`📝 Original: ${createFileDto.file_name}, Generated: ${uniqueFileName}`);
        const updatedFileLink = createFileDto.file_link.replace(createFileDto.file_name, uniqueFileName);
        const employeeId = createFileDto.employee_id?.toString() || 'unknown';
        console.log(`📁 Creating directory for employee ID: ${employeeId}`);
        const baseDir = this.getEmployeesFilesRootDir();
        const fileDir = path.join(baseDir, employeeId);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        if (createFileDto.file_content) {
            try {
                const filePath = path.join(fileDir, uniqueFileName);
                let base64Data = createFileDto.file_content;
                if (base64Data.includes(',')) {
                    base64Data = base64Data.split(',')[1];
                }
                console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
            }
            catch (error) {
                console.error('❌ Error saving file to disk:', error);
            }
        }
        const existingFile = await this.filesRepository.findOne({
            where: {
                employee_id: createFileDto.employee_id,
                file_name: uniqueFileName
            }
        });
        if (existingFile) {
            throw new common_1.ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru acest angajat`);
        }
        if (createFileDto.file_type === 'CV') {
            const existingCV = await this.filesRepository.findOne({
                where: {
                    employee_id: createFileDto.employee_id,
                    file_type: 'CV'
                }
            });
            if (existingCV) {
                throw new common_1.ConflictException('Angajatul are deja un CV încărcat. Vă rugăm să îl actualizați în loc să adăugați unul nou.');
            }
        }
        const file = this.filesRepository.create({
            ...createFileDto,
            file_name: uniqueFileName,
            file_link: updatedFileLink
        });
        const savedFile = await this.filesRepository.save(file);
        console.log(`✅ File record saved to database with ID: ${savedFile.id}`);
        return savedFile;
    }
    async findOneFile(id) {
        const file = await this.filesRepository.findOne({
            where: { id },
            relations: ['employee'],
        });
        if (!file) {
            throw new common_1.NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
        }
        return file;
    }
    async findFilesByEmployee(employee_id) {
        const employee = await this.employeeRepository.findOne({
            where: { id: employee_id }
        });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
        }
        return await this.filesRepository.find({
            where: { employee_id },
            relations: ['employee'],
            order: { updated_at: 'DESC' },
        });
    }
    async serveFile(file_id, forceDownload = false) {
        console.log(`🔍 Serving file with ID: ${file_id}, forceDownload: ${forceDownload}`);
        const file = await this.findOneFile(file_id);
        console.log(`📄 File metadata:`, {
            id: file.id,
            name: file.file_name,
            employee_id: file.employee_id,
            file_link: file.file_link
        });
        const baseDir = this.getEmployeesFilesRootDir();
        const filePath = path.join(baseDir, file.employee_id.toString(), file.file_name);
        console.log(`📁 Serving file from: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            console.error(`❌ File not found on disk: ${filePath}`);
            throw new common_1.NotFoundException('Fișierul nu a fost găsit pe disk');
        }
        const mimeType = this.getMimeType(file.file_name);
        console.log(`📋 MIME type determined: ${mimeType}`);
        const fileBuffer = fs.readFileSync(filePath);
        console.log(`✅ File read successfully: ${file.file_name} (${fileBuffer.length} bytes)`);
        return {
            data: fileBuffer.toString('base64'),
            mimeType,
            fileName: file.file_name,
            disposition: forceDownload ? 'attachment' : 'inline',
        };
    }
    getMimeType(fileName) {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'txt': 'text/plain',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
        };
        return mimeTypes[extension || ''] || 'application/octet-stream';
    }
    async removeFile(id) {
        const file = await this.findOneFile(id);
        await this.filesRepository.delete(id);
        return {
            message: `Fișierul "${file.file_name}" al angajatului ${file.employee.first_name} ${file.employee.last_name} a fost șters cu succes`,
        };
    }
    async createDocument(createDocumentDto) {
        const employee = await this.employeeRepository.findOne({ where: { id: createDocumentDto.employee_id } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${createDocumentDto.employee_id} nu a fost găsit`);
        }
        if (!employee.is_active) {
            throw new common_1.BadRequestException('Nu se pot genera documente pentru un angajat inactiv');
        }
        const existingDocument = await this.documentsRepository.findOne({
            where: {
                employee_id: createDocumentDto.employee_id,
                doc_id: createDocumentDto.doc_id,
                status: 'Generated',
            },
        });
        if (existingDocument) {
            throw new common_1.ConflictException(`Există deja un document activ cu ID-ul ${createDocumentDto.doc_id} pentru acest angajat`);
        }
        if (createDocumentDto.status === 'Signed' && !createDocumentDto.signed_at) {
            throw new common_1.BadRequestException('Data semnării este obligatorie pentru documentele semnate');
        }
        if (createDocumentDto.signed_at && createDocumentDto.expired_date) {
            const signedDate = new Date(createDocumentDto.signed_at);
            const expiredDate = new Date(createDocumentDto.expired_date);
            if (signedDate >= expiredDate) {
                throw new common_1.BadRequestException('Data expirării trebuie să fie după data semnării');
            }
        }
        const document = this.documentsRepository.create(createDocumentDto);
        return await this.documentsRepository.save(document);
    }
    async documentsFindAll(params) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;
        const queryBuilder = this.documentsRepository.createQueryBuilder('document').leftJoinAndSelect('document.employee', 'employee');
        if (params.employee_id) {
            queryBuilder.andWhere('document.employee_id = :employee_id', { employee_id: params.employee_id });
        }
        if (params.status) {
            queryBuilder.andWhere('document.status = :status', { status: params.status });
        }
        if (params.doc_id) {
            queryBuilder.andWhere('document.doc_id = :doc_id', { doc_id: params.doc_id });
        }
        const offset = (page - 1) * limit;
        const [documents, total] = await queryBuilder
            .orderBy('document.signed_at', 'DESC')
            .addOrderBy('document.id', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return { documents, total, totalPages };
    }
    async documentFindOne(id) {
        const document = await this.documentsRepository.findOne({ where: { id }, relations: ['employee'] });
        if (!document) {
            throw new common_1.NotFoundException(`Documentul cu ID-ul ${id} nu a fost găsit`);
        }
        return document;
    }
    async documentsFindByEmployee(employee_id) {
        const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
        }
        return await this.documentsRepository.find({
            where: { employee_id },
            relations: ['employee'],
            order: { signed_at: 'DESC', id: 'DESC' },
        });
    }
    async documentsFindByStatus(status) {
        return await this.documentsRepository.find({ where: { status }, relations: ['employee'], order: { signed_at: 'DESC' } });
    }
    async documentsFindByDocId(doc_id) {
        return await this.documentsRepository.find({ where: { doc_id }, relations: ['employee'], order: { signed_at: 'DESC' } });
    }
    async documentsFindExpired() {
        const currentDate = new Date();
        return await this.documentsRepository.find({
            where: { expired_date: (0, typeorm_2.LessThan)(currentDate), status: 'Signed' },
            relations: ['employee'],
            order: { expired_date: 'ASC' },
        });
    }
    async documentsUpdate(id, updateDocumentDto) {
        const document = await this.documentFindOne(id);
        if (updateDocumentDto.employee_id && updateDocumentDto.employee_id !== document.employee_id) {
            const employee = await this.employeeRepository.findOne({ where: { id: updateDocumentDto.employee_id } });
            if (!employee) {
                throw new common_1.NotFoundException(`Angajatul cu ID-ul ${updateDocumentDto.employee_id} nu a fost găsit`);
            }
        }
        if (updateDocumentDto.status === 'Signed' && !updateDocumentDto.signed_at && !document.signed_at) {
            throw new common_1.BadRequestException('Data semnării este obligatorie pentru documentele semnate');
        }
        const signedAt = updateDocumentDto.signed_at || document.signed_at;
        const expiredDate = updateDocumentDto.expired_date || document.expired_date;
        if (signedAt && expiredDate) {
            const signedDate = new Date(signedAt);
            const expiredDateObj = new Date(expiredDate);
            if (signedDate >= expiredDateObj) {
                throw new common_1.BadRequestException('Data expirării trebuie să fie după data semnării');
            }
        }
        await this.documentsRepository.update(id, updateDocumentDto);
        return await this.documentFindOne(id);
    }
    async documentsSign(id) {
        const document = await this.documentFindOne(id);
        if (document.status === 'Signed') {
            throw new common_1.BadRequestException('Documentul este deja semnat');
        }
        if (document.status === 'Expired' || document.status === 'Cancelled') {
            throw new common_1.BadRequestException('Nu se poate semna un document expirat sau anulat');
        }
        await this.documentsRepository.update(id, { status: 'Signed', signed_at: new Date() });
        return await this.documentFindOne(id);
    }
    async documentsCancel(id) {
        const document = await this.documentFindOne(id);
        if (document.status === 'Cancelled') {
            throw new common_1.BadRequestException('Documentul este deja anulat');
        }
        if (document.status === 'Expired') {
            throw new common_1.BadRequestException('Nu se poate anula un document expirat');
        }
        await this.documentsRepository.update(id, { status: 'Cancelled' });
        return await this.documentFindOne(id);
    }
    async documentsRemove(id) {
        const document = await this.documentFindOne(id);
        if (document.status === 'Signed') {
            throw new common_1.BadRequestException('Nu se pot șterge documentele semnate. Vă rugăm să le anulați mai întâi.');
        }
        await this.documentsRepository.delete(id);
        return { message: `Documentul pentru angajatul ${document.employee.first_name} ${document.employee.last_name} a fost șters cu succes` };
    }
    async documentsStatistics() {
        const total = await this.documentsRepository.count();
        const statusStats = await this.documentsRepository
            .createQueryBuilder('document')
            .select('document.status', 'status')
            .addSelect('COUNT(document.id)', 'count')
            .groupBy('document.status')
            .getRawMany();
        const byStatus = statusStats.reduce((acc, curr) => {
            acc[curr.status] = parseInt(curr.count);
            return acc;
        }, {});
        const employeeStats = await this.documentsRepository
            .createQueryBuilder('document')
            .select('document.employee_id', 'employee_id')
            .addSelect('COUNT(document.id)', 'count')
            .groupBy('document.employee_id')
            .getRawMany();
        const byEmployee = employeeStats.reduce((acc, curr) => {
            acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
            return acc;
        }, {});
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const expiringSoon = await this.documentsRepository.count({ where: { expired_date: (0, typeorm_2.LessThan)(thirtyDaysFromNow), status: 'Signed' } });
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentlySigned = await this.documentsRepository.count({ where: { signed_at: (0, typeorm_2.MoreThanOrEqual)(sevenDaysAgo), status: 'Signed' } });
        const docTypeStats = await this.documentsRepository
            .createQueryBuilder('document')
            .select('document.doc_id', 'doc_id')
            .addSelect('COUNT(document.id)', 'count')
            .groupBy('document.doc_id')
            .getRawMany();
        const byDocType = docTypeStats.reduce((acc, curr) => {
            acc[`DocType_${curr.doc_id}`] = parseInt(curr.count);
            return acc;
        }, {});
        return { total, byStatus, byEmployee, expiringSoon, recentlySigned, byDocType };
    }
    async createWorkHistory(createHistoryDto) {
        const employee = await this.employeeRepository.findOne({ where: { id: createHistoryDto.employee_id } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${createHistoryDto.employee_id} nu a fost găsit`);
        }
        if (!employee.is_active) {
            throw new common_1.BadRequestException('Nu se poate adăuga istoric pentru un angajat inactiv');
        }
        const history = this.workLocationHistoryRepository.create(createHistoryDto);
        return await this.workLocationHistoryRepository.save(history);
    }
    async workHistoryFindAll(params) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 10;
        const qb = this.workLocationHistoryRepository.createQueryBuilder('history').leftJoinAndSelect('history.employee', 'employee');
        if (params.employee_id) {
            qb.andWhere('history.employee_id = :employee_id', { employee_id: params.employee_id });
        }
        if (params.work_location_id) {
            qb.andWhere('history.work_location_id = :work_location_id', { work_location_id: params.work_location_id });
        }
        const offset = (page - 1) * limit;
        const [history, total] = await qb.orderBy('history.created_at', 'DESC').take(limit).skip(offset).getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return { history, total, totalPages };
    }
    async workHistoryFindOne(id) {
        const history = await this.workLocationHistoryRepository.findOne({ where: { id }, relations: ['employee'] });
        if (!history) {
            throw new common_1.NotFoundException(`Înregistrarea din istoric cu ID-ul ${id} nu a fost găsită`);
        }
        return history;
    }
    async workHistoryFindByEmployee(employee_id) {
        const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
        }
        return await this.workLocationHistoryRepository.find({ where: { employee_id }, relations: ['employee'], order: { created_at: 'DESC' } });
    }
    async workHistoryFindByWorkLocation(work_location_id) {
        return await this.workLocationHistoryRepository.find({ where: { work_location_id }, relations: ['employee'], order: { created_at: 'DESC' } });
    }
    async workHistoryUpdate(id, updateHistoryDto) {
        const history = await this.workHistoryFindOne(id);
        if (updateHistoryDto.employee_id && updateHistoryDto.employee_id !== history.employee_id) {
            const employee = await this.employeeRepository.findOne({ where: { id: updateHistoryDto.employee_id } });
            if (!employee) {
                throw new common_1.NotFoundException(`Angajatul cu ID-ul ${updateHistoryDto.employee_id} nu a fost găsit`);
            }
        }
        await this.workLocationHistoryRepository.update(id, updateHistoryDto);
        return await this.workHistoryFindOne(id);
    }
    async workHistoryRemove(id) {
        const history = await this.workHistoryFindOne(id);
        await this.workLocationHistoryRepository.delete(id);
        return { message: `Înregistrarea din istoric pentru angajatul ${history.employee.first_name} ${history.employee.last_name} a fost ștearsă cu succes` };
    }
    async workHistoryStatistics() {
        const total = await this.workLocationHistoryRepository.count();
        const employeeStats = await this.workLocationHistoryRepository
            .createQueryBuilder('history')
            .select('history.employee_id', 'employee_id')
            .addSelect('COUNT(history.id)', 'count')
            .groupBy('history.employee_id')
            .getRawMany();
        const byEmployee = employeeStats.reduce((acc, curr) => {
            acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
            return acc;
        }, {});
        const locationStats = await this.workLocationHistoryRepository
            .createQueryBuilder('history')
            .select('history.work_location_id', 'work_location_id')
            .addSelect('COUNT(history.id)', 'count')
            .groupBy('history.work_location_id')
            .getRawMany();
        const byWorkLocation = locationStats.reduce((acc, curr) => {
            acc[`Location_${curr.work_location_id}`] = parseInt(curr.count);
            return acc;
        }, {});
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const recentChanges = await this.workLocationHistoryRepository.count({ where: { created_at: (0, typeorm_2.MoreThanOrEqual)(lastMonth) } });
        return { total, byEmployee, byWorkLocation, recentChanges };
    }
    async findAllFiles(page = 1, limit = 10, employee_id, file_type) {
        const queryBuilder = this.filesRepository.createQueryBuilder('file').leftJoinAndSelect('file.employee', 'employee');
        if (employee_id) {
            queryBuilder.andWhere('file.employee_id = :employee_id', { employee_id });
        }
        if (file_type) {
            queryBuilder.andWhere('file.file_type = :file_type', { file_type });
        }
        const offset = (page - 1) * limit;
        const [files, total] = await queryBuilder
            .orderBy('file.updated_at', 'DESC')
            .take(limit)
            .skip(offset)
            .getManyAndCount();
        const totalPages = Math.ceil(total / limit);
        return { files, total, totalPages };
    }
    async filesStatistics() {
        const total = await this.filesRepository.count();
        const fileTypeStats = await this.filesRepository
            .createQueryBuilder('file')
            .select('file.file_type', 'file_type')
            .addSelect('COUNT(file.id)', 'count')
            .groupBy('file.file_type')
            .getRawMany();
        const byFileType = fileTypeStats.reduce((acc, curr) => {
            acc[curr.file_type] = parseInt(curr.count);
            return acc;
        }, {});
        const employeeStats = await this.filesRepository
            .createQueryBuilder('file')
            .select('file.employee_id', 'employee_id')
            .addSelect('COUNT(file.id)', 'count')
            .groupBy('file.employee_id')
            .getRawMany();
        const byEmployee = employeeStats.reduce((acc, curr) => {
            acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
            return acc;
        }, {});
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const recentUploads = await this.filesRepository.count({ where: { updated_at: (0, typeorm_2.MoreThanOrEqual)(lastMonth) } });
        const totalEmployees = await this.employeeRepository.count();
        const averageFilesPerEmployee = totalEmployees > 0 ? Math.round((total / totalEmployees) * 100) / 100 : 0;
        return { total, byFileType, byEmployee, recentUploads, averageFilesPerEmployee };
    }
    async findFilesByType(file_type) {
        return await this.filesRepository.find({ where: { file_type }, relations: ['employee'], order: { updated_at: 'DESC' } });
    }
    async updateFile(id, updateFileDto) {
        const file = await this.findOneFile(id);
        if (updateFileDto.employee_id && updateFileDto.employee_id !== file.employee_id) {
            const employee = await this.employeeRepository.findOne({ where: { id: updateFileDto.employee_id } });
            if (!employee) {
                throw new common_1.NotFoundException(`Angajatul cu ID-ul ${updateFileDto.employee_id} nu a fost găsit`);
            }
        }
        if (updateFileDto.file_name && updateFileDto.file_name !== file.file_name) {
            const existingFile = await this.filesRepository.findOne({
                where: {
                    employee_id: updateFileDto.employee_id || file.employee_id,
                    file_name: updateFileDto.file_name,
                },
            });
            if (existingFile && existingFile.id !== id) {
                throw new common_1.ConflictException(`Un fișier cu numele "${updateFileDto.file_name}" există deja pentru acest angajat`);
            }
        }
        await this.filesRepository.update(id, updateFileDto);
        return await this.findOneFile(id);
    }
    async removeAllFilesByEmployee(employee_id) {
        const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
        if (!employee) {
            throw new common_1.NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
        }
        const files = await this.filesRepository.find({ where: { employee_id } });
        const deletedCount = files.length;
        if (deletedCount > 0) {
            await this.filesRepository.delete({ employee_id });
        }
        return {
            message: `Au fost șterse ${deletedCount} fișiere pentru angajatul ${employee.first_name} ${employee.last_name}`,
            deletedCount,
        };
    }
    async validateFileAccess(file_id, employee_id) {
        const file = await this.findOneFile(file_id);
        if (employee_id && file.employee_id !== employee_id) {
            return false;
        }
        return true;
    }
};
exports.EmployeeService = EmployeeService;
exports.EmployeeService = EmployeeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(employee_entity_1.Employee)),
    __param(1, (0, typeorm_1.InjectRepository)(employee_files_entity_1.EmployeeFiles)),
    __param(2, (0, typeorm_1.InjectRepository)(generated_documents_entity_1.GeneratedDocuments)),
    __param(3, (0, typeorm_1.InjectRepository)(employee_work_location_history_entity_1.EmployeeWorkLocationHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EmployeeService);
//# sourceMappingURL=employee.service.js.map