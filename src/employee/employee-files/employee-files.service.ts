import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeFiles } from '../entity/employee-files.entity';
import { Employee } from '../entity/employee.entity';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { UpdateEmployeeFileDto } from './dto/update-employee-file.dto';

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

    // Verifică dacă există deja un fișier cu același nume pentru același angajat
    const existingFile = await this.filesRepository.findOne({
      where: {
        employee_id: createFileDto.employee_id,
        file_name: createFileDto.file_name
      }
    });

    if (existingFile) {
      throw new ConflictException(`Un fișier cu numele "${createFileDto.file_name}" există deja pentru acest angajat`);
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

    const file = this.filesRepository.create(createFileDto);
    return await this.filesRepository.save(file);
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
} 