import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveStatus, DurationUnit } from './entities/leave-request.entity';
import { Employee } from '../employee/entities/employee.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';

@Injectable()
export class LeaveRequestsService implements OnModuleInit {
  private readonly logger = new Logger(LeaveRequestsService.name);
  private notificationsClient: ClientProxy;

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}
  onModuleInit() {
    this.notificationsClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
        queueOptions: { durable: false },
      },
    });
  }

  // Creare cerere de concediu
  async create(dto: CreateLeaveRequestDto, currentUserId?: number): Promise<LeaveRequest> {
    this.logger.log(`Creating leave request for employee ${dto.employee_id}`);

    // Verifică dacă angajatul există
    const employee = await this.employeeRepo.findOne({ where: { id: dto.employee_id } });
    if (!employee) {
      this.logger.error(`Employee with ID ${dto.employee_id} not found`);
      throw new NotFoundException('Angajatul nu a fost găsit');
    }

    // Autorizare: angajatul poate crea cereri doar pentru sine
    if (currentUserId && currentUserId !== dto.employee_id) {
      this.logger.warn(`User ${currentUserId} attempted to create leave request for employee ${dto.employee_id}`);
      throw new ForbiddenException('Nu poți crea cereri de concediu pentru alți angajați');
    }

    // Validări pentru date
    const startDate = new Date(dto.start_datetime);
    const endDate = new Date(dto.end_datetime);
    const now = new Date();

    if (endDate <= startDate) {
      this.logger.error(`Invalid date range: start ${startDate}, end ${endDate}`);
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    if (startDate < now) {
      this.logger.error(`Start date ${startDate} is in the past`);
      throw new BadRequestException('Data de început nu poate fi în trecut');
    }

    // Verifică suprapuneri cu alte cereri aprobate
    const overlappingRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.employee_id = :employeeId', { employeeId: dto.employee_id })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere(
        '(lr.start_datetime <= :endDate AND lr.end_datetime >= :startDate)',
        { startDate, endDate }
      )
      .getCount();

    if (overlappingRequests > 0) {
      this.logger.error(`Overlapping leave requests found for employee ${dto.employee_id}`);
      throw new BadRequestException('Există deja o cerere de concediu aprobată în această perioadă');
    }

    // Creează cererea
    const leaveRequest = this.leaveRequestRepo.create({
      ...dto,
      start_datetime: startDate,
      end_datetime: endDate,
      status: LeaveStatus.PENDING,
      duration_unit: dto.duration_unit || DurationUnit.DAYS,
    });

    const savedRequest = await this.leaveRequestRepo.save(leaveRequest);

    this.logger.log(`Leave request ${savedRequest.id} created successfully for employee ${dto.employee_id}`);
    
    // Emit event to notifications via RabbitMQ (non-blocking)
    try {
      await firstValueFrom(
        this.notificationsClient.send({ cmd: 'labels.expiring-soon' }, {
          labelId: savedRequest.id,
          labelCode: 'leave-request',
          preparationId: dto.employee_id,
          expiresAt: endDate.toISOString(),
        })
      );
    } catch (e) {
      this.logger.warn(`Failed to emit notification event: ${e?.message || e}`);
    }

    return this.findOne(savedRequest.id);
  }

  // Listare cereri cu filtrare
  async findAll(filters: FilterLeaveRequestsDto, currentUserId?: number): Promise<LeaveRequest[]> {
    this.logger.log(`Fetching leave requests with filters: ${JSON.stringify(filters)}`);

    const queryBuilder = this.leaveRequestRepo.createQueryBuilder('lr')
      .leftJoinAndSelect('lr.employee', 'employee')
      .leftJoinAndSelect('lr.reviewed_by', 'reviewer');

    // Filtrare pe status
    if (filters.status) {
      queryBuilder.andWhere('lr.status = :status', { status: filters.status });
    }

    // Filtrare pe angajat
    if (filters.employee_id) {
      queryBuilder.andWhere('lr.employee_id = :employeeId', { employeeId: filters.employee_id });
    }

    // Filtrare pe tipul concediului
    if (filters.leave_type) {
      queryBuilder.andWhere('lr.leave_type LIKE :leaveType', { leaveType: `%${filters.leave_type}%` });
    }

    // Filtrare pe perioada
    if (filters.start_date && filters.end_date) {
      queryBuilder.andWhere(
        'lr.start_datetime >= :startDate AND lr.end_datetime <= :endDate',
        { startDate: new Date(filters.start_date), endDate: new Date(filters.end_date) }
      );
    } else if (filters.start_date) {
      queryBuilder.andWhere('lr.start_datetime >= :startDate', { startDate: new Date(filters.start_date) });
    } else if (filters.end_date) {
      queryBuilder.andWhere('lr.end_datetime <= :endDate', { endDate: new Date(filters.end_date) });
    }

    // Filtrare pe reviewer
    if (filters.reviewed_by_id) {
      queryBuilder.andWhere('lr.reviewed_by_id = :reviewerId', { reviewerId: filters.reviewed_by_id });
    }

    // Filtrare pe unitatea de durată
    if (filters.duration_unit) {
      queryBuilder.andWhere('lr.duration_unit = :durationUnit', { durationUnit: filters.duration_unit });
    }

    // Autorizare: angajații pot vedea doar propriile cereri (managerii pot vedea toate)
    if (currentUserId && !this.isManager(currentUserId)) {
      queryBuilder.andWhere('lr.employee_id = :currentUserId', { currentUserId });
    }

    queryBuilder.orderBy('lr.created_at', 'DESC');

    const requests = await queryBuilder.getMany();
    this.logger.log(`Found ${requests.length} leave requests`);
    
    return requests;
  }

  // Obținere cereri în așteptare
  async findPending(currentUserId?: number): Promise<LeaveRequest[]> {
    this.logger.log('Fetching pending leave requests');
    return this.findAll({ status: LeaveStatus.PENDING }, currentUserId);
  }

  // Obținere cerere specifică
  async findOne(id: number, currentUserId?: number): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['employee', 'reviewed_by'],
    });

    if (!leaveRequest) {
      this.logger.error(`Leave request with ID ${id} not found`);
      throw new NotFoundException('Cererea de concediu nu a fost găsită');
    }

    // Autorizare: angajatul poate vedea doar propriile cereri
    if (currentUserId && !this.isManager(currentUserId) && leaveRequest.employee_id !== currentUserId) {
      this.logger.warn(`User ${currentUserId} attempted to access leave request ${id} of employee ${leaveRequest.employee_id}`);
      throw new ForbiddenException('Nu ai permisiunea să vezi această cerere de concediu');
    }

    return leaveRequest;
  }

  // Actualizare status cerere (aprobare/respingere)
  async updateStatus(id: number, dto: UpdateLeaveRequestStatusDto, currentUserId?: number): Promise<LeaveRequest> {
    this.logger.log(`Updating status of leave request ${id} to ${dto.status} by user ${dto.reviewed_by_id}`);

    const leaveRequest = await this.findOne(id);

    // Verifică dacă reviewerul există
    const reviewer = await this.employeeRepo.findOne({ where: { id: dto.reviewed_by_id } });
    if (!reviewer) {
      this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found`);
      throw new NotFoundException('Managerul care aprobă nu a fost găsit');
    }

    // Autorizare: doar managerii pot aproba/respinge cereri
    if (currentUserId && !this.isManager(currentUserId)) {
      this.logger.warn(`Non-manager user ${currentUserId} attempted to update leave request status`);
      throw new ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de concediu');
    }

    // Verifică dacă cererea poate fi modificată
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      this.logger.error(`Attempted to modify leave request ${id} with status ${leaveRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi modificate');
    }

    // Verifică dacă nu încearcă să-și aprobe propria cerere
    if (leaveRequest.employee_id === dto.reviewed_by_id) {
      this.logger.error(`Employee ${dto.reviewed_by_id} attempted to review their own leave request ${id}`);
      throw new BadRequestException('Nu poți aproba/respinge propria cerere de concediu');
    }

    // Actualizează cererea
    const oldStatus = leaveRequest.status;
    leaveRequest.status = dto.status;
    leaveRequest.reviewed_by_id = dto.reviewed_by_id;
    leaveRequest.reviewed_at = new Date();

    // Adaugă comentariul de review dacă există
    if (dto.review_comment) {
      leaveRequest.comment = leaveRequest.comment 
        ? `${leaveRequest.comment}\n\nDecizie manager: ${dto.review_comment}`
        : `Decizie manager: ${dto.review_comment}`;
    }

    const updatedRequest = await this.leaveRequestRepo.save(leaveRequest);

    // Logare acțiune critică
    this.logger.log(
      `CRITICAL ACTION: Leave request ${id} status changed from ${oldStatus} to ${dto.status} ` +
      `by manager ${dto.reviewed_by_id} for employee ${leaveRequest.employee_id}`
    );

    return this.findOne(updatedRequest.id);
  }

  // Ștergere cerere (doar dacă este pending și de către creator)
  async remove(id: number, currentUserId?: number): Promise<void> {
    const leaveRequest = await this.findOne(id, currentUserId);

    // Verifică dacă cererea poate fi ștearsă
    if (leaveRequest.status !== LeaveStatus.PENDING) {
      this.logger.error(`Attempted to delete leave request ${id} with status ${leaveRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi șterse');
    }

    // Autorizare: doar creatorul poate șterge cererea
    if (currentUserId && leaveRequest.employee_id !== currentUserId) {
      this.logger.warn(`User ${currentUserId} attempted to delete leave request ${id} of employee ${leaveRequest.employee_id}`);
      throw new ForbiddenException('Nu poți șterge cereri de concediu ale altor angajați');
    }

    await this.leaveRequestRepo.remove(leaveRequest);

    this.logger.log(`Leave request ${id} deleted by employee ${leaveRequest.employee_id}`);
  }

  // Obținere statistici pentru un angajat
  async getEmployeeStats(employeeId: number, year?: number): Promise<any> {
    const currentYear = year || new Date().getFullYear();
    
    const queryBuilder = this.leaveRequestRepo.createQueryBuilder('lr')
      .where('lr.employee_id = :employeeId', { employeeId })
      .andWhere('YEAR(lr.start_datetime) = :year', { year: currentYear });

    const totalRequests = await queryBuilder.getCount();
    
    const approvedRequests = await queryBuilder
      .clone()
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .getMany();

    const totalDaysApproved = approvedRequests.reduce((total, request) => {
      if (request.duration_unit === DurationUnit.DAYS) {
        return total + request.duration_in_days;
      } else {
        return total + (request.duration_in_hours / 8); // Convertește orele în zile (8h = 1 zi)
      }
    }, 0);

    const pendingRequests = await queryBuilder
      .clone()
      .andWhere('lr.status = :status', { status: LeaveStatus.PENDING })
      .getCount();

    const rejectedRequests = await queryBuilder
      .clone()
      .andWhere('lr.status = :status', { status: LeaveStatus.REJECTED })
      .getCount();

    this.logger.log(`Generated stats for employee ${employeeId} for year ${currentYear}`);

    return {
      year: currentYear,
      total_requests: totalRequests,
      approved_requests: approvedRequests.length,
      pending_requests: pendingRequests,
      rejected_requests: rejectedRequests,
      total_days_approved: Math.round(totalDaysApproved * 100) / 100,
    };
  }

  // Helper pentru verificarea dacă utilizatorul este manager
  private async isManager(userId: number): Promise<boolean> {
    // Implementare simplificată - în realitate ar verifica rolul din baza de date
    // Pentru moment, considerăm că toți utilizatorii cu ID > 100 sunt manageri
    return userId > 100;
  }

  // Obținere cereri pentru aprobare (pentru manageri)
  async findRequestsForApproval(managerId: number): Promise<LeaveRequest[]> {
    this.logger.log(`Fetching requests for approval by manager ${managerId}`);

    // În implementarea reală, ar trebui să existe o relație între manager și angajați
    // Pentru moment, returnăm toate cererile pending
    return this.findAll({ status: LeaveStatus.PENDING }, managerId);
  }
}