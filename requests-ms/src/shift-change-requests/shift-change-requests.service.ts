import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository, DeepPartial } from 'typeorm';
import { ShiftChangeRequest, ShiftChangeStatus } from './entities/shift-change-request.entity';
import { CreateShiftChangeRequestDto } from './dto/create-shift-change-request.dto';
import { UpdateShiftChangeStatusDto } from './dto/update-shift-change-status.dto';
import { FilterShiftChangeRequestsDto } from './dto/filter-shift-change-requests.dto';

@Injectable()
export class ShiftChangeRequestsService {
  private readonly logger = new Logger(ShiftChangeRequestsService.name);
  private notificationsClient: ClientProxy;

  constructor(
    @InjectRepository(ShiftChangeRequest)
    private readonly shiftChangeRepo: Repository<ShiftChangeRequest>,
    private readonly httpService: HttpService,
  ) {
    this.notificationsClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
        queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
        queueOptions: { durable: false },
      },
    });
  }

  private async sendShiftChangeNotification(
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
        entity_type: 'shift_change_request',
        metadata: { ...metadata, ...(work_location_id != null ? { work_location_id } : {}) },
        priority: 'medium',
        target_url,
      };
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'shift-change.notification' }, payload)
      );
    } catch (error) {
      this.logger.warn(`Failed to send shift change notification: ${error?.message || error}`);
    }
  }

  // Creare cerere de schimb de tură
  async create(dto: CreateShiftChangeRequestDto, currentUserId?: number): Promise<ShiftChangeRequest> {
    // Verifică dacă angajatul care cere schimbul există și obține location_id prin HTTP call
    let locationId: number | undefined = dto.location_id;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${process.env.API_GATEWAY_URL || 'http://giurom.bitap.ro:3002'}/employees/${dto.employee_id}`, {
          headers: {
            'x-internal-service': 'requests',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const employeeData = response.data as any;
      if (!employeeData) {
        this.logger.error(`Employee with ID ${dto.employee_id} not found`);
        throw new NotFoundException('Angajatul care cere schimbul nu a fost găsit');
      }
      
      // Dacă location_id nu este furnizat în DTO, îl obținem din employee (work_location_default_id)
      if (!locationId && employeeData.work_location_default_id) {
        locationId = employeeData.work_location_default_id;
      }
    } catch (error) {
      this.logger.error(`Employee with ID ${dto.employee_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul care cere schimbul nu a fost găsit');
    }

    // Verifică dacă angajatul înlocuitor există prin HTTP call
    try {
      await firstValueFrom(
        this.httpService.get(`${process.env.API_GATEWAY_URL || 'http://giurom.bitap.ro:3002'}/employees/${dto.replacement_id}`, {
          headers: {
            'x-internal-service': 'requests',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
    } catch (error) {
      this.logger.error(`Replacement employee with ID ${dto.replacement_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul înlocuitor nu a fost găsit');
    }

    // Autorizare: angajatul poate crea cereri doar pentru sine
    if (currentUserId && currentUserId !== dto.employee_id) {
      this.logger.warn(`User ${currentUserId} attempted to create shift change request for employee ${dto.employee_id}`);
      throw new ForbiddenException('Nu poți crea cereri de schimb de tură pentru alți angajați');
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

    // Verifică dacă angajatul nu încearcă să se înlocuiască pe sine
    if (dto.employee_id === dto.replacement_id) {
      this.logger.error(`Employee ${dto.employee_id} attempted to replace themselves`);
      throw new BadRequestException('Nu te poți înlocui pe tine însuți');
    }

    // Verifică suprapuneri cu alte cereri aprobate pentru același angajat
    const overlappingRequests = await this.shiftChangeRepo
      .createQueryBuilder('scr')
      .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId: dto.employee_id })
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .andWhere(
        '(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)',
        { startDate, endDate }
      )
      .getCount();

    if (overlappingRequests > 0) {
      this.logger.error(`Overlapping shift change requests found for employee ${dto.employee_id}`);
      throw new BadRequestException('Există deja o cerere de schimb aprobată în această perioadă');
    }

    // Verifică suprapuneri pentru angajatul înlocuitor
    const replacementOverlapping = await this.shiftChangeRepo
      .createQueryBuilder('scr')
      .where('(scr.employee_id = :replacementId OR scr.replacement_id = :replacementId)', { replacementId: dto.replacement_id })
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .andWhere(
        '(scr.start_datetime <= :endDate AND scr.end_datetime >= :startDate)',
        { startDate, endDate }
      )
      .getCount();

    if (replacementOverlapping > 0) {
      this.logger.error(`Replacement employee ${dto.replacement_id} has overlapping approved requests`);
      throw new BadRequestException('Angajatul înlocuitor are deja o cerere aprobată în această perioadă');
    }

    // Creează cererea
    const partial: DeepPartial<ShiftChangeRequest> = {
      ...dto,
      duration_unit: (dto as any).duration_unit || 'days',
      start_datetime: startDate as any,
      end_datetime: endDate as any,
      status: ShiftChangeStatus.PENDING,
      location_id: locationId,
    };

    const shiftChangeRequest: ShiftChangeRequest = this.shiftChangeRepo.create(partial);

    const savedRequest: ShiftChangeRequest = await this.shiftChangeRepo.save(shiftChangeRequest);
    
    // Send notification to admins/managers (work_location_id pentru filtrare pe locație)
    await this.sendShiftChangeNotification(
      'shift_change_request_created',
      'Cerere de schimb de tura noua',
      'A fost creata o noua cerere de schimb de tura',
      dto.employee_id,
      {
        requestId: savedRequest.id,
        employeeId: dto.employee_id,
        replacementId: dto.replacement_id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      `/pontaj/${dto.employee_id}`,
      locationId,
    );

    return this.findOne(savedRequest.id);
  }

  // Listare cereri cu filtrare
  async findAll(filters: FilterShiftChangeRequestsDto, currentUserId?: number): Promise<ShiftChangeRequest[]> {
    const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr');
      // Employee relations removed - using HTTP calls to employees microservice

    // Filtrare pe status
    if (filters.status) {
      queryBuilder.andWhere('scr.status = :status', { status: filters.status });
    }

    // Filtrare pe angajatul care cere schimbul
    if (filters.employee_id) {
      queryBuilder.andWhere('scr.employee_id = :employeeId', { employeeId: filters.employee_id });
    }

    // Filtrare pe angajatul înlocuitor
    if (filters.replacement_id) {
      queryBuilder.andWhere('scr.replacement_id = :replacementId', { replacementId: filters.replacement_id });
    }

    // Filtrare pe perioada
    if (filters.start_date && filters.end_date) {
      queryBuilder.andWhere(
        'scr.start_datetime >= :startDate AND scr.end_datetime <= :endDate',
        { startDate: new Date(filters.start_date), endDate: new Date(filters.end_date) }
      );
    } else if (filters.start_date) {
      queryBuilder.andWhere('scr.start_datetime >= :startDate', { startDate: new Date(filters.start_date) });
    } else if (filters.end_date) {
      queryBuilder.andWhere('scr.end_datetime <= :endDate', { endDate: new Date(filters.end_date) });
    }

    // Filtrare pe reviewer
    if (filters.reviewed_by_id) {
      queryBuilder.andWhere('scr.reviewed_by_id = :reviewerId', { reviewerId: filters.reviewed_by_id });
    }

    // Filtrare pe locație
    if (filters.location_id) {
      queryBuilder.andWhere('scr.location_id = :locationId', { locationId: filters.location_id });
    }

    // Autorizare: angajații pot vedea doar cererile în care sunt implicați
    if (currentUserId && !this.isManager(currentUserId)) {
      queryBuilder.andWhere(
        '(scr.employee_id = :currentUserId OR scr.replacement_id = :currentUserId)',
        { currentUserId }
      );
    }

    queryBuilder.orderBy('scr.created_at', 'DESC');

    const requests = await queryBuilder.getMany();
    
    return requests;
  }

  // Obținere cereri în așteptare
  async findPending(currentUserId?: number): Promise<ShiftChangeRequest[]> {
    return this.findAll({ status: ShiftChangeStatus.PENDING }, currentUserId);
  }

  // Obținere cerere specifică
  async findOne(id: number, currentUserId?: number): Promise<ShiftChangeRequest> {
    const shiftChangeRequest = await this.shiftChangeRepo.findOne({
      where: { id },
      // Employee relations removed - using HTTP calls to employees microservice
    });

    if (!shiftChangeRequest) {
      this.logger.error(`Shift change request with ID ${id} not found`);
      throw new NotFoundException('Cererea de schimb de tură nu a fost găsită');
    }

    // Autorizare: angajatul poate vedea doar cererile în care este implicat
    if (currentUserId && !this.isManager(currentUserId)) {
      const isInvolved = shiftChangeRequest.employee_id === currentUserId || 
                        shiftChangeRequest.replacement_id === currentUserId;
      
      if (!isInvolved) {
        this.logger.warn(`User ${currentUserId} attempted to access shift change request ${id} without permission`);
        throw new ForbiddenException('Nu ai permisiunea să vezi această cerere de schimb de tură');
      }
    }

    return shiftChangeRequest;
  }

  // Actualizare status cerere (aprobare/respingere)
  async updateStatus(id: number, dto: UpdateShiftChangeStatusDto, currentUserId?: number): Promise<ShiftChangeRequest> {
    const shiftChangeRequest = await this.findOne(id);

    // Verifică dacă reviewerul există prin HTTP call
    try {
      await firstValueFrom(
        this.httpService.get(`${process.env.API_GATEWAY_URL || 'http://giurom.bitap.ro:3002'}/employees/${dto.reviewed_by_id}`, {
          headers: {
            'x-internal-service': 'requests',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
    } catch (error) {
      this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found: ${error.message}`);
      throw new NotFoundException('Managerul care aprobă nu a fost găsit');
    }

    // Autorizare: doar managerii pot aproba/respinge cereri
    if (currentUserId && !this.isManager(currentUserId)) {
      this.logger.warn(`Non-manager user ${currentUserId} attempted to update shift change request status`);
      throw new ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de schimb de tură');
    }

    // Verifică dacă cererea poate fi modificată
    if (shiftChangeRequest.status !== ShiftChangeStatus.PENDING) {
      this.logger.error(`Attempted to modify shift change request ${id} with status ${shiftChangeRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi modificate');
    }

    // Verifică dacă nu încearcă să-și aprobe propria cerere
    if (shiftChangeRequest.employee_id === dto.reviewed_by_id || shiftChangeRequest.replacement_id === dto.reviewed_by_id) {
      this.logger.error(`Employee ${dto.reviewed_by_id} attempted to review their own shift change request ${id}`);
      throw new BadRequestException('Nu poți aproba/respinge o cerere în care ești implicat');
    }

    // Actualizează cererea
    const oldStatus = shiftChangeRequest.status;
    shiftChangeRequest.status = dto.status;
    shiftChangeRequest.reviewed_by_id = dto.reviewed_by_id;
    shiftChangeRequest.reviewed_at = new Date();

    // Adaugă comentariul de review dacă există
    if (dto.review_comment) {
      shiftChangeRequest.comment = shiftChangeRequest.comment 
        ? `${shiftChangeRequest.comment}\n\nDecizie manager: ${dto.review_comment}`
        : `Decizie manager: ${dto.review_comment}`;
    }

    const updatedRequest = await this.shiftChangeRepo.save(shiftChangeRequest);

    // Send notifications to both employees about the decision
    try {
      if (dto.status === ShiftChangeStatus.APPROVED) {
        // Notify employee who requested the change
        const locId = shiftChangeRequest.location_id ?? undefined;
        await this.sendShiftChangeNotification(
          'shift_change_request_approved',
          'Cerere de schimb de tura aprobata',
          'Cererea dumneavoastra de schimb de tura a fost aprobata',
          shiftChangeRequest.employee_id,
          {
            requestId: updatedRequest.id,
            replacementId: shiftChangeRequest.replacement_id,
            startDate: shiftChangeRequest.start_datetime.toISOString(),
            endDate: shiftChangeRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
          },
          `/pontaj/${shiftChangeRequest.employee_id}`,
          locId,
        );

        await this.sendShiftChangeNotification(
          'shift_change_request_approved',
          'Cerere de schimb de tura aprobata',
          'Cererea de schimb de tura a fost aprobata',
          shiftChangeRequest.replacement_id,
          {
            requestId: updatedRequest.id,
            employeeId: shiftChangeRequest.employee_id,
            startDate: shiftChangeRequest.start_datetime.toISOString(),
            endDate: shiftChangeRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
          },
          `/pontaj/${shiftChangeRequest.replacement_id}`,
          locId,
        );
      } else if (dto.status === ShiftChangeStatus.REJECTED) {
        const locId = shiftChangeRequest.location_id ?? undefined;
        await this.sendShiftChangeNotification(
          'shift_change_request_rejected',
          'Cerere de schimb de tura respinsa',
          'Cererea dumneavoastra de schimb de tura a fost respinsa',
          shiftChangeRequest.employee_id,
          {
            requestId: updatedRequest.id,
            replacementId: shiftChangeRequest.replacement_id,
            startDate: shiftChangeRequest.start_datetime.toISOString(),
            endDate: shiftChangeRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
            comment: dto.review_comment,
          },
          `/pontaj/${shiftChangeRequest.employee_id}`,
          locId,
        );

        await this.sendShiftChangeNotification(
          'shift_change_request_rejected',
          'Cerere de schimb de tura respinsa',
          'Cererea de schimb de tura a fost respinsa',
          shiftChangeRequest.replacement_id,
          {
            requestId: updatedRequest.id,
            employeeId: shiftChangeRequest.employee_id,
            startDate: shiftChangeRequest.start_datetime.toISOString(),
            endDate: shiftChangeRequest.end_datetime.toISOString(),
            reviewerId: dto.reviewed_by_id,
            comment: dto.review_comment,
          },
          `/pontaj/${shiftChangeRequest.replacement_id}`,
          locId,
        );
      }
    } catch (error) {
      this.logger.warn(`Failed to send notification: ${error.message}`);
    }

    return this.findOne(updatedRequest.id);
  }

  // Ștergere cerere (doar dacă este pending și de către creator)
  async remove(id: number, currentUserId?: number): Promise<void> {
    const shiftChangeRequest = await this.findOne(id, currentUserId);

    // Verifică dacă cererea poate fi ștearsă
    if (shiftChangeRequest.status !== ShiftChangeStatus.PENDING) {
      this.logger.error(`Attempted to delete shift change request ${id} with status ${shiftChangeRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi șterse');
    }

    // Autorizare: doar creatorul poate șterge cererea
    if (currentUserId && shiftChangeRequest.employee_id !== currentUserId) {
      this.logger.warn(`User ${currentUserId} attempted to delete shift change request ${id} of employee ${shiftChangeRequest.employee_id}`);
      throw new ForbiddenException('Nu poți șterge cereri de schimb de tură ale altor angajați');
    }

    await this.shiftChangeRepo.remove(shiftChangeRequest);
  }

  // Obținere statistici pentru un angajat
  async getEmployeeStats(employeeId: number, year?: number): Promise<any> {
    const currentYear = year || new Date().getFullYear();
    
    const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr')
      .where('(scr.employee_id = :employeeId OR scr.replacement_id = :employeeId)', { employeeId })
      .andWhere('YEAR(scr.start_datetime) = :year', { year: currentYear });

    const totalRequests = await queryBuilder.getCount();
    
    const asRequester = await queryBuilder
      .clone()
      .andWhere('scr.employee_id = :employeeId', { employeeId })
      .getCount();

    const asReplacement = await queryBuilder
      .clone()
      .andWhere('scr.replacement_id = :employeeId', { employeeId })
      .getCount();

    const approvedRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.APPROVED })
      .getCount();

    const pendingRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.PENDING })
      .getCount();

    const rejectedRequests = await queryBuilder
      .clone()
      .andWhere('scr.status = :status', { status: ShiftChangeStatus.REJECTED })
      .getCount();

    return {
      year: currentYear,
      total_requests: totalRequests,
      as_requester: asRequester,
      as_replacement: asReplacement,
      approved_requests: approvedRequests,
      pending_requests: pendingRequests,
      rejected_requests: rejectedRequests,
    };
  }

  // Helper pentru verificarea dacă utilizatorul este manager
  private async isManager(userId: number): Promise<boolean> {
    // Implementare simplificată - în realitate ar verifica rolul din baza de date
    // Pentru moment, considerăm că toți utilizatorii cu ID > 100 sunt manageri
    return userId > 100;
  }

  // Obținere cereri pentru aprobare (pentru manageri)
  async findRequestsForApproval(managerId: number): Promise<ShiftChangeRequest[]> {
    // În implementarea reală, ar trebui să existe o relație între manager și angajați
    // Pentru moment, returnăm toate cererile pending
    return this.findAll({ status: ShiftChangeStatus.PENDING }, managerId);
  }

  // Obținere cereri pentru un anumit angajat (ca requester sau replacement)
  async findByEmployee(employeeId: number, currentUserId?: number): Promise<ShiftChangeRequest[]> {
    // Autorizare: angajatul poate vedea doar propriile cereri
    if (currentUserId && !this.isManager(currentUserId) && currentUserId !== employeeId) {
      throw new ForbiddenException('Nu poți vedea cererile altor angajați');
    }

    return this.shiftChangeRepo.find({
      where: [
        { employee_id: employeeId },
        { replacement_id: employeeId }
      ],
      // Employee relations removed - using HTTP calls to employees microservice
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Marchează automat cererile de schimb de tură expirate (end_datetime depășit) ca rejected
   * Trebuie apelată periodic sau la cerere
   */
  async rejectExpiredShiftChangeRequests(): Promise<number> {
    const now = new Date();

    const expiredRequests = await this.shiftChangeRepo
      .createQueryBuilder('scr')
      .where('scr.status = :status', { status: ShiftChangeStatus.PENDING })
      .andWhere('scr.end_datetime < :now', { now })
      .getMany();

    if (expiredRequests.length === 0) {
      return 0;
    }

    // Actualizează statusul la REJECTED pentru toate cererile expirate
    const updateResult = await this.shiftChangeRepo
      .createQueryBuilder()
      .update(ShiftChangeRequest)
      .set({ status: ShiftChangeStatus.REJECTED })
      .where('status = :status', { status: ShiftChangeStatus.PENDING })
      .andWhere('end_datetime < :now', { now })
      .execute();

    return updateResult.affected || 0;
  }
}