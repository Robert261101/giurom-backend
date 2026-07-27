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
import {
  fetchColleagueIdsByLocation,
  fetchOperationalColleagueIds,
} from '../operational-colleague-scope';
import {
  assertJwtEmployeeIdConsistency,
  getCanonicalEmployeeId,
  isFurnizorSupplierAdmin,
  isLeaveAdminUser,
  isOperationalStaffUser,
  type LeaveAccessUser,
} from '../leave-requests/leave-request-access';
import {
  attachShiftChangeDisplayNames,
  fetchEmployeeDisplayNames,
} from '../employee-display-names';

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
    const employeesBase =
      process.env.EMPLOYEES_HTTP_URL || 'http://localhost:3011';
    const internalHeaders = {
      'x-internal-service': 'requests',
      'x-service-secret': process.env.SERVICE_SECRET || '',
    };

    // Verifică dacă angajatul care cere schimbul există și obține location_id prin HTTP call
    let locationId: number | undefined = dto.location_id;
    let employeeData: any;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${employeesBase}/employees/${dto.employee_id}`, {
          headers: internalHeaders,
        }),
      );
      employeeData = response.data as any;
      if (!employeeData) {
        this.logger.error(`Employee with ID ${dto.employee_id} not found`);
        throw new NotFoundException('Angajatul care cere schimbul nu a fost găsit');
      }
      
      // Dacă location_id nu este furnizat în DTO, îl obținem din employee (work_location_default_id)
      if (!locationId && employeeData.work_location_default_id) {
        locationId = employeeData.work_location_default_id;
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Employee with ID ${dto.employee_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul care cere schimbul nu a fost găsit');
    }

    if (!locationId || !Number.isFinite(Number(locationId)) || Number(locationId) <= 0) {
      throw new BadRequestException(
        'Locația de lucru a angajatului nu a putut fi determinată',
      );
    }

    if (
      dto.location_id != null &&
      Number.isFinite(Number(dto.location_id)) &&
      Number(dto.location_id) > 0 &&
      Number(dto.location_id) !== Number(locationId)
    ) {
      throw new ForbiddenException(
        'location_id nu corespunde locației angajatului autentificat',
      );
    }

    // Autorizare: angajatul poate crea cereri doar pentru sine
    if (currentUserId && currentUserId !== dto.employee_id) {
      this.logger.warn(`User ${currentUserId} attempted to create shift change request for employee ${dto.employee_id}`);
      throw new ForbiddenException('Nu poți crea cereri de schimb de tură pentru alți angajați');
    }

    // Verifică dacă angajatul înlocuitor există și aparține aceleiași locații
    let replacementData: any;
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${employeesBase}/employees/${dto.replacement_id}`, {
          headers: internalHeaders,
        }),
      );
      replacementData = response.data;
      if (!replacementData) {
        throw new NotFoundException('Angajatul înlocuitor nu a fost găsit');
      }
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Replacement employee with ID ${dto.replacement_id} not found: ${error.message}`);
      throw new NotFoundException('Angajatul înlocuitor nu a fost găsit');
    }

    const colleagueIds = await fetchColleagueIdsByLocation(
      this.httpService,
      Number(locationId),
    );
    if (!colleagueIds.includes(dto.replacement_id)) {
      this.logger.warn(
        `Replacement ${dto.replacement_id} not in colleague scope for location ${locationId}`,
      );
      throw new ForbiddenException(
        'Angajatul înlocuitor nu face parte din aceeași locație de lucru',
      );
    }

    if (!employeeData.is_active) {
      throw new BadRequestException('Angajatul care cere schimbul nu este activ');
    }
    if (!replacementData.is_active) {
      throw new BadRequestException('Angajatul înlocuitor nu este activ');
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
      for (const row of [...(driversResp.data || []), ...(warehouseResp.data || [])]) {
        const eid = Number(row?.employee_id);
        if (Number.isFinite(eid) && eid > 0) {
          ids.add(eid);
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

  private async assertShiftChangeReadAccess(
    request: ShiftChangeRequest,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<void> {
    if (!user) {
      return;
    }
    assertJwtEmployeeIdConsistency(user);

    if (isLeaveAdminUser(user)) {
      return;
    }

    if (isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (
        !staffIds.includes(request.employee_id) ||
        !staffIds.includes(request.replacement_id)
      ) {
        throw new ForbiddenException(
          'Cererea nu aparține staff-ului furnizorului autentificat',
        );
      }
      return;
    }

    if (isOperationalStaffUser(user)) {
      const colleagueIds = await fetchOperationalColleagueIds(
        this.httpService,
        user as LeaveAccessUser & {
          work_location_id?: number;
          work_location_default_id?: number;
        },
      );
      const involved =
        colleagueIds.includes(request.employee_id) ||
        colleagueIds.includes(request.replacement_id);
      if (!involved) {
        throw new ForbiddenException('Nu aveți acces la această cerere');
      }
      return;
    }

    const selfId = getCanonicalEmployeeId(user);
    if (selfId == null) {
      throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
    }
    const isInvolved =
      request.employee_id === selfId || request.replacement_id === selfId;
    if (!isInvolved) {
      throw new ForbiddenException(
        'Nu ai permisiunea să vezi această cerere de schimb de tură',
      );
    }
  }

  // Listare cereri cu filtrare
  async findAll(
    filters: FilterShiftChangeRequestsDto,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest[]> {
    const queryBuilder = this.shiftChangeRepo.createQueryBuilder('scr');

    if (!user) {
      throw new ForbiddenException('Utilizator neautentificat');
    }
    assertJwtEmployeeIdConsistency(user);

    // Filtrare pe status
    if (filters.status) {
      queryBuilder.andWhere('scr.status = :status', { status: filters.status });
    }

    const requestedEmployeeId = filters.employee_id;
    if (requestedEmployeeId) {
      queryBuilder.andWhere('scr.employee_id = :employeeId', {
        employeeId: requestedEmployeeId,
      });
    }

    // Filtrare pe angajatul înlocuitor
    if (filters.replacement_id) {
      queryBuilder.andWhere('scr.replacement_id = :replacementId', {
        replacementId: filters.replacement_id,
      });
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

    // Autorizare pe scope
    if (isOperationalStaffUser(user)) {
      const selfId = getCanonicalEmployeeId(user);
      if (selfId == null) {
        throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
      }
      const colleagueIds = await fetchOperationalColleagueIds(
        this.httpService,
        user as LeaveAccessUser & {
          work_location_id?: number;
          work_location_default_id?: number;
        },
      );
      if (requestedEmployeeId != null) {
        if (!colleagueIds.includes(requestedEmployeeId)) {
          throw new ForbiddenException('Nu aveți acces la cererile acestui angajat');
        }
      } else if (colleagueIds.length > 0) {
        queryBuilder.andWhere(
          '(scr.employee_id IN (:...colleagueIds) OR scr.replacement_id IN (:...colleagueIds))',
          { colleagueIds },
        );
      } else {
        queryBuilder.andWhere(
          '(scr.employee_id = :selfId OR scr.replacement_id = :selfId)',
          { selfId },
        );
      }
    } else if (isLeaveAdminUser(user)) {
      // Admin — filtrele din query rămân active
    } else if (isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (requestedEmployeeId) {
        if (!staffIds.includes(requestedEmployeeId)) {
          throw new ForbiddenException(
            'Angajatul nu aparține furnizorului autentificat',
          );
        }
      } else if (staffIds.length > 0) {
        queryBuilder.andWhere('scr.employee_id IN (:...staffIds)', { staffIds });
        queryBuilder.andWhere('scr.replacement_id IN (:...staffIds)', { staffIds });
      } else {
        queryBuilder.andWhere('1 = 0');
      }
    } else {
      const selfId = getCanonicalEmployeeId(user);
      if (selfId == null) {
        throw new ForbiddenException('Angajatul autentificat nu a fost identificat');
      }
      queryBuilder.andWhere(
        '(scr.employee_id = :selfId OR scr.replacement_id = :selfId)',
        { selfId },
      );
    }

    queryBuilder.orderBy('scr.created_at', 'DESC');

    const requests = await queryBuilder.getMany();
    const nameById = await fetchEmployeeDisplayNames(
      this.httpService,
      requests.flatMap((r) => [r.employee_id, r.replacement_id]),
    );
    return attachShiftChangeDisplayNames(requests, nameById);
  }

  // Obținere cereri în așteptare
  async findPending(
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest[]> {
    return this.findAll({ status: ShiftChangeStatus.PENDING }, user, authorization);
  }

  // Obținere cerere specifică
  async findOne(
    id: number,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest> {
    const shiftChangeRequest = await this.shiftChangeRepo.findOne({
      where: { id },
    });

    if (!shiftChangeRequest) {
      this.logger.error(`Shift change request with ID ${id} not found`);
      throw new NotFoundException('Cererea de schimb de tură nu a fost găsită');
    }

    if (user) {
      await this.assertShiftChangeReadAccess(
        shiftChangeRequest,
        user,
        authorization,
      );
    }

    return shiftChangeRequest;
  }

  // Actualizare status cerere (aprobare/respingere)
  async updateStatus(
    id: number,
    dto: UpdateShiftChangeStatusDto,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest> {
    const shiftChangeRequest = await this.findOne(id, user, authorization);

    // Verifică dacă reviewerul există prin HTTP call
    try {
      await firstValueFrom(
        this.httpService.get(`${process.env.API_GATEWAY_URL || 'http://localhost:3002'}/employees/${dto.reviewed_by_id}`, {
          headers: {
            'x-internal-service': 'requests',
            'x-service-secret': process.env.SERVICE_SECRET || ''
          }
        })
      );
    } catch (error) {
      this.logger.error(`Reviewer with ID ${dto.reviewed_by_id} not found: ${error.message}`);
      throw new NotFoundException('Managerul care aprobă nu a fost găsit');
    }

    // Autorizare: admin sau furnizor (staff propriu) pot aproba/respinge
    if (user && !isLeaveAdminUser(user) && !isFurnizorSupplierAdmin(user)) {
      this.logger.warn(`Non-manager user ${user.sub} attempted to update shift change request status`);
      throw new ForbiddenException('Nu ai permisiunea să aprobi/respingi cereri de schimb de tură');
    }

    if (user && !isLeaveAdminUser(user) && isFurnizorSupplierAdmin(user)) {
      const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
      if (
        !staffIds.includes(shiftChangeRequest.employee_id) ||
        !staffIds.includes(shiftChangeRequest.replacement_id)
      ) {
        throw new ForbiddenException(
          'Ambii angajați trebuie să aparțină staff-ului furnizorului autentificat',
        );
      }
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

    return this.findOne(updatedRequest.id, user, authorization);
  }

  // Ștergere cerere (doar dacă este pending și de către creator)
  async remove(
    id: number,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<void> {
    const shiftChangeRequest = await this.findOne(id, user, authorization);

    // Verifică dacă cererea poate fi ștearsă
    if (shiftChangeRequest.status !== ShiftChangeStatus.PENDING) {
      this.logger.error(`Attempted to delete shift change request ${id} with status ${shiftChangeRequest.status}`);
      throw new BadRequestException('Doar cererile în așteptare pot fi șterse');
    }

    // Autorizare: doar creatorul poate șterge cererea
    const selfId = user ? getCanonicalEmployeeId(user) : null;
    if (selfId != null && shiftChangeRequest.employee_id !== selfId) {
      this.logger.warn(`User ${selfId} attempted to delete shift change request ${id} of employee ${shiftChangeRequest.employee_id}`);
      throw new ForbiddenException('Nu poți șterge cereri de schimb de tură ale altor angajați');
    }

    await this.shiftChangeRepo.remove(shiftChangeRequest);
  }

  // Obținere statistici pentru un angajat
  // Notă securitate: doar admin de concedii/schimburi, sau angajatul pentru statisticile proprii.
  async getEmployeeStats(employeeId: number, year?: number, user?: LeaveAccessUser): Promise<any> {
    if (user && !isLeaveAdminUser(user)) {
      const currentUserId = getCanonicalEmployeeId(user);
      if (currentUserId == null || currentUserId !== employeeId) {
        throw new ForbiddenException('Nu ai permisiunea să vezi statisticile altui angajat');
      }
    }
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

  // Obținere cereri pentru aprobare (pentru manageri)
  async findRequestsForApproval(
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest[]> {
    return this.findAll({ status: ShiftChangeStatus.PENDING }, user, authorization);
  }

  // Obținere cereri pentru un anumit angajat (ca requester sau replacement)
  async findByEmployee(
    employeeId: number,
    user?: LeaveAccessUser,
    authorization?: string,
  ): Promise<ShiftChangeRequest[]> {
    if (user) {
      assertJwtEmployeeIdConsistency(user);
      if (isLeaveAdminUser(user)) {
        // acces complet
      } else if (isFurnizorSupplierAdmin(user)) {
        const staffIds = await this.fetchSupplierStaffEmployeeIds(authorization);
        if (!staffIds.includes(employeeId)) {
          throw new ForbiddenException(
            'Angajatul nu aparține furnizorului autentificat',
          );
        }
      } else if (isOperationalStaffUser(user)) {
        const colleagueIds = await fetchOperationalColleagueIds(
          this.httpService,
          user as LeaveAccessUser & {
            work_location_id?: number;
            work_location_default_id?: number;
          },
        );
        if (!colleagueIds.includes(employeeId)) {
          throw new ForbiddenException('Nu aveți acces la cererile acestui angajat');
        }
      } else {
        const selfId = getCanonicalEmployeeId(user);
        if (selfId !== employeeId) {
          throw new ForbiddenException('Nu poți vedea cererile altor angajați');
        }
      }
    }

    return this.shiftChangeRepo.find({
      where: [
        { employee_id: employeeId },
        { replacement_id: employeeId },
      ],
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