import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entity/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
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

    // Validează data angajării (nu poate fi în viitor)
    const hireDate = new Date(createEmployeeDto.hire_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (hireDate > today) {
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

      if (hireDate > today) {
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
} 