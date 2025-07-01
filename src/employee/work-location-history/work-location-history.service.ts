import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeWorkLocationHistory } from '../entity/employee-work-location-history.entity';
import { Employee } from '../entity/employee.entity';
import { CreateWorkLocationHistoryDto } from './dto/create-work-location-history.dto';
import { UpdateWorkLocationHistoryDto } from './dto/update-work-location-history.dto';

@Injectable()
export class WorkLocationHistoryService {
  constructor(
    @InjectRepository(EmployeeWorkLocationHistory)
    private historyRepository: Repository<EmployeeWorkLocationHistory>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
  ) {}

  // Creează o nouă înregistrare în istoric
  async create(createHistoryDto: CreateWorkLocationHistoryDto): Promise<EmployeeWorkLocationHistory> {
    // Verifică dacă angajatul există
    const employee = await this.employeeRepository.findOne({
      where: { id: createHistoryDto.employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${createHistoryDto.employee_id} nu a fost găsit`);
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException('Nu se poate adăuga istoric pentru un angajat inactiv');
    }

    // TODO: Verifică dacă work_location_id există în tabela work_locations
    // Această verificare va fi activă când modulul Locations va fi integrat

    const history = this.historyRepository.create(createHistoryDto);
    return await this.historyRepository.save(history);
  }

  // Găsește toate înregistrările din istoric cu filtrare
  async findAll(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    work_location_id?: number,
  ): Promise<{ history: EmployeeWorkLocationHistory[]; total: number; totalPages: number }> {
    const queryBuilder = this.historyRepository.createQueryBuilder('history')
      .leftJoinAndSelect('history.employee', 'employee');

    // Aplică filtrele
    if (employee_id) {
      queryBuilder.andWhere('history.employee_id = :employee_id', { employee_id });
    }

    if (work_location_id) {
      queryBuilder.andWhere('history.work_location_id = :work_location_id', { work_location_id });
    }

    // Paginare
    const offset = (page - 1) * limit;
    const [history, total] = await queryBuilder
      .orderBy('history.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      history,
      total,
      totalPages,
    };
  }

  // Găsește o înregistrare după ID
  async findOne(id: number): Promise<EmployeeWorkLocationHistory> {
    const history = await this.historyRepository.findOne({
      where: { id },
      relations: ['employee'],
    });

    if (!history) {
      throw new NotFoundException(`Înregistrarea din istoric cu ID-ul ${id} nu a fost găsită`);
    }

    return history;
  }

  // Găsește istoricul unui angajat
  async findByEmployee(employee_id: number): Promise<EmployeeWorkLocationHistory[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id }
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${employee_id} nu a fost găsit`);
    }

    return await this.historyRepository.find({
      where: { employee_id },
      relations: ['employee'],
      order: { created_at: 'DESC' },
    });
  }

  // Găsește toate înregistrările pentru o locație
  async findByWorkLocation(work_location_id: number): Promise<EmployeeWorkLocationHistory[]> {
    return await this.historyRepository.find({
      where: { work_location_id },
      relations: ['employee'],
      order: { created_at: 'DESC' },
    });
  }

  // Actualizează o înregistrare din istoric
  async update(id: number, updateHistoryDto: UpdateWorkLocationHistoryDto): Promise<EmployeeWorkLocationHistory> {
    const history = await this.findOne(id);

    // Verifică FK-urile dacă sunt schimbate
    if (updateHistoryDto.employee_id && updateHistoryDto.employee_id !== history.employee_id) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateHistoryDto.employee_id }
      });

      if (!employee) {
        throw new NotFoundException(`Angajatul cu ID-ul ${updateHistoryDto.employee_id} nu a fost găsit`);
      }
    }

    await this.historyRepository.update(id, updateHistoryDto);
    return await this.findOne(id);
  }

  // Șterge o înregistrare din istoric
  async remove(id: number): Promise<{ message: string }> {
    const history = await this.findOne(id);
    await this.historyRepository.delete(id);
    
    return {
      message: `Înregistrarea din istoric pentru angajatul ${history.employee.first_name} ${history.employee.last_name} a fost ștearsă cu succes`,
    };
  }

  // Statistici pentru istoric
  async getStatistics(): Promise<{
    total: number;
    byEmployee: { [key: string]: number };
    byWorkLocation: { [key: string]: number };
    recentChanges: number;
  }> {
    const total = await this.historyRepository.count();

    // Statistici per angajat
    const employeeStats = await this.historyRepository.createQueryBuilder('history')
      .select('history.employee_id', 'employee_id')
      .addSelect('COUNT(history.id)', 'count')
      .groupBy('history.employee_id')
      .getRawMany();

    const byEmployee = employeeStats.reduce((acc, curr) => {
      acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
      return acc;
    }, {});

    // Statistici per locație
    const locationStats = await this.historyRepository.createQueryBuilder('history')
      .select('history.work_location_id', 'work_location_id')
      .addSelect('COUNT(history.id)', 'count')
      .groupBy('history.work_location_id')
      .getRawMany();

    const byWorkLocation = locationStats.reduce((acc, curr) => {
      acc[`Location_${curr.work_location_id}`] = parseInt(curr.count);
      return acc;
    }, {});

    // Schimbări din ultima lună
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const recentChanges = await this.historyRepository.count({
      where: {
        created_at: {
          $gte: lastMonth,
        } as any,
      },
    });

    return {
      total,
      byEmployee,
      byWorkLocation,
      recentChanges,
    };
  }
} 