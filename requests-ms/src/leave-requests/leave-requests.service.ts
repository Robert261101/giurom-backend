import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { LeaveRequest, LeaveStatus, DurationUnit } from './entities/leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';
import {
  assertJwtEmployeeIdConsistency,
  getCanonicalEmployeeId,
  isFurnizorSupplierAdmin,
  isLeaveAdminUser,
  isOperationalStaffUser,
  type LeaveAccessUser,
} from './leave-request-access';
import {
  fetchOperationalColleagueIds as resolveOperationalColleagueIds,
} from '../operational-colleague-scope';
import {
  attachEmployeeDisplayNames,
  fetchEmployeeDisplayNames,
} from '../employee-display-names';

@Injectable()
export class LeaveRequestsService implements OnModuleInit {
  private readonly logger = new Logger(LeaveRequestsService.name);

  private employeesBaseUrl(): string {
    return process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
  }

  private internalServiceHeaders(): Record<string, string> {
    return {
      'x-internal-service': 'requests',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };
  }

  private async fetchEmployeeById(employeeId: number): Promise<any> {
    const response = await firstValueFrom(
      this.httpService.get(
        `${this.employeesBaseUrl()}/employees/${employeeId}`,
        { headers: this.internalServiceHeaders() },
      ),
    );
    const employeeData = response.data as any;
    if (!employeeData) {
      throw new NotFoundException('Angajatul nu a fost găsit');
    }
    return employeeData;
  }
  private notificationsClient: ClientProxy;

  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    private readonly httpService: HttpService,
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

