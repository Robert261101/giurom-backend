import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { Repository, MoreThanOrEqual, LessThan, In, IsNull } from "typeorm";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Employee } from "./entities/employee.entity";
import { EmployeeFiles } from "./entities/employee-files.entity";
import { GeneratedDocuments } from "./entities/generated-documents.entity";
import { EmployeeWorkLocationHistory } from "./entities/employee-work-location-history.entity";
import { EmployeeLocation } from "./entities/employee-location.entity";
import { EmployeeFolder } from "./entities/employee-folder.entity";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateEmployeeFileDto } from "./dto/create-employee-file.dto";
import { UpdateEmployeeFileDto } from "./dto/update-employee-file.dto";
import { CreateGeneratedDocumentDto } from "./dto/create-generated-document.dto";
import { UpdateGeneratedDocumentDto } from "./dto/update-generated-document.dto";
import { CreateWorkLocationHistoryDto } from "./dto/create-work-location-history.dto";
import { UpdateWorkLocationHistoryDto } from "./dto/update-work-location-history.dto";
import { CreateEmployeeLocationDto } from "./dto/create-employee-location.dto";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

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
    @InjectRepository(EmployeeLocation)
    private employeeLocationRepository: Repository<EmployeeLocation>,
    @InjectRepository(EmployeeFolder)
    private folderRepository: Repository<EmployeeFolder>,
    @Inject("NOTIFICATIONS_RMQ")
    private readonly notificationsClient: ClientProxy,
    private httpService: HttpService,
  ) {}

  private _filesRepoRootCache: string | null = null;

  /**
   * Rădăcina pentru toate fișierele – același arbore ca company/locations/furnizori.
   * Prioritate: FILES_BASE_PATH (env) > rezolvare din __dirname > fallback (cwd).
   * Rezultatul e cache-uit ca să nu se logheze la fiecare apel.
   */
  private getFilesRepoRoot(): string {
    if (this._filesRepoRootCache != null) {
      return this._filesRepoRootCache;
    }
    const fromEnv = (process.env.FILES_BASE_PATH || process.env.REPO_ROOT || process.env.IMAGES_ROOT || "").trim();
    if (fromEnv) {
      this._filesRepoRootCache = path.resolve(fromEnv);
      return this._filesRepoRootCache;
    }
    // __dirname is .../giurom-backend/employees/src (dev with ts-node) or .../giurom-backend/employees/dist (prod)
    let repoRoot = path.resolve(__dirname, "../../..");
    if (path.basename(repoRoot) === "giurom-backend") {
      repoRoot = path.dirname(repoRoot);
    }
    const fsRoot = path.parse(repoRoot).root || path.sep;
    if (repoRoot === fsRoot || repoRoot === path.sep || repoRoot.length <= 1) {
      const cwd = process.cwd();
      repoRoot =
        path.basename(cwd) === "employees" ? path.join(cwd, "..") : cwd;
      console.warn(
        `[getFilesRepoRoot] Repo root folosit (o dată per proces): ${repoRoot}`,
      );
    }
    this._filesRepoRootCache = repoRoot;
    return repoRoot;
  }

  private getEmployeesFilesRootDir(): string {
    return path.join(this.getFilesRepoRoot(), "files", "employees");
  }

  /**
   * Verifică că fullPath (deja rezolvat) rămâne strict în interiorul lui baseDir —
   * blochează path traversal (ex. numele de folder trimis de client conține "../../etc").
   * Compară cu path.sep la final ca "baseDir-evil" să nu treacă ca fiind în interiorul "baseDir".
   */
  private assertPathWithinBase(fullPath: string, baseDir: string): void {
    const resolvedBase = path.resolve(baseDir);
    const resolvedFull = path.resolve(fullPath);
    if (resolvedFull !== resolvedBase && !resolvedFull.startsWith(resolvedBase + path.sep)) {
      throw new BadRequestException("Cale invalidă");
    }
  }

  private simplifyEmployeeName(firstName: string, lastName: string): string {
    const fullName = `${firstName} ${lastName}`;
    return fullName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 50);
  }

  private async sendEmployeeNotification(
    type: string,
    title: string,
    description: string,
    metadata?: any,
    entity_id?: number,
    selectedWorkLocationId?: number,
  ): Promise<void> {
    try {
      let target_url: string | null = null;
      if (type !== "employee_deleted" && entity_id) {
        target_url = `/angajati/${entity_id}`;
      }
      const payloadMetadata = {
        ...metadata,
        ...(selectedWorkLocationId != null && { work_location_id: selectedWorkLocationId }),
      };
      await firstValueFrom(
        this.notificationsClient.emit(
          { cmd: "employees.notification" },
          {
            type,
            title,
            description,
            entity_id,
            entity_type: "employee",
            metadata: payloadMetadata,
            priority: "medium",
            target_url,
          },
        ),
      );
    } catch (error) {
      console.error("Failed to send employee notification:", error);
    }
  }

  // Crearea unui angajat nou. selectedWorkLocationId = locația selectată în UI (colț dreapta sus).
  async create(createEmployeeDto: CreateEmployeeDto, selectedWorkLocationId?: number): Promise<Employee> {
    // Verifică dacă email-ul există deja
    const existingEmployee = await this.employeeRepository.findOne({
      where: { email: createEmployeeDto.email },
    });

    if (existingEmployee) {
      throw new ConflictException("Un angajat cu acest email există deja");
    }

    // Verifică dacă CNP-ul există deja
    const existingCNP = await this.employeeRepository.findOne({
      where: { personal_number: createEmployeeDto.personal_number },
    });

    if (existingCNP) {
      throw new ConflictException("Un angajat cu acest CNP există deja");
    }

    // Validează data angajării (nu poate fi în viitor). Compară doar componenta de dată (fără ore/timezone)
    const hireDate = new Date(createEmployeeDto.hire_date);
    hireDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (hireDate.getTime() > today.getTime()) {
      throw new BadRequestException("Data angajării nu poate fi în viitor");
    }

    // Validează data nașterii (angajatul trebuie să aibă cel puțin 16 ani)
    const birthDate = new Date(createEmployeeDto.birth_date);
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 16);

    if (birthDate > minAge) {
      throw new BadRequestException(
        "Angajatul trebuie să aibă cel puțin 16 ani",
      );
    }

    // Validează data încetării contractului (dacă există)
    if (createEmployeeDto.termination_date) {
      const terminationDate = new Date(createEmployeeDto.termination_date);
      if (terminationDate <= hireDate) {
        throw new BadRequestException(
          "Data încetării contractului trebuie să fie după data angajării",
        );
      }
    }

    if (
      createEmployeeDto.work_location_default_id == null &&
      selectedWorkLocationId != null &&
      Number.isFinite(Number(selectedWorkLocationId))
    ) {
      createEmployeeDto.work_location_default_id = Number(selectedWorkLocationId);
    }

    const employee = this.employeeRepository.create(createEmployeeDto);
    const savedEmployee = await this.employeeRepository.save(employee);

    // Populează automat tabela Employees_Locations dacă există work_location_default_id
    if (savedEmployee.work_location_default_id) {
      const employeeLocation = this.employeeLocationRepository.create({
        employeeId: savedEmployee.id,
        idLocation: savedEmployee.work_location_default_id,
      });
      await this.employeeLocationRepository.save(employeeLocation);
    }

    // Create the required folder structure for the new employee
    await this.createEmployeeFolderStructure(savedEmployee);

    await this.sendEmployeeNotification(
      "employee_created",
      "Angajat nou creat",
      `A fost creat un nou angajat: ${savedEmployee.first_name} ${savedEmployee.last_name}`,
      {
        employeeId: savedEmployee.id,
        firstName: savedEmployee.first_name,
        lastName: savedEmployee.last_name,
      },
      savedEmployee.id,
      selectedWorkLocationId,
    );

    return savedEmployee;
  }

  private async createEmployeeFolderStructure(
    employee: Employee,
  ): Promise<void> {
    // Nu mai creăm directoare pe disk în files/employees; doar imaginile de profil se salvează (on-demand în createFile)
  }

  // Listarea angajaților cu filtrare și paginare
  async findAll(
    page: number = 1,
    limit: number = 10,
    is_active?: boolean,
    department?: number,
    contract_type?: string,
    work_location_id?: number,
    location_id?: number,
    department_name?: string,
  ): Promise<{ employees: Employee[]; total: number; totalPages: number }> {
    console.log("🔍 [EMPLOYEES] findAll called with params:", {
      page,
      limit,
      is_active,
      department,
      contract_type,
      work_location_id,
      location_id,
      department_name,
    });

    const queryBuilder = this.employeeRepository
      .createQueryBuilder("employee")
      .leftJoinAndSelect("employee.employeeLocations", "employeeLocations");

    // Aplică filtrele
    if (is_active !== undefined) {
      queryBuilder.andWhere("employee.is_active = :is_active", { is_active });
    }

    if (department) {
      queryBuilder.andWhere("employee.department_default_id = :department", {
        department,
      });
    }

    if (contract_type) {
      queryBuilder.andWhere("employee.contract_type = :contract_type", {
        contract_type,
      });
    }

    if (work_location_id) {
      queryBuilder.andWhere(
        "employee.work_location_default_id = :work_location_id",
        { work_location_id },
      );
    }

    // Filtrare după locația din employees_locations
    if (location_id) {
      console.log(
        "🔍 [EMPLOYEES] Applying location filter for location_id:",
        location_id,
      );
      // Check both employee_locations table and work_location_default_id field
      queryBuilder.andWhere(
        "(employeeLocations.idLocation = :location_id OR employee.work_location_default_id = :location_id)",
        { location_id },
      );
    }

    // Filtrare după numele departamentului - temporar dezactivată (tabela worklocation_departments nu există)
    if (department_name) {
      console.log(
        "🔍 [EMPLOYEES] Department name filter requested but not available:",
        department_name,
      );
      // TODO: Implementează filtrarea după numele departamentului când tabela worklocation_departments va fi disponibilă
    }

    // Calculează offset-ul pentru paginare
    const offset = (page - 1) * limit;

    // Execută query-ul cu paginare
    const [employees, total] = await queryBuilder
      .orderBy("employee.created_at", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // Încarcă folderele separat (evită dependența de relația TypeORM employee.folders)
    if (employees.length > 0) {
      const ids = employees.map((e) => e.id);
      const folders = await this.folderRepository.find({
        where: { employee_id: In(ids) },
      });
      for (const emp of employees) {
        (emp as any).folders = folders.filter(
          (f: any) => f.employee_id === emp.id,
        );
      }
    }

    console.log("🔍 [EMPLOYEES] Query result:", {
      totalEmployees: total,
      returnedEmployees: employees.length,
      employees: employees.map((emp) => ({
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        employeeLocations:
          emp.employeeLocations?.map((el) => el.idLocation) || [],
      })),
    });

    // Log detaliat pentru debugging
    if (location_id) {
      console.log("🔍 [EMPLOYEES] Angajații din locația " + location_id + ":");
      employees.forEach((emp, index) => {
        console.log(
          `  ${index + 1}. ${emp.first_name} ${emp.last_name} (ID: ${emp.id}, Locations: ${emp.employeeLocations?.map((el) => el.idLocation).join(", ") || "none"})`,
        );
      });
      if (employees.length === 0) {
        console.log("  ❌ Nu s-au găsit angajați în locația " + location_id);
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      employees,
      total,
      totalPages,
    };
  }

  private locationsBaseUrl(): string {
    return process.env.LOCATIONS_HTTP_URL || "http://localhost:3004";
  }

  private internalServiceHeaders(): Record<string, string> {
    return {
      "x-internal-service": "employees",
      "x-service-secret":
        process.env.SERVICE_SECRET || "",
      "Content-Type": "application/json",
    };
  }

  /** Compania unei locații — folosit pentru validarea scope-ului în for-own. */
  async getLocationCompanyId(locationId: number): Promise<number | null> {
    try {
      const resp = await axios.get(
        `${this.locationsBaseUrl()}/locations/${locationId}`,
        { headers: this.internalServiceHeaders(), timeout: 8000 },
      );
      const cid = resp.data?.company_id ?? resp.data?.companyId;
      const n = Number(cid);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  async assertLocationInCompany(
    locationId: number,
    companyId: number | null | undefined,
  ): Promise<void> {
    if (companyId == null || !Number.isFinite(Number(companyId)) || Number(companyId) <= 0) {
      return;
    }
    const locCompanyId = await this.getLocationCompanyId(locationId);
    if (locCompanyId == null) {
      throw new ForbiddenException("Locația nu a putut fi validată");
    }
    if (locCompanyId !== Number(companyId)) {
      throw new ForbiddenException(
        "Locația nu aparține companiei utilizatorului autentificat",
      );
    }
  }

  // Returnează angajați activi din locația dată (scope colegi operaționali).
  async findForOwn(
    location_id: number,
  ): Promise<
    {
      id: number;
      first_name: string;
      last_name: string;
      full_name: string;
      work_location_id: number | null;
      is_active: boolean;
    }[]
  > {
    const queryBuilder = this.employeeRepository
      .createQueryBuilder("employee")
      .select([
        "employee.id",
        "employee.first_name",
        "employee.last_name",
        "employee.work_location_default_id",
        "employee.is_active",
      ])
      .where("employee.is_active = :is_active", { is_active: true })
      .leftJoin("employee.employeeLocations", "employeeLocations")
      .andWhere(
        "(employeeLocations.idLocation = :location_id OR employee.work_location_default_id = :location_id)",
        { location_id },
      );

    const employees = await queryBuilder
      .orderBy("employee.first_name", "ASC")
      .addOrderBy("employee.last_name", "ASC")
      .getMany();

    return employees.map((emp) => ({
      id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      full_name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
      work_location_id: emp.work_location_default_id ?? null,
      is_active: Boolean(emp.is_active),
    }));
  }

  // Listare toți angajații pentru o companie (după toate locațiile companiei din microserviciul locations)
  async findAllByCompany(companyId: number): Promise<Employee[]> {
    // 1) Preia toate locațiile companiei — endpoint dedicat (nu GET /locations?company_id=, care e ignorat)
    const baseUrl = process.env.LOCATIONS_HTTP_URL || "http://localhost:3004";
    let locationIds: number[] = [];
    try {
      const resp = await axios.get(
        `${baseUrl}/locations/company/${companyId}`,
        {
          headers: {
            "x-internal-service": "employees",
            "x-service-secret":
              process.env.SERVICE_SECRET || "",
            "Content-Type": "application/json",
          },
          timeout: 8000,
        },
      );
      const locations = (
        Array.isArray(resp.data)
          ? resp.data
          : resp.data?.locations || resp.data?.data || []
      ) as any[];
      locationIds = locations
        .map((l: any) => Number(l?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);
    } catch (e) {
      console.error(
        `[EMPLOYEES] findAllByCompany: failed to load locations for company ${companyId}:`,
        (e as Error)?.message || e,
      );
      return [];
    }

    if (locationIds.length === 0) return [];

    // 2) Găște angajații care au fie locația implicită în acele locații, fie asociere în employees_locations
    const qb = this.employeeRepository
      .createQueryBuilder("employee")
      .leftJoin("employee.employeeLocations", "el")
      .where(
        "(employee.work_location_default_id IN (:...locIds) OR el.idLocation IN (:...locIds))",
        { locIds: locationIds },
      )
      .orderBy("employee.created_at", "DESC")
      .distinct(true);

    const employees = await qb.getMany();
    return employees;
  }

  // Găsirea unui angajat după user_id (prin auth service)
  async findByUserId(userId: number): Promise<Employee> {
    try {
      // Obține employee_id din auth service (prin gateway sau direct)
      const authServiceUrl =
        process.env.AUTH_SERVICE_URL || "http://localhost:3001";
      const userResponse = await firstValueFrom(
        this.httpService.get(`${authServiceUrl}/users/${userId}`, {
          headers: {
            "X-Internal-Service": "employees-service",
            "X-Service-Secret":
              process.env.SERVICE_SECRET || '',
          },
        }),
      );

      const userData = userResponse.data?.data || userResponse.data;
      const employeeId = userData?.id_employee || userData?.employee_id;

      if (!employeeId) {
        throw new NotFoundException(
          `Utilizatorul cu ID ${userId} nu are un employee_id asociat`,
        );
      }

      // Găsește employee-ul după employee_id
      return this.findOne(employeeId);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(
        `Nu s-a putut găsi angajatul pentru utilizatorul cu ID ${userId}: ${error.message}`,
      );
    }
  }

  // Găsirea unui angajat după ID
  // Returnează doar id, first_name, last_name pentru un angajat (pentru utilizatori cu permisiunea employees.read_own)
  async findNameById(
    id: number,
  ): Promise<{
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
  }> {
    const employee = await this.employeeRepository.findOne({
      where: { id },
      select: ["id", "first_name", "last_name"],
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
    }

    return {
      id: employee.id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      full_name: `${employee.first_name} ${employee.last_name}`.trim(),
    };
  }

  async assertCanAccessEmployee(
    employeeId: number,
    user?: {
      sub?: number;
      id?: number;
      company_id?: number | null;
      permissions?: string[];
      bypassAuth?: boolean;
    },
  ): Promise<void> {
    if (!user || user.bypassAuth) {
      return;
    }
    const perms = user.permissions || [];
    if (perms.includes('assignment.read_all')) {
      return;
    }
    const selfId = Number(user.sub ?? user.id);
    if (Number.isFinite(selfId) && selfId === employeeId) {
      return;
    }
    const companyId = Number(user.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        'Compania utilizatorului nu este determinată',
      );
    }
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employeeId} nu a fost găsit`,
      );
    }
    if (employee.work_location_default_id) {
      await this.assertLocationInCompany(
        employee.work_location_default_id,
        companyId,
      );
      return;
    }
    throw new ForbiddenException(
      'Angajatul nu aparține companiei dumneavoastră',
    );
  }

  async findOne(
    id: number,
    user?: {
      sub?: number;
      id?: number;
      company_id?: number | null;
      permissions?: string[];
      bypassAuth?: boolean;
    },
  ): Promise<Employee> {
    await this.assertCanAccessEmployee(id, user);
    const employee = await this.employeeRepository.findOne({
      where: { id },
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
    }

    // Load related collections separately to avoid join metadata issues
    const [
      workLocationHistory,
      employeeFiles,
      generatedDocuments,
      employeeLocations,
    ] = await Promise.all([
      this.workLocationHistoryRepository.find({
        where: { employee_id: id } as any,
      }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
      this.employeeLocationRepository.find({
        where: { employeeId: id } as any,
      }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;
    (employee as any).employeeLocations = employeeLocations;

    // Dacă angajatul are locație, completează company_id și company_name din locație (o locație = o firmă)
    if (employee.work_location_default_id) {
      try {
        const locationsUrl =
          process.env.LOCATIONS_HTTP_URL || "http://localhost:3004";
        const locRes = await axios.get(
          `${locationsUrl}/locations/${employee.work_location_default_id}`,
        );
        const loc = locRes.data;
        const companyId = (loc as any)?.company_id ?? (loc as any)?.companyId;
        if (companyId != null) {
          (employee as any).company_id = companyId;
        }
        const companyName =
          (loc as any)?.company_name ?? (loc as any)?.companyName;
        if (companyName != null) {
          (employee as any).company_name = companyName;
        }
      } catch {
        // Ignoră dacă locations nu răspunde
      }
    }

    return employee;
  }

  // Căutarea angajaților după email
  async findByEmail(email: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { email },
    });

    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu email-ul ${email} nu a fost găsit`,
      );
    }

    const id = employee.id;
    const [
      workLocationHistory,
      employeeFiles,
      generatedDocuments,
      employeeLocations,
    ] = await Promise.all([
      this.workLocationHistoryRepository.find({
        where: { employee_id: id } as any,
      }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
      this.employeeLocationRepository.find({
        where: { employeeId: id } as any,
      }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;
    (employee as any).employeeLocations = employeeLocations;

    return employee;
  }

  /**
   * Returnează informații de bază pentru o listă de angajați (folosit pentru batch lookup între microservicii)
   */
  async findByIdsBasic(
    ids: number[],
  ): Promise<
    Array<
      Pick<
        Employee,
        | "id"
        | "first_name"
        | "last_name"
        | "email"
        | "is_active"
        | "work_location_default_id"
      >
    >
  > {
    if (!ids || ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));

    const employees = await this.employeeRepository.find({
      where: { id: In(uniqueIds) },
      select: [
        "id",
        "first_name",
        "last_name",
        "email",
        "is_active",
        "work_location_default_id",
      ],
    });

    return employees;
  }

  // Găsirea unui angajat după telefon
  async findByPhone(phone: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { phone },
    });

    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu numărul de telefon ${phone} nu a fost găsit`,
      );
    }

    const id = employee.id;
    const [
      workLocationHistory,
      employeeFiles,
      generatedDocuments,
      employeeLocations,
    ] = await Promise.all([
      this.workLocationHistoryRepository.find({
        where: { employee_id: id } as any,
      }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
      this.employeeLocationRepository.find({
        where: { employeeId: id } as any,
      }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;
    (employee as any).employeeLocations = employeeLocations;

    return employee;
  }

  // Căutarea angajaților după CNP
  async findByCNP(cnp: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({
      where: { personal_number: cnp },
    });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu CNP-ul ${cnp} nu a fost găsit`);
    }

    const id = employee.id;
    const [
      workLocationHistory,
      employeeFiles,
      generatedDocuments,
      employeeLocations,
    ] = await Promise.all([
      this.workLocationHistoryRepository.find({
        where: { employee_id: id } as any,
      }),
      this.filesRepository.find({ where: { employee_id: id } as any }),
      this.documentsRepository.find({ where: { employee_id: id } as any }),
      this.employeeLocationRepository.find({
        where: { employeeId: id } as any,
      }),
    ]);

    (employee as any).workLocationHistory = workLocationHistory;
    (employee as any).employeeFiles = employeeFiles;
    (employee as any).generatedDocuments = generatedDocuments;
    (employee as any).employeeLocations = employeeLocations;

    return employee;
  }

  // Actualizarea unui angajat
  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    selectedWorkLocationId?: number,
    user?: {
      sub?: number;
      id?: number;
      company_id?: number | null;
      permissions?: string[];
      bypassAuth?: boolean;
    },
  ): Promise<Employee> {
    const employee = await this.findOne(id, user);

    // Verifică unicitatea email-ului (dacă se schimbă)
    if (updateEmployeeDto.email && updateEmployeeDto.email !== employee.email) {
      const existingEmployee = await this.employeeRepository.findOne({
        where: { email: updateEmployeeDto.email },
      });

      if (existingEmployee) {
        throw new ConflictException("Un angajat cu acest email există deja");
      }
    }

    // Verifică unicitatea CNP-ului (dacă se schimbă)
    if (
      updateEmployeeDto.personal_number &&
      updateEmployeeDto.personal_number !== employee.personal_number
    ) {
      const existingCNP = await this.employeeRepository.findOne({
        where: { personal_number: updateEmployeeDto.personal_number },
      });

      if (existingCNP) {
        throw new ConflictException("Un angajat cu acest CNP există deja");
      }
    }

    // Validări pentru date (dacă se actualizează)
    if (updateEmployeeDto.hire_date) {
      const hireDate = new Date(updateEmployeeDto.hire_date);
      hireDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (hireDate.getTime() > today.getTime()) {
        throw new BadRequestException("Data angajării nu poate fi în viitor");
      }
    }

    if (updateEmployeeDto.birth_date) {
      const birthDate = new Date(updateEmployeeDto.birth_date);
      const minAge = new Date();
      minAge.setFullYear(minAge.getFullYear() - 16);

      if (birthDate > minAge) {
        throw new BadRequestException(
          "Angajatul trebuie să aibă cel puțin 16 ani",
        );
      }
    }

    // Actualizează entitatea
    await this.employeeRepository.update(id, updateEmployeeDto);
    const updatedEmployee = await this.findOne(id);

    await this.sendEmployeeNotification(
      "employee_updated",
      "Angajat modificat",
      `Au fost modificate informațiile angajatului: ${updatedEmployee.first_name} ${updatedEmployee.last_name}`,
      {
        employeeId: updatedEmployee.id,
        firstName: updatedEmployee.first_name,
        lastName: updatedEmployee.last_name,
      },
      updatedEmployee.id,
      selectedWorkLocationId,
    );

    return updatedEmployee;
  }

  // Ștergerea unui angajat
  async remove(
    id: number,
    selectedWorkLocationId?: number,
    user?: {
      sub?: number;
      id?: number;
      company_id?: number | null;
      permissions?: string[];
      bypassAuth?: boolean;
    },
  ): Promise<{ message: string }> {
    await this.assertCanAccessEmployee(id, user);
    const employee = await this.employeeRepository.findOne({ where: { id } });

    if (!employee) {
      throw new NotFoundException(`Angajatul cu ID-ul ${id} nu a fost găsit`);
    }

    // Application-level cascading delete: Delete related records before deleting employee
    // This respects foreign key constraints by removing child records first

    try {
      // 1. Delete employee files from database
      await this.filesRepository.delete({ employee_id: id } as any);
      console.log(`✅ Deleted employee files for employee ${id}`);
    } catch (error) {
      console.error(
        `Failed to delete employee files for employee ${id}:`,
        error,
      );
    }

    try {
      // 2. Delete generated documents
      await this.documentsRepository.delete({ employee_id: id } as any);
      console.log(`✅ Deleted generated documents for employee ${id}`);
    } catch (error) {
      console.error(
        `Failed to delete generated documents for employee ${id}:`,
        error,
      );
    }

    try {
      // 3. Delete work location history
      await this.workLocationHistoryRepository.delete({
        employee_id: id,
      } as any);
      console.log(`✅ Deleted work location history for employee ${id}`);
    } catch (error) {
      console.error(
        `Failed to delete work location history for employee ${id}:`,
        error,
      );
    }

    try {
      // 4. Delete employee location assignments
      await this.employeeLocationRepository.delete({ employeeId: id } as any);
      console.log(
        `✅ Deleted employee location assignments for employee ${id}`,
      );
    } catch (error) {
      console.error(
        `Failed to delete employee location assignments for employee ${id}:`,
        error,
      );
    }

    // 5. Delete physical files from file system (both old and new structures)
    const employeeName = this.simplifyEmployeeName(
      employee.first_name,
      employee.last_name,
    );
    const baseDir = this.getEmployeesFilesRootDir();

    // Try to remove the new structure (name-based)
    const employeeFilesDirNew = path.join(baseDir, employeeName);
    if (fs.existsSync(employeeFilesDirNew)) {
      try {
        fs.rmSync(employeeFilesDirNew, { recursive: true, force: true });
        console.log(
          `✅ Deleted employee files directory (new structure): ${employeeFilesDirNew}`,
        );
      } catch (error) {
        console.error(
          `Failed to delete employee files directory (new structure): ${employeeFilesDirNew}`,
          error,
        );
      }
    }

    // Try to remove the old structure (ID-based) for backward compatibility
    const employeeFilesDirOld = path.join(baseDir, id.toString());
    if (fs.existsSync(employeeFilesDirOld)) {
      try {
        fs.rmSync(employeeFilesDirOld, { recursive: true, force: true });
        console.log(
          `✅ Deleted employee files directory (old structure): ${employeeFilesDirOld}`,
        );
      } catch (error) {
        console.error(
          `Failed to delete employee files directory (old structure): ${employeeFilesDirOld}`,
          error,
        );
      }
    }

    // 6. Finally, delete the employee record
    await this.employeeRepository.remove(employee);
    console.log(
      `✅ Deleted employee record: ${employee.first_name} ${employee.last_name}`,
    );

    await this.sendEmployeeNotification(
      "employee_deleted",
      "Angajat șters",
      `Angajatul ${employee.first_name} ${employee.last_name} a fost șters din sistem`,
      {
        employeeId: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
      },
      employee.id,
      selectedWorkLocationId,
    );

    return {
      message: `Angajatul ${employee.first_name} ${employee.last_name} a fost șters cu succes`,
    };
  }

  // Activarea/dezactivarea unui angajat
  async toggleActive(
    id: number,
    user?: {
      sub?: number;
      id?: number;
      company_id?: number | null;
      permissions?: string[];
      bypassAuth?: boolean;
    },
  ): Promise<Employee> {
    await this.assertCanAccessEmployee(id, user);
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
    const active = await this.employeeRepository.count({
      where: { is_active: true },
    });
    const inactive = total - active;

    // Statistici per tip de contract
    const contractTypes = await this.employeeRepository
      .createQueryBuilder("employee")
      .select("employee.contract_type", "contract_type")
      .addSelect("COUNT(employee.id)", "count")
      .groupBy("employee.contract_type")
      .getRawMany();

    const byContractType = contractTypes.reduce((acc, curr) => {
      acc[curr.contract_type] = parseInt(curr.count);
      return acc;
    }, {});

    // Statistici per gen
    const genders = await this.employeeRepository
      .createQueryBuilder("employee")
      .select("employee.gender", "gender")
      .addSelect("COUNT(employee.id)", "count")
      .groupBy("employee.gender")
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
  async createFile(
    createFileDto: CreateEmployeeFileDto,
  ): Promise<EmployeeFiles> {
    console.log("📥 Received createFileDto:", {
      employee_id: createFileDto.employee_id,
      file_name: createFileDto.file_name,
      file_type: createFileDto.file_type,
      note: createFileDto.note,
      has_content: !!createFileDto.file_content,
      content_length: createFileDto.file_content?.length || 0,
    });

    // Verifică dacă angajatul există
    const employee = await this.employeeRepository.findOne({
      where: { id: createFileDto.employee_id },
    });

    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${createFileDto.employee_id} nu a fost găsit`,
      );
    }

    // Verifică dacă angajatul este activ
    if (!employee.is_active) {
      throw new BadRequestException(
        "Nu se pot adăuga fișiere pentru un angajat inactiv",
      );
    }

    // Verifică dacă este un fișier de tip profil (profile picture)
    const isProfilePicture = createFileDto.file_type === "profile_picture";

    // Dacă este o fotografie de profil, șterge fotografia existentă
    if (isProfilePicture) {
      await this.removeExistingProfilePicture(employee.id);
    }

    // Generate unique filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const fileExtension = createFileDto.file_name.split(".").pop() || "txt";
    const baseFileName =
      createFileDto.file_name.replace(/\.[^/.]+$/, "") || "file";
    const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    console.log(
      `📝 Original: ${createFileDto.file_name}, Generated: ${uniqueFileName}`,
    );

    // Map file types to appropriate subfolders
    const fileTypeToFolderMap: { [key: string]: string } = {
      "Contract de muncă": "Contract de muncă",
      "Copie CI": "Copie CI",
      "Fișă post": "Fișă post",
      "Acte adiționale contract": "Acte adiționale contract",
      "Acord de confidențialitate": "Acord de confidențialitate",
      "Documente SSM/PSI": "Documente SSM/PSI",
      "Adeverință de vechime": "Adeverință de vechime",
      Evaluări: "Evaluări",
      "Certificate medicale": "Certificate medicale",
      "Cursuri / certificări": "Cursuri / certificări",
      "Alte documente": "Alte documente",
      profile_picture: "profile_picture",
    };

    let subfolder =
      fileTypeToFolderMap[createFileDto.file_type] || "Alte documente";
    console.log("📁 Initial subfolder from file_type:", {
      file_type: createFileDto.file_type,
      subfolder,
    });

    // Dacă e specificat folder_id, folosim calea folderului (folder_path) pentru subfolder
    if (createFileDto.folder_id != null) {
      const folder = await this.folderRepository.findOne({
        where: {
          id: createFileDto.folder_id,
          employee_id: createFileDto.employee_id,
        },
      });
      if (!folder) {
        throw new NotFoundException(
          `Folderul cu ID ${createFileDto.folder_id} nu a fost găsit pentru acest angajat`,
        );
      }
      const employeeNameForPath = this.simplifyEmployeeName(
        employee.first_name,
        employee.last_name,
      );
      const prefix = `/files/employees/${employeeNameForPath}/`;
      const folderPathNorm = (folder.folder_path || "").replace(/\/+$/, "");
      subfolder = folderPathNorm.startsWith(prefix)
        ? folderPathNorm.slice(prefix.length).replace(/\/+$/, "")
        : folder.description || subfolder;
      console.log("📁 Subfolder din folder_id:", {
        folder_id: createFileDto.folder_id,
        subfolder,
      });
    } else if (createFileDto.note) {
      const folderMatch = createFileDto.note.match(/\|folder:([^|]+)\|/);
      if (folderMatch && folderMatch[1]) {
        subfolder = folderMatch[1];
        console.log("📁 Updated subfolder from note:", subfolder);
      }
    }
    console.log("📁 Final subfolder:", subfolder);

    // Salvare întotdeauna în files/employees/{nume_angajat}/profile_picture sau files/employees/{nume_angajat}/{subfolder}
    const employeeName = this.simplifyEmployeeName(
      employee.first_name,
      employee.last_name,
    );
    const fileLinkPath = isProfilePicture
      ? `/files/employees/${employeeName}/profile_picture/${uniqueFileName}`
      : `/files/employees/${employeeName}/${subfolder}/${uniqueFileName}`;
    console.log(
      "🔗 File link path (files/employees + nume angajat):",
      fileLinkPath,
    );

    const updatedFileLink = fileLinkPath;

    // Pe disk salvăm doar imaginile de profil în files/employees; restul documentelor nu se mai scriu aici
    const baseDir = this.getEmployeesFilesRootDir();
    if (isProfilePicture) {
      const fileDir = path.join(baseDir, employeeName, "profile_picture");
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }
      if (createFileDto.file_content) {
        try {
          const filePath = path.join(fileDir, uniqueFileName);
          let base64Data = createFileDto.file_content;
          if (base64Data.includes(",")) base64Data = base64Data.split(",")[1];
          const buffer = Buffer.from(base64Data, "base64");
          fs.writeFileSync(filePath, buffer);
          console.log(`✅ Poza de profil salvată pe disk: ${filePath}`);
        } catch (error) {
          console.error(
            "❌ Eroare la salvarea pozei de profil pe disk:",
            error,
          );
        }
      }
    }
    // Pentru documente care nu sunt profile_picture: nu se scrie nimic pe disk în files/employees (doar înregistrare în DB)

    // Verifică dacă există deja un fișier cu același nume pentru același angajat
    const existingFile = await this.filesRepository.findOne({
      where: {
        employee_id: createFileDto.employee_id,
        file_name: uniqueFileName,
      },
    });

    if (existingFile) {
      throw new ConflictException(
        `Un fișier cu numele "${uniqueFileName}" există deja pentru acest angajat`,
      );
    }

    // Validări suplimentare pentru tipuri specifice de fișiere
    if (createFileDto.file_type === "CV") {
      const existingCV = await this.filesRepository.findOne({
        where: {
          employee_id: createFileDto.employee_id,
          file_type: "CV",
        },
      });

      if (existingCV) {
        throw new ConflictException(
          "Angajatul are deja un CV încărcat. Vă rugăm să îl actualizați în loc să adăugați unul nou.",
        );
      }
    }

    // Create the file record with unique filename
    const file = this.filesRepository.create({
      ...createFileDto,
      file_name: uniqueFileName,
      file_link: updatedFileLink,
      expire_date: createFileDto.expire_date
        ? new Date(createFileDto.expire_date)
        : null,
      note: createFileDto.note || null,
      folder_id: createFileDto.folder_id ?? null,
    });

    const savedFile = await this.filesRepository.save(file);
    console.log(`✅ File record saved to database with ID: ${savedFile.id}`);

    // Dacă este o fotografie de profil, actualizează profilul angajatului
    if (isProfilePicture) {
      await this.updateEmployeeProfilePicture(employee.id, savedFile.file_link);
    }

    return savedFile;
  }

  // Șterge fotografia de profil existentă pentru un angajat
  private async removeExistingProfilePicture(
    employeeId: number,
  ): Promise<void> {
    console.log(
      `🗑️ Removing existing profile picture for employee ${employeeId}`,
    );

    // Găsește fotografia de profil existentă
    const existingProfilePicture = await this.filesRepository.findOne({
      where: {
        employee_id: employeeId,
        file_type: "profile_picture",
      },
    });

    if (existingProfilePicture) {
      try {
        // Șterge fișierul de pe disk
        const employee = await this.employeeRepository.findOne({
          where: { id: employeeId },
        });

        if (employee) {
          const employeeName = this.simplifyEmployeeName(
            employee.first_name,
            employee.last_name,
          );
          const baseDir = this.getEmployeesFilesRootDir();
          // Întotdeauna în files/employees/{nume}/profile_picture
          const filePath = path.join(
            baseDir,
            employeeName,
            "profile_picture",
            existingProfilePicture.file_name,
          );

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(
              `✅ Deleted existing profile picture from disk: ${filePath}`,
            );
          }

          // Șterge înregistrarea din baza de date
          await this.filesRepository.delete(existingProfilePicture.id);
          console.log(
            `✅ Deleted existing profile picture record from database: ${existingProfilePicture.id}`,
          );
        }
      } catch (error) {
        console.error("❌ Error removing existing profile picture:", error);
        // Continuă chiar dacă ștergerea eșuează
      }
    }
  }

  // Actualizează link-ul fotografiei de profil în profilul angajatului
  private async updateEmployeeProfilePicture(
    employeeId: number,
    profilePictureUrl: string,
  ): Promise<void> {
    console.log(
      `📸 Updating profile picture URL for employee ${employeeId}: ${profilePictureUrl}`,
    );

    // Convert direct file path to API proxy URL for the auth service
    // The auth service needs an API proxy URL that can be accessed by the frontend
    let apiProxyUrl = profilePictureUrl;

    // If this is a direct file path, convert it to an API proxy URL
    if (profilePictureUrl.startsWith("/files/")) {
      // Extract file ID from database to create proper API URL
      try {
        // Find the file record to get its ID
        const fileRecord = await this.filesRepository.findOne({
          where: {
            employee_id: employeeId,
            file_type: "profile_picture",
          },
        });

        if (fileRecord) {
          // Create API proxy URL using the file ID
          apiProxyUrl = `/api/employees/file/${fileRecord.id}/view`;
          console.log(
            `🔄 Converted direct file path to API proxy URL: ${apiProxyUrl}`,
          );
        } else {
          console.warn(
            `⚠️ Could not find profile picture file record for employee ${employeeId}`,
          );
          // If we can't find the file record, send empty string to use default avatar
          apiProxyUrl = "";
        }
      } catch (error) {
        console.error(
          "❌ Error finding file record for API proxy conversion:",
          error,
        );
        // If there's an error, send empty string to use default avatar
        apiProxyUrl = "";
      }
    }

    // Use API Gateway to communicate with auth service instead of direct service-to-service communication
    try {
      const apiGatewayUrl =
        process.env.API_GATEWAY_URL || "http://localhost:3002";
      await firstValueFrom(
        this.httpService.patch(
          `${apiGatewayUrl}/users/employee/${employeeId}/profile-image`,
          { profile_image: apiProxyUrl }, // Send API proxy URL instead of direct file path
          {
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Service": "employees-service",
              "X-Service-Secret":
                process.env.SERVICE_SECRET || '',
            },
          },
        ),
      );
    } catch (error) {
      console.error("❌ Error updating employee profile image:", error);
    }
  }

  // Găsește un fișier după ID
  async findOneFile(id: number): Promise<EmployeeFiles> {
    const file = await this.filesRepository.findOne({
      where: { id },
      relations: ["employee"],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
    }

    return file;
  }

  // Găsește toate fișierele unui angajat
  async findFilesByEmployee(employee_id: number): Promise<EmployeeFiles[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id },
    });

    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employee_id} nu a fost găsit`,
      );
    }

    return await this.filesRepository.find({
      where: { employee_id },
      relations: ["employee"],
      order: { updated_at: "DESC" },
    });
  }

  // Servește fișierul de pe disk
  async serveFile(
    file_id: number,
    forceDownload: boolean = false,
  ): Promise<{
    data: string;
    mimeType: string;
    fileName: string;
    disposition: "inline" | "attachment";
  }> {
    console.log(
      `🔍 Serving file with ID: ${file_id}, forceDownload: ${forceDownload}`,
    );

    const file = await this.findOneFile(file_id);
    console.log(`📄 File metadata:`, {
      id: file.id,
      name: file.file_name,
      employee_id: file.employee_id,
      file_link: file.file_link,
    });

    // Use the stored file_link directly instead of reconstructing the path
    // This ensures that files saved in location-specific paths can be retrieved correctly
    const baseDir = this.getEmployeesFilesRootDir();
    const rootDir = path.join(baseDir, ".."); // Get the root directory (giurom folder)

    // Convert the stored file_link to an actual file system path
    // file_link is stored as something like: /files/companies/TEST/Locații/TEST2/Angajați/eric-opreas/Fișă post/file.pdf
    // We need to join it with the root directory to get the actual file path
    // Since file_link starts with /files, we need to be careful not to double the 'files' part
    let filePath;
    if (file.file_link.startsWith("/files/companies/")) {
      filePath = path.join(rootDir, file.file_link.replace(/^\/files\//, ""));
    } else if (file.file_link.startsWith("/files/employees/")) {
      filePath = path.join(rootDir, file.file_link.replace(/^\/files\//, ""));
    } else {
      filePath = path.join(rootDir, file.file_link.replace(/^\//, ""));
    }

    if (!fs.existsSync(filePath)) {
      const fileDir = path.dirname(filePath);
      const fileName = path.basename(filePath);
      if (fs.existsSync(fileDir)) {
        const items = fs.readdirSync(fileDir);
        for (const item of items) {
          const itemPath = path.join(fileDir, item);
          if (fs.statSync(itemPath).isDirectory()) {
            const possiblePath = path.join(itemPath, fileName);
            if (fs.existsSync(possiblePath)) {
              filePath = possiblePath;
              break;
            }
          }
        }
      }
    }

    // Fallback: path relativ la baseDir (files/employees) – utile când rootDir diferă
    if (
      !fs.existsSync(filePath) &&
      file.file_link.startsWith("/files/employees/")
    ) {
      const relativePath = file.file_link
        .replace(/^\/files\/employees\//, "")
        .split("/")
        .join(path.sep);
      const altPath = path.join(baseDir, relativePath);
      if (fs.existsSync(altPath)) filePath = altPath;
    }

    // Fallback: files/employees/{nume_angajat}/profile_picture sau subfolder, plus format vechi by id
    if (!fs.existsSync(filePath)) {
      const employee = await this.employeeRepository.findOne({
        where: { id: file.employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Angajatul cu ID-ul ${file.employee_id} nu a fost găsit`,
        );
      }
      const employeeName = this.simplifyEmployeeName(
        employee.first_name,
        employee.last_name,
      );
      const isProfilePicture = file.file_type === "profile_picture";
      const employeeDir = path.join(baseDir, employeeName);

      filePath = isProfilePicture
        ? path.join(employeeDir, "profile_picture", file.file_name)
        : path.join(employeeDir, file.file_name);

      if (!fs.existsSync(filePath) && fs.existsSync(employeeDir)) {
        const subfolders = fs
          .readdirSync(employeeDir)
          .filter(
            (item) =>
              fs.statSync(path.join(employeeDir, item)).isDirectory() &&
              item !== "profile_picture",
          );
        for (const subfolder of subfolders) {
          const possiblePath = path.join(
            employeeDir,
            subfolder,
            file.file_name,
          );
          if (fs.existsSync(possiblePath)) {
            filePath = possiblePath;
            break;
          }
        }
      }
      if (!fs.existsSync(filePath)) {
        filePath = path.join(
          baseDir,
          file.employee_id.toString(),
          file.file_name,
        );
      }
      if (!fs.existsSync(filePath) && isProfilePicture) {
        filePath = path.join(
          baseDir,
          file.employee_id.toString(),
          "profile_picture",
          file.file_name,
        );
      }
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException("Fișierul nu a fost găsit pe disk");
    }

    const mimeType = this.getMimeType(file.file_name);
    const fileBuffer = fs.readFileSync(filePath);

    return {
      data: fileBuffer.toString("base64"),
      mimeType,
      fileName: file.file_name,
      disposition: forceDownload ? "attachment" : "inline",
    };
  }

  // Determină tipul MIME bazat pe extensia fișierului
  private getMimeType(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase();

    const mimeTypes: { [key: string]: string } = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      txt: "text/plain",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
    };

    return mimeTypes[extension || ""] || "application/octet-stream";
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
    const employee = await this.employeeRepository.findOne({
      where: { id: createDocumentDto.employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${createDocumentDto.employee_id} nu a fost găsit`,
      );
    }
    if (!employee.is_active) {
      throw new BadRequestException(
        "Nu se pot genera documente pentru un angajat inactiv",
      );
    }
    const existingDocument = await this.documentsRepository.findOne({
      where: {
        employee_id: createDocumentDto.employee_id,
        doc_id: createDocumentDto.doc_id,
        status: "Generated",
      },
    });
    if (existingDocument) {
      throw new ConflictException(
        `Există deja un document activ cu ID-ul ${createDocumentDto.doc_id} pentru acest angajat`,
      );
    }
    if (createDocumentDto.status === "Signed" && !createDocumentDto.signed_at) {
      throw new BadRequestException(
        "Data semnării este obligatorie pentru documentele semnate",
      );
    }
    if (createDocumentDto.signed_at && createDocumentDto.expired_date) {
      const signedDate = new Date(createDocumentDto.signed_at);
      const expiredDate = new Date(createDocumentDto.expired_date);
      if (signedDate >= expiredDate) {
        throw new BadRequestException(
          "Data expirării trebuie să fie după data semnării",
        );
      }
    }
    const document: GeneratedDocuments = this.documentsRepository.create(
      createDocumentDto as Partial<GeneratedDocuments>,
    );
    return await this.documentsRepository.save(document);
  }

  async documentsFindAll(params: {
    page?: number;
    limit?: number;
    employee_id?: number;
    status?: string;
    doc_id?: number;
  }): Promise<{
    documents: GeneratedDocuments[];
    total: number;
    totalPages: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const queryBuilder = this.documentsRepository
      .createQueryBuilder("document")
      .leftJoinAndSelect("document.employee", "employee");
    if (params.employee_id) {
      queryBuilder.andWhere("document.employee_id = :employee_id", {
        employee_id: params.employee_id,
      });
    }
    if (params.status) {
      queryBuilder.andWhere("document.status = :status", {
        status: params.status,
      });
    }
    if (params.doc_id) {
      queryBuilder.andWhere("document.doc_id = :doc_id", {
        doc_id: params.doc_id,
      });
    }
    const offset = (page - 1) * limit;
    const [documents, total] = await queryBuilder
      .orderBy("document.signed_at", "DESC")
      .addOrderBy("document.id", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return { documents, total, totalPages };
  }

  async documentFindOne(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentsRepository.findOne({
      where: { id },
      relations: ["employee"],
    });
    if (!document) {
      throw new NotFoundException(`Documentul cu ID-ul ${id} nu a fost găsit`);
    }
    return document;
  }

  async documentsFindByEmployee(
    employee_id: number,
  ): Promise<GeneratedDocuments[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employee_id} nu a fost găsit`,
      );
    }
    return await this.documentsRepository.find({
      where: { employee_id },
      relations: ["employee"],
      order: { signed_at: "DESC", id: "DESC" },
    });
  }

  async documentsFindByStatus(status: string): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({
      where: { status },
      relations: ["employee"],
      order: { signed_at: "DESC" },
    });
  }

  async documentsFindByDocId(doc_id: number): Promise<GeneratedDocuments[]> {
    return await this.documentsRepository.find({
      where: { doc_id },
      relations: ["employee"],
      order: { signed_at: "DESC" },
    });
  }

  async documentsFindExpired(): Promise<GeneratedDocuments[]> {
    const currentDate = new Date();
    return await this.documentsRepository.find({
      where: { expired_date: LessThan(currentDate), status: "Signed" },
      relations: ["employee"],
      order: { expired_date: "ASC" },
    });
  }

  async documentsUpdate(
    id: number,
    updateDocumentDto: any,
  ): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (
      updateDocumentDto.employee_id &&
      updateDocumentDto.employee_id !== document.employee_id
    ) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateDocumentDto.employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Angajatul cu ID-ul ${updateDocumentDto.employee_id} nu a fost găsit`,
        );
      }
    }
    if (
      updateDocumentDto.status === "Signed" &&
      !updateDocumentDto.signed_at &&
      !document.signed_at
    ) {
      throw new BadRequestException(
        "Data semnării este obligatorie pentru documentele semnate",
      );
    }
    const signedAt = updateDocumentDto.signed_at || document.signed_at;
    const expiredDate = updateDocumentDto.expired_date || document.expired_date;
    if (signedAt && expiredDate) {
      const signedDate = new Date(signedAt);
      const expiredDateObj = new Date(expiredDate);
      if (signedDate >= expiredDateObj) {
        throw new BadRequestException(
          "Data expirării trebuie să fie după data semnării",
        );
      }
    }
    await this.documentsRepository.update(id, updateDocumentDto);
    return await this.documentFindOne(id);
  }

  async documentsSign(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (document.status === "Signed") {
      throw new BadRequestException("Documentul este deja semnat");
    }
    if (document.status === "Expired" || document.status === "Cancelled") {
      throw new BadRequestException(
        "Nu se poate semna un document expirat sau anulat",
      );
    }
    await this.documentsRepository.update(id, {
      status: "Signed",
      signed_at: new Date(),
    });
    return await this.documentFindOne(id);
  }

  async documentsCancel(id: number): Promise<GeneratedDocuments> {
    const document = await this.documentFindOne(id);
    if (document.status === "Cancelled") {
      throw new BadRequestException("Documentul este deja anulat");
    }
    if (document.status === "Expired") {
      throw new BadRequestException("Nu se poate anula un document expirat");
    }
    await this.documentsRepository.update(id, { status: "Cancelled" });
    return await this.documentFindOne(id);
  }

  async documentsRemove(id: number): Promise<{ message: string }> {
    const document = await this.documentFindOne(id);
    if (document.status === "Signed") {
      throw new BadRequestException(
        "Nu se pot șterge documentele semnate. Vă rugăm să le anulați mai întâi.",
      );
    }
    await this.documentsRepository.delete(id);
    return {
      message: `Documentul pentru angajatul ${document.employee.first_name} ${document.employee.last_name} a fost șters cu succes`,
    };
  }

  async documentsStatistics(): Promise<{
    total: number;
    byStatus: { [key: string]: number };
    byEmployee: { [key: string]: number };
    expiringSoon: number;
    recentlySigned: number;
    byDocType: { [key: string]: number };
  }> {
    const total = await this.documentsRepository.count();
    const statusStats = await this.documentsRepository
      .createQueryBuilder("document")
      .select("document.status", "status")
      .addSelect("COUNT(document.id)", "count")
      .groupBy("document.status")
      .getRawMany();
    const byStatus = statusStats.reduce(
      (acc: any, curr: any) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );
    const employeeStats = await this.documentsRepository
      .createQueryBuilder("document")
      .select("document.employee_id", "employee_id")
      .addSelect("COUNT(document.id)", "count")
      .groupBy("document.employee_id")
      .getRawMany();
    const byEmployee = employeeStats.reduce(
      (acc: any, curr: any) => {
        acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await this.documentsRepository.count({
      where: { expired_date: LessThan(thirtyDaysFromNow), status: "Signed" },
    });
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlySigned = await this.documentsRepository.count({
      where: {
        signed_at: MoreThanOrEqual(sevenDaysAgo as any),
        status: "Signed",
      } as any,
    });
    const docTypeStats = await this.documentsRepository
      .createQueryBuilder("document")
      .select("document.doc_id", "doc_id")
      .addSelect("COUNT(document.id)", "count")
      .groupBy("document.doc_id")
      .getRawMany();
    const byDocType = docTypeStats.reduce(
      (acc: any, curr: any) => {
        acc[`DocType_${curr.doc_id}`] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      total,
      byStatus,
      byEmployee,
      expiringSoon,
      recentlySigned,
      byDocType,
    };
  }

  // ==================== WORK LOCATION HISTORY METHODS ====================

  async createWorkHistory(
    createHistoryDto: any,
  ): Promise<EmployeeWorkLocationHistory> {
    const employee = await this.employeeRepository.findOne({
      where: { id: createHistoryDto.employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${createHistoryDto.employee_id} nu a fost găsit`,
      );
    }
    if (!employee.is_active) {
      throw new BadRequestException(
        "Nu se poate adăuga istoric pentru un angajat inactiv",
      );
    }
    const history: EmployeeWorkLocationHistory =
      this.workLocationHistoryRepository.create(
        createHistoryDto as Partial<EmployeeWorkLocationHistory>,
      );
    return await this.workLocationHistoryRepository.save(history);
  }

  async workHistoryFindAll(params: {
    page?: number;
    limit?: number;
    employee_id?: number;
    work_location_id?: number;
  }): Promise<{
    history: EmployeeWorkLocationHistory[];
    total: number;
    totalPages: number;
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const qb = this.workLocationHistoryRepository
      .createQueryBuilder("history")
      .leftJoinAndSelect("history.employee", "employee");
    if (params.employee_id) {
      qb.andWhere("history.employee_id = :employee_id", {
        employee_id: params.employee_id,
      });
    }
    if (params.work_location_id) {
      qb.andWhere("history.work_location_id = :work_location_id", {
        work_location_id: params.work_location_id,
      });
    }
    const offset = (page - 1) * limit;
    const [history, total] = await qb
      .orderBy("history.created_at", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    const totalPages = Math.ceil(total / limit);
    return { history, total, totalPages };
  }

  async workHistoryFindOne(id: number): Promise<EmployeeWorkLocationHistory> {
    const history = await this.workLocationHistoryRepository.findOne({
      where: { id },
      relations: ["employee"],
    });
    if (!history) {
      throw new NotFoundException(
        `Înregistrarea din istoric cu ID-ul ${id} nu a fost găsită`,
      );
    }
    return history;
  }

  async workHistoryFindByEmployee(
    employee_id: number,
  ): Promise<EmployeeWorkLocationHistory[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employee_id} nu a fost găsit`,
      );
    }
    return await this.workLocationHistoryRepository.find({
      where: { employee_id },
      relations: ["employee"],
      order: { created_at: "DESC" },
    });
  }

  async workHistoryFindByWorkLocation(
    work_location_id: number,
  ): Promise<EmployeeWorkLocationHistory[]> {
    return await this.workLocationHistoryRepository.find({
      where: { work_location_id },
      relations: ["employee"],
      order: { created_at: "DESC" },
    });
  }

  async workHistoryUpdate(
    id: number,
    updateHistoryDto: any,
  ): Promise<EmployeeWorkLocationHistory> {
    const history = await this.workHistoryFindOne(id);
    if (
      updateHistoryDto.employee_id &&
      updateHistoryDto.employee_id !== history.employee_id
    ) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateHistoryDto.employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Angajatul cu ID-ul ${updateHistoryDto.employee_id} nu a fost găsit`,
        );
      }
    }
    await this.workLocationHistoryRepository.update(id, updateHistoryDto);
    return await this.workHistoryFindOne(id);
  }

  async workHistoryRemove(id: number): Promise<{ message: string }> {
    const history = await this.workHistoryFindOne(id);
    await this.workLocationHistoryRepository.delete(id);
    return {
      message: `Înregistrarea din istoric pentru angajatul ${history.employee.first_name} ${history.employee.last_name} a fost ștearsă cu succes`,
    };
  }

  async workHistoryStatistics(): Promise<{
    total: number;
    byEmployee: { [key: string]: number };
    byWorkLocation: { [key: string]: number };
    recentChanges: number;
  }> {
    const total = await this.workLocationHistoryRepository.count();
    const employeeStats = await this.workLocationHistoryRepository
      .createQueryBuilder("history")
      .select("history.employee_id", "employee_id")
      .addSelect("COUNT(history.id)", "count")
      .groupBy("history.employee_id")
      .getRawMany();
    const byEmployee = employeeStats.reduce(
      (acc: any, curr: any) => {
        acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );
    const locationStats = await this.workLocationHistoryRepository
      .createQueryBuilder("history")
      .select("history.work_location_id", "work_location_id")
      .addSelect("COUNT(history.id)", "count")
      .groupBy("history.work_location_id")
      .getRawMany();
    const byWorkLocation = locationStats.reduce(
      (acc: any, curr: any) => {
        acc[`Location_${curr.work_location_id}`] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const recentChanges = await this.workLocationHistoryRepository.count({
      where: { created_at: MoreThanOrEqual(lastMonth as any) } as any,
    });
    return { total, byEmployee, byWorkLocation, recentChanges };
  }

  // ==================== EMPLOYEE FILES EXTRA METHODS ====================

  async findAllFiles(
    page: number = 1,
    limit: number = 10,
    employee_id?: number,
    file_type?: string,
  ): Promise<{ files: EmployeeFiles[]; total: number; totalPages: number }> {
    const queryBuilder = this.filesRepository
      .createQueryBuilder("file")
      .leftJoinAndSelect("file.employee", "employee");

    if (employee_id) {
      queryBuilder.andWhere("file.employee_id = :employee_id", { employee_id });
    }

    if (file_type) {
      queryBuilder.andWhere("file.file_type = :file_type", { file_type });
    }

    const offset = (page - 1) * limit;
    const [files, total] = await queryBuilder
      .orderBy("file.updated_at", "DESC")
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
      .createQueryBuilder("file")
      .select("file.file_type", "file_type")
      .addSelect("COUNT(file.id)", "count")
      .groupBy("file.file_type")
      .getRawMany();

    const byFileType = fileTypeStats.reduce(
      (acc: any, curr: any) => {
        acc[curr.file_type] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const employeeStats = await this.filesRepository
      .createQueryBuilder("file")
      .select("file.employee_id", "employee_id")
      .addSelect("COUNT(file.id)", "count")
      .groupBy("file.employee_id")
      .getRawMany();

    const byEmployee = employeeStats.reduce(
      (acc: any, curr: any) => {
        acc[`Employee_${curr.employee_id}`] = parseInt(curr.count);
        return acc;
      },
      {} as Record<string, number>,
    );

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const recentUploads = await this.filesRepository.count({
      where: { updated_at: MoreThanOrEqual(lastMonth as any) } as any,
    });

    const totalEmployees = await this.employeeRepository.count();
    const averageFilesPerEmployee =
      totalEmployees > 0 ? Math.round((total / totalEmployees) * 100) / 100 : 0;

    return {
      total,
      byFileType,
      byEmployee,
      recentUploads,
      averageFilesPerEmployee,
    };
  }

  async findFilesByType(file_type: string): Promise<EmployeeFiles[]> {
    return await this.filesRepository.find({
      where: { file_type },
      relations: ["employee"],
      order: { updated_at: "DESC" },
    });
  }

  async updateFile(
    id: number,
    updateFileDto: UpdateEmployeeFileDto,
  ): Promise<EmployeeFiles> {
    const file = await this.findOneFile(id);

    if (
      updateFileDto.employee_id &&
      updateFileDto.employee_id !== file.employee_id
    ) {
      const employee = await this.employeeRepository.findOne({
        where: { id: updateFileDto.employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Angajatul cu ID-ul ${updateFileDto.employee_id} nu a fost găsit`,
        );
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
        throw new ConflictException(
          `Un fișier cu numele "${updateFileDto.file_name}" există deja pentru acest angajat`,
        );
      }
    }

    await this.filesRepository.update(id, updateFileDto);
    return await this.findOneFile(id);
  }

  async removeAllFilesByEmployee(
    employee_id: number,
  ): Promise<{ message: string; deletedCount: number }> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employee_id} nu a fost găsit`,
      );
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

  async validateFileAccess(
    file_id: number,
    employee_id?: number,
  ): Promise<boolean> {
    const file = await this.findOneFile(file_id);
    if (employee_id && file.employee_id !== employee_id) {
      return false;
    }
    return true;
  }

  // ==================== EMPLOYEES LOCATIONS METHODS ====================

  async assignEmployeeToLocation(
    assignDto: CreateEmployeeLocationDto,
  ): Promise<EmployeeLocation> {
    // Verifică dacă angajatul există
    const employee = await this.employeeRepository.findOne({
      where: { id: assignDto.employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${assignDto.employee_id} nu a fost găsit`,
      );
    }

    // Verifică dacă asocierea există deja
    const existingAssignment = await this.employeeLocationRepository.findOne({
      where: {
        employeeId: assignDto.employee_id,
        idLocation: assignDto.id_location,
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        `Angajatul este deja asignat la această locație`,
      );
    }

    const employeeLocation = this.employeeLocationRepository.create({
      employeeId: assignDto.employee_id,
      idLocation: assignDto.id_location,
    });
    return await this.employeeLocationRepository.save(employeeLocation);
  }

  async findEmployeeLocations(
    employee_id: number,
  ): Promise<EmployeeLocation[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employee_id },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID-ul ${employee_id} nu a fost găsit`,
      );
    }

    return await this.employeeLocationRepository.find({
      where: { employeeId: employee_id },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Returnează ID-urile locațiilor la care angajatul are acces (pentru verificare read_own).
   * Include work_location_default_id și toate idLocation din employees_locations.
   */
  async getLocationIdsForEmployee(employeeId: number): Promise<number[]> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      select: ["id", "work_location_default_id"],
    });
    if (!employee) return [];
    const ids: number[] = [];
    if (employee.work_location_default_id != null) {
      ids.push(employee.work_location_default_id);
    }
    const locs = await this.employeeLocationRepository.find({
      where: { employeeId },
      select: ["idLocation"],
    });
    locs.forEach((l) => {
      if (l.idLocation != null && !ids.includes(l.idLocation))
        ids.push(l.idLocation);
    });
    return ids;
  }

  async findLocationEmployees(
    id_location: number,
  ): Promise<EmployeeLocation[]> {
    return await this.employeeLocationRepository.find({
      where: { idLocation: id_location },
      relations: ["employee"],
      order: { createdAt: "DESC" },
    });
  }

  async removeEmployeeFromLocation(
    employee_id: number,
    id_location: number,
  ): Promise<{ message: string }> {
    const assignment = await this.employeeLocationRepository.findOne({
      where: {
        employeeId: employee_id,
        idLocation: id_location,
      },
      relations: ["employee"],
    });

    if (!assignment) {
      throw new NotFoundException("Asocierea angajat-locație nu a fost găsită");
    }

    await this.employeeLocationRepository.remove(assignment);
    return {
      message: `Angajatul ${assignment.employee?.first_name} ${assignment.employee?.last_name} a fost eliminat de la locația ${id_location}`,
    };
  }

  // Find files expiring on a specific date
  async findExpiringFiles(targetDate: string): Promise<EmployeeFiles[]> {
    console.log(`[EMPLOYEES SERVICE] Finding files expiring on ${targetDate}`);
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);

    const files = await this.filesRepository
      .createQueryBuilder("file")
      .where("DATE(file.expire_date) = :targetDate", { targetDate })
      .leftJoinAndSelect("file.employee", "employee")
      .getMany();

    console.log(
      `[EMPLOYEES SERVICE] Found ${files.length} files expiring on ${targetDate}`,
    );
    return files;
  }

  // Find files that have already expired
  async findExpiredFiles(): Promise<EmployeeFiles[]> {
    console.log(`[EMPLOYEES SERVICE] Finding expired files`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const files = await this.filesRepository
      .createQueryBuilder("file")
      .where("file.expire_date < :today", { today })
      .andWhere("file.expire_date IS NOT NULL")
      .leftJoinAndSelect("file.employee", "employee")
      .getMany();

    console.log(`[EMPLOYEES SERVICE] Found ${files.length} expired files`);
    return files;
  }

  /**
   * Creează un folder pentru un angajat (în DB și pe disk).
   * Dacă angajatul e asignat la o locație, folderul se creează sub companies/[Companie]/Locații/[Locație]/Angajați/[Nume].
   * parent_id opțional; dacă e setat, folderul este subfolder.
   */
  async createFolder(
    employeeId: number,
    body: { description: string; parent_id?: number },
  ): Promise<EmployeeFolder> {
    const description = (body?.description || "").trim();
    if (!description) {
      throw new BadRequestException("description este obligatoriu");
    }
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(
        `Angajatul cu ID ${employeeId} nu a fost găsit`,
      );
    }
    const parentId = body?.parent_id ?? null;
    const existing = await this.folderRepository.findOne({
      where: {
        employee_id: employeeId,
        description,
        parent_id: parentId != null ? parentId : IsNull(),
      },
    });
    if (existing) {
      throw new BadRequestException("Există deja un folder cu acest nume.");
    }
    const employeeSlug = this.simplifyEmployeeName(
      employee.first_name,
      employee.last_name,
    );
    const defaultBasePath = `/files/employees/${employeeSlug}`;

    // Verifică dacă angajatul e asignat la o locație (employee_locations sau work_location_default_id) – atunci folosim calea companies/.../Locații/.../Angajați
    let locationPath: string | null = null;
    let locationId: number | null = null;
    try {
      const employeeLocations = await this.employeeLocationRepository.find({
        where: { employeeId: employeeId },
      });
      if (employeeLocations?.length > 0) {
        locationId = employeeLocations[0].idLocation;
      } else if (employee.work_location_default_id != null) {
        locationId = employee.work_location_default_id;
        console.log(
          `[createFolder] Folosesc work_location_default_id: ${locationId} (angajat ${employeeId})`,
        );
      }
      if (locationId != null) {
        try {
          // Apel direct către serviciul locations (cu headere interne), nu prin API Gateway, ca să nu primim 401
          const locationsUrl =
            process.env.LOCATIONS_HTTP_URL || "http://localhost:3004";
          const companiesUrl =
            process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
          const serviceSecret =
            process.env.SERVICE_SECRET || '';
          const locResponse = await axios.get(
            `${locationsUrl}/locations/${locationId}`,
            {
              headers: {
                "x-internal-service": "employees",
                "x-service-secret": serviceSecret,
                "Content-Type": "application/json",
              },
              timeout: 3000,
            },
          );
          const location = locResponse.data;
          if (location) {
            let companyName = "UnknownCompany";
            try {
              const companyResponse = await axios.get(
                `${companiesUrl}/companies/${location.company_id}`,
                {
                  headers: {
                    "x-internal-service": "employees",
                    "x-service-secret": serviceSecret,
                    "Content-Type": "application/json",
                  },
                  timeout: 3000,
                },
              );
              if (companyResponse.data?.company_name)
                companyName = companyResponse.data.company_name;
            } catch (err: any) {
              console.warn(
                `[createFolder] Nu s-a putut obține compania pentru locația ${locationId}:`,
                err?.message,
              );
            }
            locationPath = `/files/companies/${companyName}/Locații/${location.location_name}`;
            console.log(`[createFolder] Cale locație: ${locationPath}`);
          } else {
            console.warn(
              `[createFolder] Răspuns gol de la locations/${locationId}`,
            );
          }
        } catch (err: any) {
          console.warn(
            `[createFolder] Eroare la obținerea locației ${locationId}, folosesc calea default:`,
            err?.message,
          );
        }
      } else {
        console.log(
          `[createFolder] Angajat ${employeeId} fără locație (employee_locations goale, work_location_default_id: ${employee.work_location_default_id ?? "null"}), folosesc files/employees/`,
        );
      }
    } catch (err: any) {
      console.warn(
        `[createFolder] Eroare la verificarea locației:`,
        err?.message,
      );
    }

    const basePath = locationPath
      ? `${locationPath}/Angajați/${employeeSlug}`
      : defaultBasePath;
    let folderPath: string;
    if (parentId) {
      const parent = await this.folderRepository.findOne({
        where: { id: parentId, employee_id: employeeId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Folderul părinte cu ID ${parentId} nu a fost găsit`,
        );
      }
      const parentPath = (parent.folder_path || "").replace(/\/+$/, "");
      folderPath = parentPath
        ? `${parentPath}/${description}/`
        : `${basePath}/${description}/`;
    } else {
      folderPath = `${basePath}/${description}/`;
    }

    const folder = this.folderRepository.create({
      employee_id: employeeId,
      description,
      folder_path: folderPath,
      parent_id: parentId,
    });
    const saved = await this.folderRepository.save(folder);

    // Creare pe disk doar pentru căi sub files/companies (locații); sub files/employees nu mai creăm nimic
    if (folderPath.startsWith("/files/companies/")) {
      const repoRoot = this.getFilesRepoRoot();
      const folderPathRel = folderPath.startsWith("/")
        ? folderPath.slice(1)
        : folderPath;
      const absoluteDir = path.join(
        repoRoot,
        folderPathRel.split("/").join(path.sep),
      );
      this.assertPathWithinBase(absoluteDir, repoRoot);
      if (!fs.existsSync(absoluteDir)) {
        fs.mkdirSync(absoluteDir, { recursive: true });
        console.log(`[createFolder] Creat director pe disk: ${absoluteDir}`);
      }
    }
    console.log(
      `[createFolder] Folder creat: ${description} (ID: ${saved.id}, parent_id: ${parentId ?? "null"}, path: ${folderPath})`,
    );
    return saved;
  }

  /**
   * Actualizează numele unui folder (în DB și pe disk).
   */
  async updateFolder(
    employeeId: number,
    folderId: number,
    body: { description: string },
  ): Promise<EmployeeFolder> {
    const newDescription = (body?.description || "").trim();
    if (!newDescription) {
      throw new BadRequestException("description este obligatoriu");
    }
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, employee_id: employeeId },
    });
    if (!folder) {
      throw new NotFoundException(
        `Folderul cu ID ${folderId} nu a fost găsit pentru angajatul ${employeeId}`,
      );
    }
    if (folder.description === newDescription) {
      return folder;
    }
    const parentId = folder.parent_id ?? null;
    const existing = await this.folderRepository.findOne({
      where: {
        employee_id: employeeId,
        description: newDescription,
        parent_id: parentId != null ? parentId : IsNull(),
      },
    });
    if (existing && existing.id !== folderId) {
      throw new BadRequestException("Există deja un folder cu acest nume.");
    }
    const oldDescription = folder.description;
    const oldFolderPath = folder.folder_path || "";
    folder.description = newDescription;
    if (folder.folder_path) {
      folder.folder_path = folder.folder_path.replace(
        new RegExp(
          `/${oldDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`,
        ),
        `/${newDescription}/`,
      );
    }
    const saved = await this.folderRepository.save(folder);
    if ((saved.folder_path || "").startsWith("/files/companies/")) {
      const repoRoot = this.getFilesRepoRoot();
      const oldPathRel = oldFolderPath.replace(/^\//, "").replace(/\/+$/, "");
      const newPathRel = (saved.folder_path || "")
        .replace(/^\//, "")
        .replace(/\/+$/, "");
      const oldDir = path.join(repoRoot, oldPathRel.split("/").join(path.sep));
      const newDir = path.join(repoRoot, newPathRel.split("/").join(path.sep));
      this.assertPathWithinBase(oldDir, repoRoot);
      this.assertPathWithinBase(newDir, repoRoot);
      if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
        try {
          fs.renameSync(oldDir, newDir);
          console.log(
            `[updateFolder] Redenumit director pe disk: ${oldDir} -> ${newDir}`,
          );
        } catch (err: any) {
          console.warn(
            `[updateFolder] Nu s-a putut redenumi directorul: ${err?.message || err}`,
          );
        }
      } else if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
        console.log(`[updateFolder] Creat director pe disk: ${newDir}`);
      }
    }
    console.log(
      `[updateFolder] Folder actualizat: ${oldDescription} -> ${newDescription} (ID: ${saved.id})`,
    );
    return saved;
  }

  /**
   * Șterge un folder și toți descendenții (recursiv), inclusiv pe disk.
   */
  async removeFolder(employeeId: number, folderId: number): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, employee_id: employeeId },
    });
    if (!folder) {
      throw new NotFoundException(
        `Folderul cu ID ${folderId} nu a fost găsit pentru angajatul ${employeeId}`,
      );
    }
    await this.removeFolderRecursive(employeeId, folderId);
    console.log(
      `[removeFolder] Șters folder ${folderId} (${folder.description}) și descendenții pentru angajat ${employeeId}`,
    );
  }

  private async removeFolderRecursive(
    employeeId: number,
    folderId: number,
  ): Promise<void> {
    const children = await this.folderRepository.find({
      where: { employee_id: employeeId, parent_id: folderId },
    });
    for (const child of children) {
      await this.removeFolderRecursive(employeeId, child.id);
    }
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, employee_id: employeeId },
    });
    if (folder) {
      const folderPathToDelete = folder.folder_path;
      await this.folderRepository.remove(folder);
      if ((folderPathToDelete || "").startsWith("/files/companies/")) {
        try {
          const repoRoot = this.getFilesRepoRoot();
          const pathRel = (
            folderPathToDelete.startsWith("/files")
              ? folderPathToDelete
              : `/files${folderPathToDelete}`
          ).replace(/^\//, "");
          const absolutePath = path.join(
            repoRoot,
            pathRel.split("/").join(path.sep),
          );
          this.assertPathWithinBase(absolutePath, repoRoot);
          if (fs.existsSync(absolutePath)) {
            fs.rmSync(absolutePath, { recursive: true, force: true });
            console.log(
              `[removeFolder] Șters director pe disk: ${absolutePath}`,
            );
          }
        } catch (e) {
          console.warn(
            `[removeFolder] Nu s-a putut șterge directorul pe disk: ${folderPathToDelete}`,
            e,
          );
        }
      }
    }
  }
}
