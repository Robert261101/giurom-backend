import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeFiles } from '../entity/employee-files.entity';
import { Employee } from '../entity/employee.entity';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { UpdateEmployeeFileDto } from './dto/update-employee-file.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EmployeeFilesService {
  constructor(
    @InjectRepository(EmployeeFiles)
    private filesRepository: Repository<EmployeeFiles>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  // Creează un nou fișier pentru angajat
  async create(createFileDto: CreateEmployeeFileDto): Promise<EmployeeFiles> {
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
    const fileDir = path.join(process.cwd(), '..', 'files', 'employees', employeeId);
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

  // Găsește toate fișierele cu filtrare
  async findAll(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    file_type?: string,
  ): Promise<{ files: EmployeeFiles[]; total: number; totalPages: number }> {
    const queryBuilder = this.filesRepository.createQueryBuilder('file')
      .leftJoinAndSelect('file.employee', 'employee');

    // Aplică filtrele
    if (employee_id) {
      queryBuilder.andWhere('file.employee_id = :employee_id', { employee_id });
    }

    if (file_type) {
      queryBuilder.andWhere('file.file_type = :file_type', { file_type });
    }

    // Paginare
    const offset = (page - 1) * limit;
    const [files, total] = await queryBuilder
      .orderBy('file.updated_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      files,
      total,
      totalPages,
    };
  }

  // Găsește un fișier după ID
  async findOne(id: number): Promise<EmployeeFiles> {
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
  async findByEmployee(employee_id: number): Promise<EmployeeFiles[]> {
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

  // Găsește fișiere după tip
  async findByType(file_type: string): Promise<EmployeeFiles[]> {
    return await this.filesRepository.find({
      where: { file_type },
      relations: ['employee'],
      order: { updated_at: 'DESC' },
    });
  }

  // Actualizează un fișier
  async update(id: number, updateFileDto: UpdateEmployeeFileDto): Promise<EmployeeFiles> {
    const file = await this.findOne(id);

    // Verifică FK-urile dacă sunt schimbate
    if (updateFileDto.employee_id && updateFileDto.employee_id !== file.employee_id) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateFileDto.employee_id }
      });

      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateFileDto.employee_id} nu a fost găsit`);
      }
    }

    // Verifică unicitatea numelui de fișier dacă se schimbă
    if (updateFileDto.file_name && updateFileDto.file_name !== file.file_name) {
      const existingFile = await this.filesRepository.findOne({
        where: {
          employee_id: updateFileDto.employee_id || file.employee_id,
          file_name: updateFileDto.file_name
        }
      });

      if (existingFile && existingFile.id !== id) {
        throw new ConflictException(`Un fișier cu numele "${updateFileDto.file_name}" există deja pentru acest angajat`);
      }
    }

    await this.filesRepository.update(id, updateFileDto);
    return await this.findOne(id);
  }

  // Șterge un fișier
  async remove(id: number): Promise<{ message: string }> {
    const file = await this.findOne(id);
    await this.filesRepository.delete(id);
    
    return {
      message: `Fișierul "${file.file_name}" al angajatului ${file.employee.first_name} ${file.employee.last_name} a fost șters cu succes`,
    };
  }

  // Șterge toate fișierele unui angajat
  async removeAllByEmployee(employee_id: number): Promise<{ message: string; deletedCount: number }> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
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

  // Statistici fișiere
  async getStatistics(): Promise<{
    total: number;
    byFileType: { [key: string]: number };
    byEmployee: { [key: string]: number };
    recentUploads: number;
    averageFilesPerEmployee: number;
  }> {
    const total = await this.filesRepository.count();

    // Statistici per tip de fișier
    const fileTypeStats = await this.filesRepository.createQueryBuilder('file')
      .select('file.file_type', 'file_type')
      .addSelect('COUNT(file.id)', 'count')
      .groupBy('file.file_type')
      .getRawMany();

    const byFileType = fileTypeStats.reduce((acc, curr) => {
      acc[curr.file_type] = parseInt(curr.count);
      return acc;
    }, {});

    // Statistici per angajat
    const employeeStats = await this.filesRepository.createQueryBuilder('file')
      .select('file.employee_id', 'employee_id')
      .addSelect('COUNT(file.id)', 'count')
      .groupBy('file.employee_id')
      .getRawMany();

    const byEmployee = employeeStats.reduce((acc, curr) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {});

    // Fișiere încărcate în ultima lună
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const recentUploads = await this.filesRepository.count({
      where: {
        updated_at: {
          $gte: lastMonth,
        } as any,
      },
    });

    // Media fișierelor per angajat
    const totalEmployees = await this.employeeRepository.count();
    const averageFilesPerEmployee = totalEmployees > 0 ? Math.round((total / totalEmployees) * 100) / 100 : 0;

    return {
      total,
      byFileType,
      byEmployee,
      recentUploads,
      averageFilesPerEmployee,
    };
  }

  // Validează și verifică accesul la fișier
  async validateFileAccess(file_id: number, employee_id?: number): Promise<boolean> {
    const file = await this.findOne(file_id);
    
    if (employee_id && file.employee_id !== employee_id) {
      return false;
    }

    // TODO: Adaugă verificări suplimentare de securitate
    // Ex: verificare role utilizator, permisiuni de acces la fișiere

    return true;
  }

  // Servește fișierul de pe disk
  async serveFile(file_id: number, forceDownload: boolean = false, res: any): Promise<any> {
    console.log(`🔍 Serving file with ID: ${file_id}, forceDownload: ${forceDownload}`);
    
    const file = await this.findOne(file_id);
    console.log(`📄 File metadata:`, {
      id: file.id,
      name: file.file_name,
      employee_id: file.employee_id,
      file_link: file.file_link
    });
    
    // Construiește calea către fișier
    const filePath = path.join(process.cwd(), '..', 'files', 'employees', file.employee_id.toString(), file.file_name);
    
    console.log(`📁 Serving file from: ${filePath}`);
    console.log(`📁 Current working directory: ${process.cwd()}`);
    
    // Verifică dacă fișierul există pe disk
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found on disk: ${filePath}`);
      // Să verific și alte căi posibile
      const altPath1 = path.join(process.cwd(), 'files', 'employees', file.employee_id.toString(), file.file_name);
      const altPath2 = path.join(process.cwd(), '..', '..', 'files', 'employees', file.employee_id.toString(), file.file_name);
      console.log(`🔍 Checking alternative paths:`);
      console.log(`   ${altPath1} - exists: ${fs.existsSync(altPath1)}`);
      console.log(`   ${altPath2} - exists: ${fs.existsSync(altPath2)}`);
      throw new NotFoundException('Fișierul nu a fost găsit pe disk');
    }
    
    // Determină tipul MIME
    const mimeType = this.getMimeType(file.file_name);
    console.log(`📋 MIME type determined: ${mimeType}`);
    
    // Setează header-ele pentru răspuns
    res.setHeader('Content-Type', mimeType);
    
    if (forceDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
    }
    
    // Citește și trimite fișierul
    const fileBuffer = fs.readFileSync(filePath);
    console.log(`✅ File served successfully: ${file.file_name} (${fileBuffer.length} bytes)`);
    
    return res.send(fileBuffer);
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
} 