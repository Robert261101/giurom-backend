import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entity/employee.entity';
import { EmployeeFiles } from './entity/employee-files.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeFiles)
    private employeeFilesRepository: Repository<EmployeeFiles>,
  ) {}

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

    // Validează data angajării (poate fi în viitor dar nu mai mult de 1 an)
    const hireDate = new Date(createEmployeeDto.hire_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
    maxFutureDate.setHours(0, 0, 0, 0);

    if (hireDate > maxFutureDate) {
      throw new BadRequestException('Data angajării nu poate fi mai mult de 1 an în viitor');
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

    // Calculează offset-ul pentru paginare
    const offset = (page - 1) * limit;

    // Execută query-ul cu paginare
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

  // Găsirea unui angajat după ID
  async findOne(id: number): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      relations: ['workLocationHistory', 'employeeFiles', 'generatedDocuments'],
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
    }

    return employee;
  }

  // Căutarea angajaților după email
  async findByEmail(email: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { email },
      relations: ['workLocationHistory', 'employeeFiles', 'generatedDocuments'],
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu email-ul ${email} nu a fost găsit`);
    }

    return employee;
  }

  // Căutarea angajaților după CNP
  async findByCNP(cnp: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { personal_number: cnp },
      relations: ['workLocationHistory', 'employeeFiles', 'generatedDocuments'],
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu CNP-ul ${cnp} nu a fost găsit`);
    }

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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxFutureDate = new Date();
      maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
      maxFutureDate.setHours(0, 0, 0, 0);

      if (hireDate > maxFutureDate) {
        throw new BadRequestException('Data angajării nu poate fi mai mult de 1 an în viitor');
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
        hire_date: {
          $gte: startOfMonth,
        } as any,
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

  // Crearea unui angajat cu documente
  async createWithDocuments(dto: CreateEmployeeDto & { documents?: any[] }): Promise<Employee> {
    // Verifică dacă email-ul există deja
    const existingEmployee = await this.employeeRepository.findOne({
      where: { email: dto.email }
    });

    if (existingEmployee) {
      throw new ConflictException('Un angajat cu acest email există deja');
    }

    // Verifică dacă CNP-ul există deja
    const existingCNP = await this.employeeRepository.findOne({
      where: { personal_number: dto.personal_number }
    });

    if (existingCNP) {
      throw new ConflictException('Un angajat cu acest CNP există deja');
    }

    // Validează data angajării (poate fi în viitor dar nu mai mult de 1 an)
    const hireDate = new Date(dto.hire_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
    maxFutureDate.setHours(0, 0, 0, 0);

    if (hireDate > maxFutureDate) {
      throw new BadRequestException('Data angajării nu poate fi mai mult de 1 an în viitor');
    }

    // Validează data nașterii (angajatul trebuie să aibă cel puțin 16 ani)
    const birthDate = new Date(dto.birth_date);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 16);

    if (birthDate > minAge) {
      throw new BadRequestException('Angajatul trebuie să aibă cel puțin 16 ani');
    }

    // Validează data încetării contractului (dacă există)
    if (dto.termination_date) {
      const terminationDate = new Date(dto.termination_date);
      if (terminationDate <= hireDate) {
        throw new BadRequestException('Data încetării contractului trebuie să fie după data angajării');
      }
    }

    // Extrage datele pentru angajat (fără documents)
    const { documents, ...employeeData } = dto;
    
    // Creează angajatul
    const employee = this.employeeRepository.create(employeeData);
    const savedEmployee = await this.employeeRepository.save(employee);

    // Salvează documentele dacă există
    if (dto.documents && dto.documents.length > 0) {
      await this.saveEmployeeDocuments(savedEmployee, dto.documents);
    }

    return savedEmployee;
  }

  /**
   * Salvează documentele unui angajat în folderul local
   */
  private async saveEmployeeDocuments(employee: Employee, documents: any[]): Promise<void> {
    // Creează folderul pentru angajat în files/employees
    const projectRoot = path.join(process.cwd(), '..');
    const filesDir = path.join(projectRoot, 'files');
    const employeesDir = path.join(filesDir, 'employees');
    const employeeDir = path.join(employeesDir, employee.id.toString());

    // Creează directoarele dacă nu există
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(employeesDir)) fs.mkdirSync(employeesDir, { recursive: true });
    if (!fs.existsSync(employeeDir)) fs.mkdirSync(employeeDir, { recursive: true });

    // Salvează fiecare document
    for (const doc of documents) {
      try {
        // Generează un nume unic pentru fișier cu ID-ul angajatului
        const fileName = doc.fileName || doc.name;
        const timestamp = Date.now();
        const uniqueFileName = `${employee.id}_${timestamp}_${fileName}`;
        const filePath = path.join(employeeDir, uniqueFileName);
        
        // Salvează fișierul real din conținutul base64
        if (doc.content && doc.content.startsWith('data:')) {
          // Extract base64 content (remove data:mime/type;base64, prefix)
          const base64Data = doc.content.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(filePath, buffer);
          console.log(`✅ Document angajat salvat fizic (${buffer.length} bytes): ${filePath}`);
        } else {
          // Fallback: create a text file with document info if no content
          const fileContent = `Document: ${fileName}
Tip: ${doc.document_type || 'Document general'}
Note: ${doc.note || doc.notes || 'Fără note'}
Data upload: ${new Date().toISOString()}
Angajat: ${employee.first_name} ${employee.last_name}
Email: ${employee.email}
CNP: ${employee.personal_number}`;
          fs.writeFileSync(filePath, fileContent, 'utf8');
          console.log(`✅ Document info angajat salvat fizic: ${filePath}`);
        }

        // Calculează dimensiunea fișierului
        const stats = fs.statSync(filePath);
        const fileSizeInBytes = stats.size;

        // Salvează informațiile în baza de date (folosind noua structură)
        const documentData = {
          employee_id: employee.id,
          file_name: fileName,
          file_type: doc.type?.split('/')[1] || 'unknown', // Extract extension from mime type
          file_link: `/files/employees/${employee.id}/${uniqueFileName}`,
        };

        const document = this.employeeFilesRepository.create(documentData);
        await this.employeeFilesRepository.save(document);
        
        console.log(`✅ Document angajat salvat în DB: ${fileName}`);
      } catch (error) {
        console.error('Error saving employee document:', error);
        // Continue cu următorul document chiar dacă unul eșuează
      }
    }
  }

  // Files management methods for compatibility with frontend
  async getEmployeeFiles(employeeId: number): Promise<EmployeeFiles[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employeeId} nu a fost găsit`);
    }

    return await this.employeeFilesRepository.find({
      where: { employee_id: employeeId },
      order: { updated_at: 'DESC' },
    });
  }

  async addEmployeeFile(employeeId: number, fileData: any): Promise<EmployeeFiles> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employeeId} nu a fost găsit`);
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException('Nu se pot adăuga fișiere pentru un angajat inactiv');
    }

    // Creează folderul pentru angajat dacă nu există
    const projectRoot = path.join(process.cwd(), '..');
    const filesDir = path.join(projectRoot, 'files');
    const employeesDir = path.join(filesDir, 'employees');
    const employeeDir = path.join(employeesDir, employeeId.toString());

    // Creează directoarele dacă nu există
    if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
    if (!fs.existsSync(employeesDir)) fs.mkdirSync(employeesDir, { recursive: true });
    if (!fs.existsSync(employeeDir)) fs.mkdirSync(employeeDir, { recursive: true });

    // Generează un nume unic pentru fișier
    const timestamp = Date.now();
    const uniqueFileName = `${employeeId}_${timestamp}_${fileData.file_name}`;
    const filePath = path.join(employeeDir, uniqueFileName);
    
    // Creează un fișier placeholder (în realitate ar trebui să primești conținutul fișierului)
    const fileContent = `Document: ${fileData.file_name}
Tip: ${fileData.file_type}
Data upload: ${new Date().toISOString()}
Angajat ID: ${employeeId}
Link: ${fileData.file_link}

Nota: Acest fișier a fost creat ca placeholder. 
Pentru a salva fișierul real, frontend-ul trebuie să trimită conținutul fișierului.`;
    
    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`✅ Placeholder file created: ${filePath}`);

    // Actualizează file_link să pointeze la fișierul real
    const actualFileLink = `/files/employees/${employeeId}/${uniqueFileName}`;

    const file = this.employeeFilesRepository.create({
      employee_id: employeeId,
      file_name: fileData.file_name,
      file_type: fileData.file_type,
      file_link: actualFileLink,
    });

    return await this.employeeFilesRepository.save(file);
  }

  async deleteEmployeeFile(fileId: number): Promise<{ message: string }> {
    const file = await this.employeeFilesRepository.findOne({
      where: { id: fileId },
      relations: ['employee'],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${fileId} nu a fost găsit`);
    }

    await this.employeeFilesRepository.delete(fileId);
    
    return {
      message: `Fișierul "${file.file_name}" a fost șters cu succes`,
    };
  }

  
  async addEmployeeDocumentsWithContent(employeeId: number, documents: any[]): Promise<EmployeeFiles[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employeeId} nu a fost găsit`);
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException('Nu se pot adăuga fișiere pentru un angajat inactiv');
    }

    // Use the existing saveEmployeeDocuments method
    await this.saveEmployeeDocuments(employee, documents);

    // Return the newly added files
    return await this.employeeFilesRepository.find({
      where: { employee_id: employeeId },
      order: { updated_at: 'DESC' },
      take: documents.length
    });
  }

  async getFileInfo(fileId: number) {
    const file = await this.employeeFilesRepository.findOne({
      where: { id: fileId },
      relations: ['employee'],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${fileId} nu a fost găsit`);
    }

    const projectRoot = path.join(process.cwd(), '..');
    let filePath = file.file_link;
    
    if (filePath.startsWith('/')) {
      filePath = path.join(projectRoot, filePath.substring(1));
    } else {
      filePath = path.join(projectRoot, filePath);
    }

    const exists = fs.existsSync(filePath);
    let stats = null;
    
    if (exists) {
      stats = fs.statSync(filePath);
    }

    return {
      file: {
        id: file.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_link: file.file_link,
        employee_id: file.employee_id,
      },
      paths: {
        original: file.file_link,
        resolved: filePath,
        projectRoot,
        backendCwd: process.cwd(),
      },
      fileSystem: {
        exists,
        stats: stats ? {
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          mtime: stats.mtime,
        } : null,
      },
    };
  }

  async serveEmployeeFile(fileId: number, forceDownload: boolean = false, res: any) {
    try {
      const file = await this.employeeFilesRepository.findOne({
        where: { id: fileId },
        relations: ['employee'],
      });

      if (!file) {
        throw new NotFoundException(`Fișierul cu ID-ul ${fileId} nu a fost găsit`);
      }

      // Construiește calea completă - file.file_link este relativă la directorul părinte (project root)
      // Calea din DB: /files/employees/9/9_1754499659846_Trigonometrie.pdf
      // Trebuie să fie: ../files/employees/9/9_1754499659846_Trigonometrie.pdf (relativ la backend)
      
      const projectRoot = path.join(process.cwd(), '..');
      let filePath = file.file_link;
      
      // Dacă calea începe cu '/', o tratăm ca relativă la project root
      if (filePath.startsWith('/')) {
        filePath = path.join(projectRoot, filePath.substring(1));
      } else {
        filePath = path.join(projectRoot, filePath);
      }
      
      console.log(`🔍 Attempting to serve file: ${file.file_link}`);
      console.log(`🔍 Full resolved path: ${filePath}`);
      console.log(`🔍 Backend working directory: ${process.cwd()}`);
      console.log(`🔍 Project root directory: ${projectRoot}`);
      
      // Verifică dacă fișierul există pe disk
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found on disk: ${filePath}`);
        console.error(`❌ Original path from DB: ${file.file_link}`);
        console.error(`❌ Tried to resolve to: ${filePath}`);
        throw new NotFoundException(`Fișierul fizic nu a fost găsit: ${filePath}`);
      }

      // Determină tipul de conținut pe baza extensiei
      const ext = path.extname(file.file_name).toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (ext) {
        case '.pdf':
          contentType = 'application/pdf';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
      }

      console.log(`📄 Serving file with content type: ${contentType}`);

      // Obține dimensiunea fișierului
      const stats = fs.statSync(filePath);
      
      // Setează header-ele pentru răspuns
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size.toString());
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Accept-Ranges', 'bytes');
      
      // CORS headers - setate și în controller dar le setăm și aici pentru siguranță
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition');
      
      // Pentru PDF-uri, adaugă header-e suplimentare pentru a permite embedding
      if (ext === '.pdf') {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:3000");
      }
      
      if (forceDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      }
      
      console.log(`📄 Serving file: ${file.file_name} (${stats.size} bytes, ${contentType})`);
      console.log(`📄 Headers set for file serving`);

      // Citește și returnează fișierul
      const fileStream = fs.createReadStream(filePath);
      
      fileStream.on('error', (error) => {
        console.error(`❌ Error reading file stream:`, error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Eroare la citirea fișierului' });
        }
      });

      fileStream.pipe(res);
      
    } catch (error) {
      console.error(`❌ Error in serveEmployeeFile:`, error);
      if (!res.headersSent) {
        if (error instanceof NotFoundException) {
          res.status(404).json({ message: error.message });
        } else {
          res.status(500).json({ message: 'Eroare internă la servirea fișierului' });
        }
      }
    }
  }

} 