  private async sendLeaveNotification(
    type: string,
    title: string,
    description: string,
    userId: number,
    metadata?: any,
    target_url?: string,
    work_location_id?: number,
  ): Promise<void> {
    try {
      const payload: any = {
        type,
        title,
        description,
        user_id: userId,
        entity_type: 'leave_request',
        metadata: { ...metadata, ...(work_location_id != null ? { work_location_id: work_location_id } : {}) },
        priority: 'medium',
        target_url,
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'leave.notification' }, payload)
      );
    } catch (error) {
      this.logger.error(`Failed to send leave notification: ${error?.message || error}`);
      this.logger.error(`Error stack: ${error?.stack}`);
    }
  }

  // Creare cerere de concediu
  async create(
    dto: CreateLeaveRequestDto,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<LeaveRequest> {
    // Verifică dacă angajatul există și obține location_id prin HTTP call către microserviciul employees
    let locationId: number | undefined = dto.location_id;
    try {
      const employeeData = await this.fetchEmployeeById(dto.employee_id);
      
      // Dacă location_id nu este furnizat în DTO, îl obținem din employee (work_location_default_id)
      if (!locationId && employeeData.work_location_default_id) {
        locationId = employeeData.work_location_default_id;
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Employee with ID ${dto.employee_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul nu a fost găsit');
    }

    // Autorizare: self, admin sau furnizor (staff propriu)
    if (user) {
      assertJwtEmployeeIdConsistency(user);
      if (isLeaveAdminUser(user)) {
        // admin/manager — orice angajat
      } else if (isFurnizorSupplierAdmin(user)) {
        const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
        if (!staffIds.includes(dto.employee_id)) {
          throw new ForbiddenException(
            'Angajatul nu aparține furnizorului autentificat',
          );
        }
      } else if (isOperationalStaffUser(user)) {
        const selfId = getCanonicalEmployeeId(user);
        if (selfId == null || dto.employee_id !== selfId) {
          throw new ForbiddenException(
            'Nu poți crea cereri de concediu pentru alți angajați',
          );
        }
      } else {
        const selfId = getCanonicalEmployeeId(user);
        if (selfId != null && dto.employee_id !== selfId) {
          this.logger.warn(
            `User ${selfId} attempted to create leave request for employee ${dto.employee_id}`,
          );
          throw new ForbiddenException(
            'Nu poți crea cereri de concediu pentru alți angajați',
          );
        }
      }
    }

    // Validări pentru date
    const startDate = new Date(dto.start_datetime);
    const endDate = new Date(dto.end_datetime);
    const now = new Date();

    if (endDate <= startDate) {
      this.logger.error(`Invalid date range: start ${startDate}, end ${endDate}`);
      throw new BadRequestException('Data de sfârșit trebuie să fie după data de început');
    }

    // Validare comentată pentru a permite crearea de cereri de concediu în trecut
    // if (startDate < now) {
    //   this.logger.error(`Start date ${startDate} is in the past`);
    //   throw new BadRequestException('Data de început nu poate fi în trecut');
    // }

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
      location_id: locationId,
    });

    const savedRequest = await this.leaveRequestRepo.save(leaveRequest);
    
    // Calculate duration in days
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    // Send notification to admins/managers about new leave request (work_location_id pentru filtrare pe locație)
    await this.sendLeaveNotification(
      'leave_request_created',
      'Cerere de concediu noua',
      `A fost creata o noua cerere de ${dto.leave_type}`,
      dto.employee_id,
      {
        requestId: savedRequest.id,
        employeeId: dto.employee_id,
        leaveType: dto.leave_type,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        duration: durationDays,
      },
      `/pontaj/${dto.employee_id}`,
      locationId,
    );

    return this.findOne(savedRequest.id);
  }

  // Listare cereri cu filtrare
  async findAll(
    filters: FilterLeaveRequestsDto,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<LeaveRequest[]> {
    const queryBuilder = this.leaveRequestRepo.createQueryBuilder('lr');
      // Employee relations removed - using HTTP calls to employees microservice

    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    assertJwtEmployeeIdConsistency(user);

    // Filtrare pe status
    if (filters.status) {
      queryBuilder.andWhere('lr.status = :status', { status: filters.status });
    }

    // Filtrare pe angajat (înainte de scope — poate fi suprascrisă pentru operațional)
    const requestedEmployeeId = filters.employee_id;
    if (requestedEmployeeId) {
      queryBuilder.andWhere('lr.employee_id = :employeeId', {
        employeeId: requestedEmployeeId,
      });
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

    // Filtrare pe locație
    if (filters.location_id) {
      queryBuilder.andWhere('lr.location_id = :locationId', { locationId: filters.location_id });
    }

    // Autorizare pe scope
    if (isOperationalStaffUser(user)) {
      const selfId = getCanonicalEmployeeId(user);
      if (selfId == null) {
        throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
      }
      // Scope citire: self + colegi din aceeași locație
      const colleagueIds = await resolveOperationalColleagueIds(
        this.httpService,
        user as any,
      );
      if (requestedEmployeeId != null) {
        if (!colleagueIds.includes(requestedEmployeeId)) {
          throw new ForbiddenException('Nu aveți acces la cererile acestui angajat');
        }
        queryBuilder.andWhere('lr.employee_id = :scopeEmployeeId', { scopeEmployeeId: requestedEmployeeId });
      } else if (colleagueIds.length > 0) {
        queryBuilder.andWhere('lr.employee_id IN (:...colleagueIds)', { colleagueIds });
      } else {
        queryBuilder.andWhere('lr.employee_id = :scopeEmployeeId', { scopeEmployeeId: selfId });
      }
    } else if (isLeaveAdminUser(user)) {
      // Admin/manager — filtrele din query rămân active
    } else if (isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (requestedEmployeeId) {
        if (!staffIds.includes(requestedEmployeeId)) {
          throw new ForbiddenException(
            'Angajatul nu aparține furnizorului autentificat',
          );
        }
      } else if (staffIds.length > 0) {
        queryBuilder.andWhere('lr.employee_id IN (:...staffIds)', { staffIds });
      } else {
        queryBuilder.andWhere('1 = 0');
      }
    } else {
      const selfId = getCanonicalEmployeeId(user);
      if (selfId == null) {
        throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
      }
      if (requestedEmployeeId && requestedEmployeeId !== selfId) {
        throw new ForbiddenException('Nu aveți acces la cererile altui angajat');
      }
      queryBuilder.andWhere('lr.employee_id = :scopeEmployeeId', {
        scopeEmployeeId: selfId,
      });
    }

    const requests = await queryBuilder.getMany();
    const nameById = await fetchEmployeeDisplayNames(
      this.httpService,
      requests.map((r) => r.employee_id),
    );
    return attachEmployeeDisplayNames(requests, nameById);
  }

  private suppliersBaseUrl(): string {
    return (
      process.env.SUPPLIERS_HTTP_URL ||
      process.env.SUPPLIERS_SERVICE_URL ||
      'http://localhost:3007'
    );
  }

  private async fetchSupplierStaffEmployeeIds(
    authorization?: string,
  ): Promise<number[]> {
    const base = this.suppliersBaseUrl();
    const headers: Record<string, string> = {};
    if (authorization) {
      headers.Authorization = authorization;
    }
    try {
      const myResp = await firstValueFrom(
        this.httpService.get(`${base}/suppliers/my-supplier`, {
          headers,
          timeout: 8000,
        }),
      );
      const supplierId = Number(myResp.data?.id);
      if (!Number.isFinite(supplierId) || supplierId <= 0) {
        return [];
      }
      const [driversResp, warehouseResp] = await Promise.all([
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/drivers`, {
            headers,
            timeout: 8000,
          }),
        ),
        firstValueFrom(
          this.httpService.get(`${base}/suppliers/${supplierId}/warehouse`, {
            headers,
            timeout: 8000,
          }),
        ),
      ]);
      const ids = new Set<number>();
      for (const row of [
        ...(driversResp.data ?? []),
        ...(warehouseResp.data ?? []),
      ]) {
        const id = Number(row?.employee_id);
        if (Number.isFinite(id) && id > 0) {
          ids.add(id);
        }
      }
      return [...ids];
    } catch (error: any) {
      this.logger.warn(
        `fetchSupplierStaffEmployeeIds failed: ${error?.message || error}`,
      );
      return [];
    }
  }

  private isLeaveManager(user?: LeaveAccessUser): boolean {
    return isLeaveAdminUser(user);
  }

  // Obținere cereri în așteptare
  async findPending(
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<LeaveRequest[]> {
    return this.findAll({ status: LeaveStatus.PENDING }, user, authorization);
  }

  // Obținere cerere specifică
  async findOne(id: number, currentUserId?: number): Promise<LeaveRequest> {
    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id },
      // Employee relations removed - using HTTP calls to employees microservice
    });

    if (!leaveRequest) {
      this.logger.error(`Leave request with ID ${id} not found`);
      throw new NotFoundException('Cererea de concediu nu a fost găsită');
    }

    // Autorizare: angajatul poate vedea doar propriile cereri (dacă user e furnizat)
    if (currentUserId != null && leaveRequest.employee_id !== currentUserId) {
      this.logger.warn(`User ${currentUserId} attempted to access leave request ${id} of employee ${leaveRequest.employee_id}`);
      throw new ForbiddenException('Nu ai permisiunea să vezi această cerere de concediu');
    }

    return leaveRequest;
  }

  // Actualizare status cerere (aprobare/respingere)
  async updateStatus(
    id: number,
    dto: UpdateLeaveRequestStatusDto,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<LeaveRequest> {
    const leaveRequest = await this.findOne(id);

    // Verifică dacă reviewerul există prin HTTP call către microserviciul employees
    try {
      await this.fetchEmployeeById(dto.reviewed_by_id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found: ${error.message}`);
      throw new NotFoundException('Managerul care aprobă nu a fost găsit');
    }

    // Autorizare: admin sau furnizor (staff propriu) pot aproba/respinge
    if (user && !isLeaveAdminUser(user) && !isFurnizorSupplierAdmin(user)) {
      this.logger.warn(`Non-manager user ${user.sub} attempted to update leave request status`);
      throw new ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de concediu');
    }

    if (user && !isLeaveAdminUser(user) && isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (!staffIds.includes(leaveRequest.employee_id)) {
        throw new ForbiddenException(
          'Angajatul nu aparține furnizorului autentificat',
        );
      }
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

    // Send notification to employee about the decision
    try {
      if (dto.status === LeaveStatus.APPROVED) {
        await this.sendLeaveNotification(
          'leave_request_approved',
          'Cerere de concediu aprobata',
          `Cererea dumneavoastra de ${leaveRequest.leave_type} a fost aprobata`,
          leaveRequest.employee_id,
          {
            requestId: updatedRequest.id,
            leaveType: leaveRequest.leave_type,
            startDate: leaveRequest.start_datetime.toISOString(),
            endDate: leaveRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
          },
          `/pontaj/${leaveRequest.employee_id}`,
          leaveRequest.location_id ?? undefined,
        );
      } else if (dto.status === LeaveStatus.REJECTED) {
        await this.sendLeaveNotification(
          'leave_request_rejected',
          'Cerere de concediu respinsa',
          `Cererea dumneavoastra de ${leaveRequest.leave_type} a fost respinsa`,
          leaveRequest.employee_id,
          {
            requestId: updatedRequest.id,
            leaveType: leaveRequest.leave_type,
            startDate: leaveRequest.start_datetime.toISOString(),
            endDate: leaveRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
            comment: dto.review_comment,
          },
          `/pontaj/${leaveRequest.employee_id}`,
          leaveRequest.location_id ?? undefined,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to send notification: ${error.message}`);
    }

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

    return {
      year: currentYear,
      total_requests: totalRequests,
      approved_requests: approvedRequests.length,
      pending_requests: pendingRequests,
      rejected_requests: rejectedRequests,
      total_days_approved: Math.round(totalDaysApproved * 100) / 100,
    };
  }

  // Helper pentru verificarea dacă utilizatorul este manager (admin concedii)
  private isManager(user?: LeaveAccessUser): boolean {
    return this.isLeaveManager(user);
  }

  // Obținere cereri pentru aprobare (pentru manageri)

  /**
   * Marchează automat cererile de concediu expirate (end_datetime depășit) ca rejected
   * Trebuie apelată periodic sau la cerere
   */
  async rejectExpiredLeaveRequests(): Promise<number> {
    const now = new Date();

    const expiredRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .where('lr.status = :status', { status: LeaveStatus.PENDING })
      .andWhere('lr.end_datetime < :now', { now })
      .getMany();

    if (expiredRequests.length === 0) {
      return 0;
    }

    // Actualizează statusul la REJECTED pentru toate cererile expirate
    const updateResult = await this.leaveRequestRepo
      .createQueryBuilder()
      .update(LeaveRequest)
      .set({ status: LeaveStatus.REJECTED })
      .where('status = :status', { status: LeaveStatus.PENDING })
      .andWhere('end_datetime < :now', { now })
      .execute();

    return updateResult.affected || 0;
  }
}
