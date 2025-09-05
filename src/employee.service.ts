import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThan } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { UpdateEmployeeFileDto } from './dto/update-employee-file.dto';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { UpdateGeneratedDocumentDto } from './dto/update-generated-document.dto';
import { CreateWorkLocationHistoryDto } from './dto/create-work-location-history.dto';
import { UpdateWorkLocationHistoryDto } from './dto/update-work-location-history.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeFiles)
    private filesRepository: Repository<EmployeeFiles>,
    @InjectRepository(GeneratedDocuments)
    private documentsRepository: Repository<GeneratedDocuments>,
    @InjectRepository(EmployeeWorkLocationHistory)
    private workLocationHistoryRepository: Repository<EmployeeWorkLocationHistory>,
  ) {}

  private getEmployeesFilesRootDir(): string {
    // Resolve repo root relative to this file location to be robust for different cwd
    // __dirname is .../giurom-backend/employees/src (dev with ts-node) or .../giurom-backend/employees/dist (prod)
    const repoRoot = path.resolve(__dirname, '../../..');
    return path.join(repoRoot, 'files', 'employees');
  }

  // Crearea unui angajat nou
  async create(createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    // Verifică dacă email-ul există deja
    const existingEmployee = await this.employeeRepository.findOne({
      where: { email: createEmployeeDto.email }
    });

    if (existingEmployee) {
      throw new ConflictException('Un angajat cu acest email există deja');
    }

    // Verifică dacă CNP-ul există deja
    const existingCNP = await this.employeeRepository.findOne({
      where: { personal_number: createEmployeeDto.personal_number }
    });

    if (existingCNP) {
      throw new ConflictException('Un angajat cu acest CNP există deja');
    }

    // Validează data angajării (nu poate fi în viitor). Compară doar componenta de dată (fără ore/timezone)
    const hireDate = new Date(createEmployeeDto.hire_date);
    hireDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (hireDate.getTime() > today.getTime()) {
      throw new BadRequestException('Data angajării nu poate fi în viitor');
    }

    // Validează data nașterii (angajatul trebuie să aibă cel puțin 16 ani)
    const birthDate = new Date(createEmployeeDto.birth_date);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 16);

    if (birthDate > minAge) {
      throw new BadRequestException('Angajatul trebuie să aibă cel puțin 16 ani');
    }

    // Validează data încetării contractului (dacă există)
    if (createEmployeeDto.termination_date) {
      const terminationDate = new Date(createEmployeeDto.termination_date);
      if (terminationDate <= hireDate) {
        throw new BadRequestException('Data încetării contractului trebuie să fie după data angajării');
      }
    }


    const employee = this.employeeRepository.create(createEmployeeDto);
    return await this.employeeRepository.save(employee);
  }

  // Listarea angajaților cu filtrare și paginare
  async findAll(
    page: number = 1,
    limit: number = 10,
    is_active?: boolean,
    department?: number,
    contract_type?: string,
    work_location_id?: number,
  ): Promise<{ employees: Employee[]; total: number; totalPages: number }> {
    const queryBuilder = this.employeeRepository.createQueryBuilder('employee');

    // Aplică filtrele
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

    // Calculează offset-ul pentru paginare
    const offset = (page - 1) * limit;

    // Execută query-ul cu paginare
    const [employees, total] = await queryBuilder
      .orderBy('employee.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // Dacă nu se cere parola, o eliminăm din răspuns

    const totalPages = Math.ceil(total / limit);

    return {
      employees,
      total,
      totalPages,
    };
  }

  // Găsirea unui angajat după ID
  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
    }

    // Load related collections separately to avoid join metadata issues
    const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
      this.workLocationHistoryRepository.find({ where: { employee_id: id } as any }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;

    return employee;
  }

  // Căutarea angajaților după email
  async findByEmail(email: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { email }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu email-ul ${email} nu a fost găsit`);
    }

    const id = employee.id;
    const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
      this.workLocationHistoryRepository.find({ where: { employee_id: id } as any }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;

    return employee;
  }

  // Găsirea unui angajat după telefon
  async findByPhone(phone: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { phone }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu numărul de telefon ${phone} nu a fost găsit`);
    }

    const id = employee.id;
    const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
      this.workLocationHistoryRepository.find({ where: { employee_id: id } as any }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;

    return employee;
  }

  // Căutarea angajaților după CNP
  async findByCNP(cnp: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { personal_number: cnp } });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu CNP-ul ${cnp} nu a fost găsit`);
    }

    const id = employee.id;
    const [workLocationHistory, employeeFiles, generatedDocuments] = await Promise.all([
      this.workLocationHistoryRepository.find({ where: { employee_id: id } as any }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;

    return employee;
  }

  // Actualizarea unui angajat
  async update(id: number, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);

    // Verifică unicitatea email-ului (dacă se schimbă)
    if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { email: updateEmployeeDto.email }
      });

      if (existingEmployee) {
        throw new ConflictException('Un angajat cu acest email există deja');
      }
    }

    // Verifică unicitatea CNP-ului (dacă se schimbă)
    if (updateEmployeeDto.personal_number && updateEmployeeDto.personal_number !== employee.personal_number) {
      const existingCNP = await this.employeeRepository.findOne({
        where: { personal_number: updateEmployeeDto.personal_number }
      });

      if (existingCNP) {
        throw new ConflictException('Un angajat cu acest CNP există deja');
      }
    }

    // Validări pentru date (dacă se actualizează)
    if (updateEmployeeDto.hire_date) {
      const hireDate = new Date(updateEmployeeDto.hire_date);
      hireDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (hireDate.getTime() > today.getTime()) {
        throw new BadRequestException('Data angajării nu poate fi în viitor');
      }
    }

    if (updateEmployeeDto.birth_date) {
      const birthDate = new Date(updateEmployeeDto.birth_date);
      const minAge = new Date();
      minAge.setFullYear(minAge.getFullYear() - 16);

      if (birthDate > minAge) {
        throw new BadRequestException('Angajatul trebuie să aibă cel puțin 16 ani');
      }
    }

    // Actualizează entitatea
    await this.employeeRepository.update(id, updateEmployeeDto);
    return await this.findOne(id);
  }

  // Ștergerea unui angajat
  async remove(id: number): Promise<{ message: string }> {
    const employee = await this.findOne(id);
    await this.employeeRepository.delete(id);
    
    return {
      message: `Angajatul ${employee.first_name} ${employee.last_name} a fost șters cu succes`,
    };
  }

  // Activarea/dezactivarea unui angajat
  async toggleActive(id: number): Promise<Employee> {
    const employee = await this.findOne(id);
    employee.is_active = !employee.is_active;
    
    return await this.employeeRepository.save(employee);
  }

  // Statistici angajați
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byContractType: { [key: string]: number };
    byGender: { [key: string]: number };
    hiredThisMonth: number;
  }> {
    const total = await this.employeeRepository.count();
    const active = await this.employeeRepository.count({ where: { is_active: true } });
    const inactive = total - active;

    // Statistici per tip de contract
    const contractTypes = await this.employeeRepository.createQueryBuilder('employee')
      .select('employee.contract_type', 'contract_type')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('employee.contract_type')
      .getRawMany();

    const byContractType = contractTypes.reduce((acc, curr) => {
      acc[curr.contract_type] = parseInt(curr.count);
      return acc;
    }, {});

    // Statistici per gen
    const genders = await this.employeeRepository.createQueryBuilder('employee')
      .select('employee.gender', 'gender')
      .addSelect('COUNT(employee.id)', 'count')
      .groupBy('employee.gender')
      .getRawMany();

    const byGender = genders.reduce((acc, curr) => {
      acc[curr.gender] = parseInt(curr.count);
      return acc;
    }, {});

    // Angajați din această lună
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const hiredThisMonth = await this.employeeRepository.count({
      where: {
        hire_date: MoreThanOrEqual(startOfMonth),
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

  // ==================== EMPLOYEE FILES METHODS ====================

  // Creează un nou fișier pentru angajat
  async createFile(createFileDto: CreateEmployeeFileDto): Promise<EmployeeFiles> {
    console.log('📥 Received createFileDto:', {
      employee_id: createFileDto.employee_id,
      file_name: createFileDto.file_name,
      file_type: createFileDto.file_type,
      has_content: !!createFileDto.file_content,
      content_length: createFileDto.file_content?.length || 0
    });
    
    // Verifică dacă angajatul există
    const employee = await this.employeeRepository.findOne({
      where: { id: createFileDto.employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${createFileDto.employee_id} nu a fost găsit`);
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException('Nu se pot adăuga fișiere pentru un angajat inactiv');
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileExtension = createFileDto.file_name.split('.').pop() || 'txt';
    const baseFileName = createFileDto.file_name.replace(/\.[^/.]+$/, "") || 'file';
    const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    console.log(`📝 Original: ${createFileDto.file_name}, Generated: ${uniqueFileName}`);

    // Update the file_link to use the unique filename
    const updatedFileLink = createFileDto.file_link.replace(createFileDto.file_name, uniqueFileName);

    // Create the directory if it doesn't exist
    const employeeId = createFileDto.employee_id?.toString() || 'unknown';
    console.log(`📁 Creating directory for employee ID: ${employeeId}`);
    const baseDir = this.getEmployeesFilesRootDir();
    const fileDir = path.join(baseDir, employeeId);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // If file content is provided (base64), save it to disk
    if (createFileDto.file_content) {
      try {
        const filePath = path.join(fileDir, uniqueFileName);
        
        // Extract base64 content from data URL (remove data:type;base64, prefix)
        let base64Data = createFileDto.file_content;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
      } catch (error) {
        console.error('❌ Error saving file to disk:', error);
        // Don't throw error - file is saved in DB even if disk save fails
      }
    }

    // Verifică dacă există deja un fișier cu același nume pentru același angajat
    const existingFile = await this.filesRepository.findOne({
      where: {
        employee_id: createFileDto.employee_id,
        file_name: uniqueFileName
      }
    });

    if (existingFile) {
      throw new ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru acest angajat`);
    }

    // Validări suplimentare pentru tipuri specifice de fișiere
    if (createFileDto.file_type === 'CV') {
      const existingCV = await this.filesRepository.findOne({
        where: {
          employee_id: createFileDto.employee_id,
          file_type: 'CV'
        }
      });

      if (existingCV) {
        throw new ConflictException('Angajatul are deja un CV încărcat. Vă rugăm să îl actualizați în loc să adăugați unul nou.');
      }
    }

    // Create the file record with unique filename
    const file = this.filesRepository.create({
      ...createFileDto,
      file_name: uniqueFileName,
      file_link: updatedFileLink
    });

    const savedFile = await this.filesRepository.save(file);
    console.log(`✅ File record saved to database with ID: ${savedFile.id}`);
    
    return savedFile;
  }

  // Găsește un fișier după ID
  async findOneFile(id: number): Promise<EmployeeFiles> {
    const file = await this.filesRepository.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
    }

    return file;
  }

  // Găsește toate fișierele unui angajat
  async findFilesByEmployee(employee_id: number): Promise<EmployeeFiles[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }

    return await this.filesRepository.find({
      where: { employee_id },
      relations: ['employee'],
      order: { updated_at: 'DESC' },
    });
  }

  // Servește fișierul de pe disk
  async serveFile(file_id: number, forceDownload: boolean = false): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
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
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
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

  // Determină tipul MIME bazat pe extensia fișierului
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
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

  // Șterge un fișier
  async removeFile(id: number): Promise<{ message: string }> {
    const file = await this.findOneFile(id);
    await this.filesRepository.delete(id);
    
    return {
      message: `Fișierul "${file.file_name}" al angajatului ${file.employee.first_name} ${file.employee.last_name} a fost șters cu succes`,
    };
  }

  // ==================== GENERATED DOCUMENTS METHODS ====================

  async createDocument(createDocumentDto: any): Promise<GeneratedDocuments> {
    const employee = await this.employeeRepository.findOne({ where: { id: createDocumentDto.employee_id } });
    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${createDocumentDto.employee_id} nu a fost găsit`);
    }
    if (!employee.is_active) {
      throw new BadRequestException('Nu se pot genera documente pentru un angajat inactiv');
    }
    const existingDocument = await this.documentsRepository.findOne({
      where: {
        employee_id: createDocumentDto.employee_id,
        doc_id: createDocumentDto.doc_id,
        status: 'Generated',
      },
    });
    if (existingDocument) {
      throw new ConflictException(`Există deja un document activ cu ID-ul ${createDocumentDto.doc_id} pentru acest angajat`);
    }
    if (createDocumentDto.status === 'Signed' && !createDocumentDto.signed_at) {
      throw new BadRequestException('Data semnării este obligatorie pentru documentele semnate');
    }
    if (createDocumentDto.signed_at && createDocumentDto.expired_date) {
      const signedDate = new Date(createDocumentDto.signed_at);
      const expiredDate = new Date(createDocumentDto.expired_date);
      if (signedDate >= expiredDate) {
        throw new BadRequestException('Data expirării trebuie să fie după data semnării');
      }
    }
    const document: GeneratedDocuments = this.documentsRepository.create(createDocumentDto as Partial<GeneratedDocuments>);
    return await this.documentsRepository.save(document);
  }

  async documentsFindAll(params: { page?: number; limit?: number; employee_id?: number; status?: string; doc_id?: number }): Promise<{ documents: GeneratedDocuments[]; total: number; totalPages: number }> {
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

  async documentFindOne(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentsRepository.findOne({ where: { id }, relations: ['employee'] });
    if (!document) {
      throw new NotFoundException(`Documentul cu ID-ul ${id} nu a fost găsit`);
    }
    return document;
  }

  async documentsFindByEmployee(employee_id: number): Promise<GeneratedDocuments[]> {
    const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }
    return await this.documentsRepository.find({
      where: { employee_id },
      relations: ['employee'],
      order: { signed_at: 'DESC', id: 'DESC' },
    });
  }

  async documentsFindByStatus(status: string): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({ where: { status }, relations: ['employee'], order: { signed_at: 'DESC' } });
  }

  async documentsFindByDocId(doc_id: number): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({ where: { doc_id }, relations: ['employee'], order: { signed_at: 'DESC' } });
  }

  async documentsFindExpired(): Promise<GeneratedDocuments[]> {
    const currentDate = new Date();
    return await this.documentsRepository.find({
      where: { expired_date: LessThan(currentDate), status: 'Signed' },
      relations: ['employee'],
      order: { expired_date: 'ASC' },
    });
  }

  async documentsUpdate(id: number, updateDocumentDto: any): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (updateDocumentDto.employee_id && updateDocumentDto.employee_id !== document.employee_id) {
      const employee = await this.employeeRepository.findOne({ where: { id: updateDocumentDto.employee_id } });
      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateDocumentDto.employee_id} nu a fost găsit`);
      }
    }
    if (updateDocumentDto.status === 'Signed' && !updateDocumentDto.signed_at && !document.signed_at) {
      throw new BadRequestException('Data semnării este obligatorie pentru documentele semnate');
    }
    const signedAt = updateDocumentDto.signed_at || document.signed_at;
    const expiredDate = updateDocumentDto.expired_date || document.expired_date;
    if (signedAt && expiredDate) {
      const signedDate = new Date(signedAt);
      const expiredDateObj = new Date(expiredDate);
      if (signedDate >= expiredDateObj) {
        throw new BadRequestException('Data expirării trebuie să fie după data semnării');
      }
    }
    await this.documentsRepository.update(id, updateDocumentDto);
    return await this.documentFindOne(id);
  }

  async documentsSign(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (document.status === 'Signed') {
      throw new BadRequestException('Documentul este deja semnat');
    }
    if (document.status === 'Expired' || document.status === 'Cancelled') {
      throw new BadRequestException('Nu se poate semna un document expirat sau anulat');
    }
    await this.documentsRepository.update(id, { status: 'Signed', signed_at: new Date() });
    return await this.documentFindOne(id);
  }

  async documentsCancel(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (document.status === 'Cancelled') {
      throw new BadRequestException('Documentul este deja anulat');
    }
    if (document.status === 'Expired') {
      throw new BadRequestException('Nu se poate anula un document expirat');
    }
    await this.documentsRepository.update(id, { status: 'Cancelled' });
    return await this.documentFindOne(id);
  }

  async documentsRemove(id: number): Promise<{ message: string }> {
    const document = await this.documentFindOne(id);
    if (document.status === 'Signed') {
      throw new BadRequestException('Nu se pot șterge documentele semnate. Vă rugăm să le anulați mai întâi.');
    }
    await this.documentsRepository.delete(id);
    return { message: `Documentul pentru angajatul ${document.employee.first_name} ${document.employee.last_name} a fost șters cu succes` };
  }

  async documentsStatistics(): Promise<{ total: number; byStatus: { [key: string]: number }; byEmployee: { [key: string]: number }; expiringSoon: number; recentlySigned: number; byDocType: { [key: string]: number } }> {
    const total = await this.documentsRepository.count();
    const statusStats = await this.documentsRepository
      .createQueryBuilder('document')
      .select('document.status', 'status')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.status')
      .getRawMany();
    const byStatus = statusStats.reduce((acc: any, curr: any) => {
      acc[curr.status] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);
    const employeeStats = await this.documentsRepository
      .createQueryBuilder('document')
      .select('document.employee_id', 'employee_id')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.employee_id')
      .getRawMany();
    const byEmployee = employeeStats.reduce((acc: any, curr: any) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await this.documentsRepository.count({ where: { expired_date: LessThan(thirtyDaysFromNow), status: 'Signed' } });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlySigned = await this.documentsRepository.count({ where: { signed_at: MoreThanOrEqual(sevenDaysAgo as any), status: 'Signed' } as any });
    const docTypeStats = await this.documentsRepository
      .createQueryBuilder('document')
      .select('document.doc_id', 'doc_id')
      .addSelect('COUNT(document.id)', 'count')
      .groupBy('document.doc_id')
      .getRawMany();
    const byDocType = docTypeStats.reduce((acc: any, curr: any) => {
      acc[`DocType_${curr.doc_id}`] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);
    return { total, byStatus, byEmployee, expiringSoon, recentlySigned, byDocType };
  }

  // ==================== WORK LOCATION HISTORY METHODS ====================

  async createWorkHistory(createHistoryDto: any): Promise<EmployeeWorkLocationHistory> {
    const employee = await this.employeeRepository.findOne({ where: { id: createHistoryDto.employee_id } });
    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${createHistoryDto.employee_id} nu a fost găsit`);
    }
    if (!employee.is_active) {
      throw new BadRequestException('Nu se poate adăuga istoric pentru un angajat inactiv');
    }
    const history: EmployeeWorkLocationHistory = this.workLocationHistoryRepository.create(createHistoryDto as Partial<EmployeeWorkLocationHistory>);
    return await this.workLocationHistoryRepository.save(history);
  }

  async workHistoryFindAll(params: { page?: number; limit?: number; employee_id?: number; work_location_id?: number }): Promise<{ history: EmployeeWorkLocationHistory[]; total: number; totalPages: number }> {
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

  async workHistoryFindOne(id: number): Promise<EmployeeWorkLocationHistory> {
    const history = await this.workLocationHistoryRepository.findOne({ where: { id }, relations: ['employee'] });
    if (!history) {
      throw new NotFoundException(`Înregistrarea din istoric cu ID-ul ${id} nu a fost găsită`);
    }
    return history;
  }

  async workHistoryFindByEmployee(employee_id: number): Promise<EmployeeWorkLocationHistory[]> {
    const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }
    return await this.workLocationHistoryRepository.find({ where: { employee_id }, relations: ['employee'], order: { created_at: 'DESC' } });
  }

  async workHistoryFindByWorkLocation(work_location_id: number): Promise<EmployeeWorkLocationHistory[]> {
    return await this.workLocationHistoryRepository.find({ where: { work_location_id }, relations: ['employee'], order: { created_at: 'DESC' } });
  }

  async workHistoryUpdate(id: number, updateHistoryDto: any): Promise<EmployeeWorkLocationHistory> {
    const history = await this.workHistoryFindOne(id);
    if (updateHistoryDto.employee_id && updateHistoryDto.employee_id !== history.employee_id) {
      const employee = await this.employeeRepository.findOne({ where: { id: updateHistoryDto.employee_id } });
      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateHistoryDto.employee_id} nu a fost găsit`);
      }
    }
    await this.workLocationHistoryRepository.update(id, updateHistoryDto);
    return await this.workHistoryFindOne(id);
  }

  async workHistoryRemove(id: number): Promise<{ message: string }> {
    const history = await this.workHistoryFindOne(id);
    await this.workLocationHistoryRepository.delete(id);
    return { message: `Înregistrarea din istoric pentru angajatul ${history.employee.first_name} ${history.employee.last_name} a fost ștearsă cu succes` };
  }

  async workHistoryStatistics(): Promise<{ total: number; byEmployee: { [key: string]: number }; byWorkLocation: { [key: string]: number }; recentChanges: number }> {
    const total = await this.workLocationHistoryRepository.count();
    const employeeStats = await this.workLocationHistoryRepository
      .createQueryBuilder('history')
      .select('history.employee_id', 'employee_id')
      .addSelect('COUNT(history.id)', 'count')
      .groupBy('history.employee_id')
      .getRawMany();
    const byEmployee = employeeStats.reduce((acc: any, curr: any) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);
    const locationStats = await this.workLocationHistoryRepository
      .createQueryBuilder('history')
      .select('history.work_location_id', 'work_location_id')
      .addSelect('COUNT(history.id)', 'count')
      .groupBy('history.work_location_id')
      .getRawMany();
    const byWorkLocation = locationStats.reduce((acc: any, curr: any) => {
      acc[`Location_${curr.work_location_id}`] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recentChanges = await this.workLocationHistoryRepository.count({ where: { created_at: MoreThanOrEqual(lastMonth as any) } as any });
    return { total, byEmployee, byWorkLocation, recentChanges };
  }

  // ==================== EMPLOYEE FILES EXTRA METHODS ====================

  async findAllFiles(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    file_type?: string,
  ): Promise<{ files: EmployeeFiles[]; total: number; totalPages: number }> {
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

  async filesStatistics(): Promise<{
    total: number;
    byFileType: { [key: string]: number };
    byEmployee: { [key: string]: number };
    recentUploads: number;
    averageFilesPerEmployee: number;
  }> {
    const total = await this.filesRepository.count();

    const fileTypeStats = await this.filesRepository
      .createQueryBuilder('file')
      .select('file.file_type', 'file_type')
      .addSelect('COUNT(file.id)', 'count')
      .groupBy('file.file_type')
      .getRawMany();

    const byFileType = fileTypeStats.reduce((acc: any, curr: any) => {
      acc[curr.file_type] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);

    const employeeStats = await this.filesRepository
      .createQueryBuilder('file')
      .select('file.employee_id', 'employee_id')
      .addSelect('COUNT(file.id)', 'count')
      .groupBy('file.employee_id')
      .getRawMany();

    const byEmployee = employeeStats.reduce((acc: any, curr: any) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {} as Record<string, number>);

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const recentUploads = await this.filesRepository.count({ where: { updated_at: MoreThanOrEqual(lastMonth as any) } as any });

    const totalEmployees = await this.employeeRepository.count();
    const averageFilesPerEmployee = totalEmployees > 0 ? Math.round((total / totalEmployees) * 100) / 100 : 0;

    return { total, byFileType, byEmployee, recentUploads, averageFilesPerEmployee };
  }

  async findFilesByType(file_type: string): Promise<EmployeeFiles[]> {
    return await this.filesRepository.find({ where: { file_type }, relations: ['employee'], order: { updated_at: 'DESC' } });
  }

  async updateFile(id: number, updateFileDto: UpdateEmployeeFileDto): Promise<EmployeeFiles> {
    const file = await this.findOneFile(id);

    if (updateFileDto.employee_id && updateFileDto.employee_id !== file.employee_id) {
      const employee = await this.employeeRepository.findOne({ where: { id: updateFileDto.employee_id } });
      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateFileDto.employee_id} nu a fost găsit`);
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
        throw new ConflictException(`Un fișier cu numele "${updateFileDto.file_name}" există deja pentru acest angajat`);
      }
    }

    await this.filesRepository.update(id, updateFileDto);
    return await this.findOneFile(id);
  }

  async removeAllFilesByEmployee(employee_id: number): Promise<{ message: string; deletedCount: number }> {
    const employee = await this.employeeRepository.findOne({ where: { id: employee_id } });
    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }

    const files = await this.filesRepository.find({ where: { employee_id } });
    const deletedCount = files.length;

    if (deletedCount > 0) {
      await this.filesRepository.delete({ employee_id } as any);
    }

    return {
      message: `Au fost șterse ${deletedCount} fișiere pentru angajatul ${employee.first_name} ${employee.last_name}`,
      deletedCount,
    };
  }

  async validateFileAccess(file_id: number, employee_id?: number): Promise<boolean> {
    const file = await this.findOneFile(file_id);
    if (employee_id && file.employee_id !== employee_id) {
      return false;
    }
    return true;
  }

}