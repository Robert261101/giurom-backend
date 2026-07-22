import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository, DataSource, In, Like } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
import { WorkLocation } from "../locations/entity/work-location.entity";
import { WorkLocationTaskTemplate } from "../locations/entity/work-location-task-template.entity";
import { WorkLocationDepartments } from "../locations/entity/work-location-departments.entity";
import { WorkLocationDepartmentPositions } from "../locations/entity/work-location-department-positions.entity";
import { CreateWorkLocationDto } from "./dto/create-work-location.dto";
import { UpdateWorkLocationDto } from "./dto/update-work-location.dto";
import { CreateTaskTemplateAssignmentDto } from "./dto/create-task-template-assignment.dto";
import { UpdateTaskTemplateAssignmentDto } from "./dto/update-task-template-assignment.dto";
import {
  WorkLocationRevenue,
  RevenueStatus,
} from "./entity/work-location-revenue.entity";
import { WorkLocationRevenuePoints } from "./entity/work-location-revenue-points.entity";
import { WorkLocationManagerConfig } from "./entity/work-location-manager-config.entity";
import { WorkLocationFiles } from "./entity/work-location-files.entity";
import { WorkLocationFolder } from "./entity/work-location-folder.entity";
import { CreateWorkLocationFileDto } from "./dto/create-work-location-file.dto";

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(WorkLocation)
    private readonly workLocationRepository: Repository<WorkLocation>,
    @InjectRepository(WorkLocationTaskTemplate)
    private readonly taskTemplateRepository: Repository<WorkLocationTaskTemplate>,
    @InjectRepository(WorkLocationDepartments)
    private readonly departmentsRepository: Repository<WorkLocationDepartments>,
    @InjectRepository(WorkLocationDepartmentPositions)
    private readonly positionsRepository: Repository<WorkLocationDepartmentPositions>,
    @InjectRepository(WorkLocationRevenue)
    private readonly revenueRepository: Repository<WorkLocationRevenue>,
    @InjectRepository(WorkLocationRevenuePoints)
    private readonly revenuePointsRepository: Repository<WorkLocationRevenuePoints>,
    @InjectRepository(WorkLocationManagerConfig)
    private readonly managerConfigRepository: Repository<WorkLocationManagerConfig>,
    @InjectRepository(WorkLocationFiles)
    private readonly filesRepository: Repository<WorkLocationFiles>,
    @InjectRepository(WorkLocationFolder)
    private readonly folderRepository: Repository<WorkLocationFolder>,
    @Inject("NOTIFICATIONS_RMQ")
    private readonly notificationsClient: ClientProxy,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  private async getEmployeeLocationIdsForAccess(user?: any): Promise<number[]> {
    const employeeId = user?.id || user?.employee_id || user?.userId;
    if (!employeeId) return [];

    // 1) Încearcă employees microservice (preferred)
    try {
      const employeesUrl =
        process.env.EMPLOYEES_HTTP_URL || "http://localhost:3011";
      const response = await axios.get(
        `${employeesUrl}/employees/${employeeId}/locations`,
        {
          headers: {
            "x-internal-service": "locations",
            "x-service-secret":
              process.env.SERVICE_SECRET || '',
            "Content-Type": "application/json",
          },
          timeout: 3000,
        },
      );

      const employeeLocations = Array.isArray(response.data)
        ? response.data
        : [];
      const ids = employeeLocations
        .map(
          (el: any) =>
            el.idLocation || el.id_location || el.locationId || el.location_id,
        )
        .filter((id: any) => id != null)
        .map((id: any) => parseInt(String(id), 10))
        .filter((id: number) => Number.isFinite(id) && id > 0);

      // Include work_location_id / work_location_default_id din JWT dacă există
      const workLocationId =
        user?.work_location_id || user?.work_location_default_id;
      if (workLocationId) {
        const wl = parseInt(String(workLocationId), 10);
        if (Number.isFinite(wl) && wl > 0) ids.push(wl);
      }

      return [...new Set(ids)];
    } catch (_e: any) {
      // 2) Fallback: work_location_id din JWT
      const workLocationId =
        user?.work_location_id || user?.work_location_default_id;
      if (workLocationId) {
        const wl = parseInt(String(workLocationId), 10);
        if (Number.isFinite(wl) && wl > 0) return [wl];
      }

      // 3) Fallback: query direct în employees DB (dacă e disponibil)
      try {
        const employeesDbName =
          process.env.EMPLOYEES_DB_NAME || "restosoft_employees";
        const result = await this.dataSource.query(
          `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`,
          [employeeId],
        );
        const ids: number[] = (result || [])
          .map((row: any) => row.id_location || row.idLocation)
          .filter((id: any) => id != null)
          .map((id: any) => parseInt(String(id), 10))
          .filter((id: number) => Number.isFinite(id) && id > 0);
        return [...new Set(ids)];
      } catch (_dbErr) {
        return [];
      }
    }
  }

  async findWorkLocationsByIds(
    ids: number[],
    user?: any,
  ): Promise<WorkLocation[]> {
    const uniqueIds = Array.from(
      new Set(
        (ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    if (uniqueIds.length === 0) return [];

    const hasLocationReadPermission =
      user?.permissions?.includes("locations.read");
    if (hasLocationReadPermission) {
      return this.workLocationRepository.find({
        where: { id: In(uniqueIds) },
        order: { id: "ASC" } as any,
      });
    }

    // Fără permisiune locations.read: returnăm doar locațiile proprii
    const allowedIds = await this.getEmployeeLocationIdsForAccess(user);
    if (allowedIds.length === 0) return [];
    const intersection = uniqueIds.filter((id) => allowedIds.includes(id));
    if (intersection.length === 0) return [];

    return this.workLocationRepository.find({
      where: { id: In(intersection) },
      order: { id: "ASC" } as any,
    });
  }

  private getLocationsFilesRootDir(): string {
    return path.join(this.getRepoRoot(), "files", "locations");
  }

  /**
   * Pe server setează REPO_ROOT=/home/restosoft ca să salvezi în afara giurom-backend/giurom-frontend.
   */
  private getRepoRoot(): string {
    const fromEnv = (process.env.REPO_ROOT || process.env.IMAGES_ROOT || "").trim();
    if (fromEnv) return path.resolve(fromEnv);
    // Resolve to giurom root (one level above giurom-backend)
    // __dirname is .../giurom-backend/locations/src/locations (dev with ts-node) or .../giurom-backend/locations/dist/locations (prod)
    let repoRoot = path.resolve(__dirname, "../../../..");
    if (path.basename(repoRoot) === "giurom-backend") {
      repoRoot = path.dirname(repoRoot);
    }
    return repoRoot;
  }

  /** Rădăcina pentru files/companies (același arbore ca la furnizori/angajați). */
  private getFilesCompaniesRoot(): string {
    return path.join(this.getRepoRoot(), "files", "companies");
  }

  private async getCompanyNameForLocation(
    location: WorkLocation,
  ): Promise<string> {
    let companyName = "Unknown";
    try {
      const companiesUrl =
        process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
      const serviceSecret =
        process.env.SERVICE_SECRET || '';
      const response = await axios.get(
        `${companiesUrl}/companies/${location.company_id}`,
        {
          headers: {
            "x-internal-service": "locations",
            "x-service-secret": serviceSecret,
            "Content-Type": "application/json",
          },
          timeout: 3000,
        },
      );
      if (response.data?.company_name) {
        companyName = response.data.company_name;
      }
    } catch (error: any) {
      console.warn(
        `⚠️ Could not fetch company name for company ID ${location.company_id}:`,
        error?.message,
      );
    }
    return companyName;
  }

  /** Calea absolută pe disc: files/companies/[companyName]/Locații/[locationName]. */
  private getLocationBasePath(
    companyName: string,
    locationName: string,
  ): string {
    return path.join(
      this.getFilesCompaniesRoot(),
      companyName,
      "Locații",
      locationName,
    );
  }

  // Create the required folder structure for a new location
  private async createLocationFolderStructure(
    location: WorkLocation,
  ): Promise<void> {
    try {
      // Get company information using HTTP call to company service
      let companyName = "Unknown";
      try {
        const companiesUrl =
          process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
        const serviceSecret =
          process.env.SERVICE_SECRET || '';

        const response = await axios.get(
          `${companiesUrl}/companies/${location.company_id}`,
          {
            headers: {
              "x-internal-service": "locations",
              "x-service-secret": serviceSecret,
              "Content-Type": "application/json",
            },
            timeout: 3000,
          },
        );

        if (response.data && response.data.company_name) {
          companyName = response.data.company_name;
        }
      } catch (error) {
        console.warn(
          `⚠️ Could not fetch company name for company ID ${location.company_id}:`,
          error.message,
        );
        // Continue with default name
      }

      // Get the company folder path using the company name
      const companyFilesRootDir = this.getRepoRoot();
      const companyFilesDir = path.join(
        companyFilesRootDir,
        "files",
        "companies",
      );
      // Use company name instead of company ID
      const companyDir = path.join(companyFilesDir, companyName);

      // Create company folder if it doesn't exist
      if (!fs.existsSync(companyDir)) {
        fs.mkdirSync(companyDir, { recursive: true });
        console.log(`📁 Created company directory: ${companyDir}`);
      }

      // Create "Locații" folder if it doesn't exist
      const locationsDir = path.join(companyDir, "Locații");
      if (!fs.existsSync(locationsDir)) {
        fs.mkdirSync(locationsDir, { recursive: true });
        console.log(`📁 Created locations directory: ${locationsDir}`);
      }

      // Create location folder: companies/[Company]/Locații/[LocationName]
      const locationDir = path.join(locationsDir, location.location_name);
      if (!fs.existsSync(locationDir)) {
        fs.mkdirSync(locationDir, { recursive: true });
        console.log(`📁 Created location directory: ${locationDir}`);
      }

      // Obligatoriu per locație: Angajați și Furnizori (create pe server la fiecare locație nouă)
      const mandatoryLocationSubfolders = ["Angajați", "Furnizori"];
      for (const subfolder of mandatoryLocationSubfolders) {
        const subfolderPath = path.join(locationDir, subfolder);
        if (!fs.existsSync(subfolderPath)) {
          fs.mkdirSync(subfolderPath, { recursive: true });
          console.log(
            `📁 Created mandatory location subfolder: ${subfolderPath}`,
          );
        }
      }

      console.log(
        `✅ Folder structure created successfully for location ${location.id}`,
      );
    } catch (error) {
      console.error(
        `❌ Error creating folder structure for location ${location.id}:`,
        error,
      );
    }
  }

  private async sendLocationNotification(
    type: string,
    title: string,
    description: string,
    locationId: number,
    metadata?: any,
    target_url?: string,
  ): Promise<void> {
    try {
      console.log(
        `🔍 [LOCATIONS SERVICE] Sending notification - Type: ${type}, Location ID: ${locationId}`,
      );
      await firstValueFrom(
        this.notificationsClient.emit(
          { cmd: "locations.notification" },
          {
            type,
            title,
            description,
            entity_id: locationId,
            entity_type: "location",
            metadata,
            priority: "medium",
            target_url,
          },
        ),
      );
      console.log(
        `✅ [LOCATIONS SERVICE] Notification sent successfully - Type: ${type}, Location ID: ${locationId}`,
      );
    } catch (error) {
      console.error("Failed to send location notification:", error);
    }
  }

  /** Notificări încasări pentru admin: trimisă, aprobată, respinsă (entity_type: revenue). */
  private async sendRevenueNotification(
    type: string,
    title: string,
    description: string,
    revenueId: number,
    workLocationId: number,
    metadata?: any,
    target_url?: string,
  ): Promise<void> {
    try {
      const url = target_url ?? `/locatii/${workLocationId}/incasari`;
      this.notificationsClient.emit(
        { cmd: "locations.notification" },
        {
          type,
          title,
          description,
          entity_id: revenueId,
          entity_type: "revenue",
          metadata: { work_location_id: workLocationId, ...metadata },
          priority: "medium",
          target_url: url,
        },
      );
    } catch (error) {
      console.error("Failed to send revenue notification:", error);
    }
  }

  async createWorkLocation(dto: CreateWorkLocationDto): Promise<WorkLocation> {
    const entity: WorkLocation = this.workLocationRepository.create(
      dto as unknown as Partial<WorkLocation>,
    ) as WorkLocation;
    const saved: WorkLocation = await this.workLocationRepository.save(
      entity as WorkLocation,
    );

    // Create the required folder structure for the new location
    await this.createLocationFolderStructure(saved);

    // Creează automat departamentul "Manager" pentru locația nouă
    try {
      await this.createDepartment({
        work_location_id: saved.id,
        name: "Manager",
        code: "MGR",
        description: "Departament manager – creat automat la crearea locației",
      });
    } catch (err: any) {
      console.warn(`[createWorkLocation] Nu s-a putut crea departamentul Manager pentru locația ${saved.id}:`, err?.message || err);
    }

    // Send notification for new location
    await this.sendLocationNotification(
      "location_created",
      "Locatie noua adaugata",
      `A fost adaugata o noua locatie: ${saved.location_name}`,
      saved.id,
      { locationName: saved.location_name },
      `/locatii/${saved.id}`,
    );

    return saved;
  }

  async findAllWorkLocations(
    page = 1,
    limit = 10,
    companyId?: number,
    city?: string,
    search?: string,
    user?: any,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    const hasLocationReadPermission =
      user?.permissions?.includes("locations.read");

    // Dacă are permisiunea locations.read, returnează toate locațiile
    if (hasLocationReadPermission) {
      const qb = this.workLocationRepository
        .createQueryBuilder("location")
        .leftJoinAndSelect("location.task_templates", "task_templates");
      if (companyId)
        qb.where("location.company_id = :companyId", { companyId });
      if (city) qb.andWhere("location.city = :city", { city });
      if (search)
        qb.andWhere(
          "location.location_name LIKE :search OR location.address LIKE :search",
          { search: `%${search}%` },
        );
      const offset = (page - 1) * limit;
      const [locations, total] = await qb
        .orderBy("location.created_at", "DESC")
        .skip(offset)
        .take(limit)
        .getManyAndCount();
      return { locations, total, totalPages: Math.ceil(total / limit) };
    }

    // Dacă nu are permisiunea, returnează doar locațiile din employees_locations
    const employeeId = user?.id || user?.employee_id || user?.userId;
    if (!employeeId) {
      return { locations: [], total: 0, totalPages: 0 };
    }

    // Log pentru debugging - verifică ce câmpuri sunt disponibile în JWT
    console.log(
      `🔍 [findAllWorkLocations] Employee ID: ${employeeId}, JWT fields:`,
      {
        work_location_id: user?.work_location_id,
        work_location_default_id: user?.work_location_default_id,
        hasPermissions: !!user?.permissions,
      },
    );

    // Obține locațiile angajatului din employees_locations
    let employeeLocationIds: number[] = [];
    try {
      const employeesUrl =
        process.env.EMPLOYEES_HTTP_URL || "http://localhost:3011";
      const response = await axios.get(
        `${employeesUrl}/employees/${employeeId}/locations`,
        {
          headers: {
            "x-internal-service": "locations",
            "x-service-secret":
              process.env.SERVICE_SECRET || '',
            "Content-Type": "application/json",
          },
          timeout: 3000,
        },
      );

      const employeeLocations = Array.isArray(response.data)
        ? response.data
        : [];
      employeeLocationIds = employeeLocations
        .map((el: any) => {
          return (
            el.idLocation || el.id_location || el.locationId || el.location_id
          );
        })
        .filter((id: any) => id != null)
        .map((id: any) => parseInt(id, 10))
        .filter((id: number) => !isNaN(id));

      // Adaugă și work_location_id sau work_location_default_id dacă există
      const workLocationId =
        user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds.push(workLocId);
        }
      }

      // Elimină duplicatele
      employeeLocationIds = [...new Set(employeeLocationIds)];
    } catch (error: any) {
      // Nu mai logăm eroarea - avem fallback la query direct la DB
      // Dacă microserviciul employees nu este accesibil, încercăm să folosim work_location_id sau work_location_default_id din JWT
      if (error.code !== "ECONNREFUSED" && error.code !== "ETIMEDOUT") {
        // Logăm doar erorile care nu sunt de conexiune
        console.error(`Failed to fetch employee locations: ${error.message}`);
      }
      const workLocationId =
        user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds = [workLocId];
          console.warn(
            `⚠️ Employees microservice not accessible, using work_location_id from JWT: ${workLocId}`,
          );
        }
      }

      if (employeeLocationIds.length === 0) {
        // Dacă nici work_location_id nu există, încercăm să interogăm direct baza de date employees_locations
        // NOTĂ: Aceasta presupune că ambele microservicii folosesc aceeași bază de date sau că locations poate accesa employees DB
        try {
          // Încearcă să interogeze tabelul employees_locations din baza de date employees
          // Folosim numele complet al bazei de date în query
          const employeesDbName =
            process.env.EMPLOYEES_DB_NAME || "restosoft_employees";
          const result = await this.dataSource.query(
            `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`,
            [employeeId],
          );
          if (result && result.length > 0) {
            employeeLocationIds = result
              .map((row: any) => row.id_location || row.idLocation)
              .filter((id: any) => id != null)
              .map((id: any) => parseInt(id, 10))
              .filter((id: number) => !isNaN(id));
            console.log(
              `✅ Found ${employeeLocationIds.length} locations in employees_locations via direct DB query (employee ${employeeId}): [${employeeLocationIds.join(", ")}]`,
            );
          } else {
            console.warn(
              `⚠️ No locations found in employees_locations for employee ${employeeId}`,
            );
            return { locations: [], total: 0, totalPages: 0 };
          }
        } catch (dbError: any) {
          // Dacă tabelul nu există în această bază de date, înseamnă că este în altă bază de date
          // SOLUȚIE TEMPORARĂ: Permitem accesul la toate locațiile pentru utilizatorii autentificați
          // când microserviciul employees nu este accesibil
          // NOTĂ: Aceasta este o soluție temporară - în producție, microserviciul employees trebuie să fie accesibil
          console.error(
            `❌ Failed to query employees_locations directly: ${dbError.message}`,
          );
          console.warn(
            `⚠️ Cannot access employees_locations - allowing access to all locations for authenticated user (temporary solution)`,
          );

          // Returnăm toate locațiile (fără filtrare) când microserviciul employees nu este accesibil
          // Aceasta este o soluție temporară până când microserviciul employees devine accesibil
          const qb = this.workLocationRepository
            .createQueryBuilder("location")
            .leftJoinAndSelect("location.task_templates", "task_templates");
          if (companyId)
            qb.where("location.company_id = :companyId", { companyId });
          if (city) qb.andWhere("location.city = :city", { city });
          if (search)
            qb.andWhere(
              "location.location_name LIKE :search OR location.address LIKE :search",
              { search: `%${search}%` },
            );
          const offset = (page - 1) * limit;
          const [locations, total] = await qb
            .orderBy("location.created_at", "DESC")
            .skip(offset)
            .take(limit)
            .getManyAndCount();
          return { locations, total, totalPages: Math.ceil(total / limit) };
        }
      }
    }

    if (employeeLocationIds.length === 0) {
      return { locations: [], total: 0, totalPages: 0 };
    }

    // Filtrează locațiile după ID-urile din employees_locations
    const qb = this.workLocationRepository
      .createQueryBuilder("location")
      .leftJoinAndSelect("location.task_templates", "task_templates")
      .where("location.id IN (:...locationIds)", {
        locationIds: employeeLocationIds,
      });

    if (companyId)
      qb.andWhere("location.company_id = :companyId", { companyId });
    if (city) qb.andWhere("location.city = :city", { city });
    if (search)
      qb.andWhere(
        "location.location_name LIKE :search OR location.address LIKE :search",
        { search: `%${search}%` },
      );

    const offset = (page - 1) * limit;
    const [locations, total] = await qb
      .orderBy("location.created_at", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { locations, total, totalPages: Math.ceil(total / limit) };
  }

  // Obține companiile asociate cu locațiile angajatului
  async getEmployeeCompanies(
    user?: any,
  ): Promise<Array<{ id: number; company_name: string }>> {
    const employeeId = user?.id || user?.employee_id || user?.userId;
    if (!employeeId) {
      return [];
    }

    // Obține locațiile angajatului
    let employeeLocationIds: number[] = [];
    try {
      const employeesUrl =
        process.env.EMPLOYEES_HTTP_URL || "http://localhost:3011";
      const response = await axios.get(
        `${employeesUrl}/employees/${employeeId}/locations`,
        {
          headers: {
            "x-internal-service": "locations",
            "x-service-secret":
              process.env.SERVICE_SECRET || '',
            "Content-Type": "application/json",
          },
          timeout: 3000,
        },
      );

      const employeeLocations = Array.isArray(response.data)
        ? response.data
        : [];
      employeeLocationIds = employeeLocations
        .map((el: any) => {
          return (
            el.idLocation || el.id_location || el.locationId || el.location_id
          );
        })
        .filter((id: any) => id != null)
        .map((id: any) => parseInt(id, 10))
        .filter((id: number) => !isNaN(id));

      const workLocationId =
        user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds.push(workLocId);
        }
      }

      employeeLocationIds = [...new Set(employeeLocationIds)];
    } catch (error: any) {
      // Fallback la query direct la DB
      const workLocationId =
        user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        employeeLocationIds = [workLocationId];
      } else {
        try {
          const employeesDbName =
            process.env.EMPLOYEES_DB_NAME || "restosoft_employees";
          const result = await this.dataSource.query(
            `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`,
            [employeeId],
          );
          if (result && result.length > 0) {
            employeeLocationIds = result
              .map((row: any) => row.id_location || row.idLocation)
              .filter((id: any) => id != null)
              .map((id: any) => parseInt(id, 10))
              .filter((id: number) => !isNaN(id));
          }
        } catch (dbError: any) {
          // Dacă nu putem obține locațiile, returnăm lista goală
          return [];
        }
      }
    }

    if (employeeLocationIds.length === 0) {
      return [];
    }

    // Obține company_id-urile din locații
    const locations = await this.workLocationRepository.find({
      where: { id: In(employeeLocationIds) },
      select: ["id", "company_id"],
    });

    const companyIds = [
      ...new Set(
        locations.map((loc) => loc.company_id).filter((id) => id != null),
      ),
    ];

    if (companyIds.length === 0) {
      return [];
    }

    // Obține numele companiilor din companies microservice folosind un singur request batch
    const companiesUrl =
      process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
    const serviceSecret =
      process.env.SERVICE_SECRET || '';

    try {
      const requestHeaders = {
        "x-internal-service": "locations",
        "x-service-secret": serviceSecret,
        "Content-Type": "application/json",
      };

      const idsParam = companyIds.join(",");
      const response = await axios.get(`${companiesUrl}/companies/batch`, {
        headers: requestHeaders,
        params: { ids: idsParam },
        timeout: 3000,
      });

      const companies = Array.isArray(response.data) ? response.data : [];
      // Ne asigurăm că returnăm obiecte cu { id, company_name }
      return companies
        .filter(
          (c: any) =>
            c && typeof c.id === "number" && typeof c.company_name === "string",
        )
        .map((c: any) => ({
          id: c.id,
          company_name: c.company_name,
        }));
    } catch (error: any) {
      console.warn(
        `⚠️ [LocationsService] Nu am putut obține numele companiilor pentru IDs ${companyIds.join(
          ", ",
        )} de la ${companiesUrl}/companies/batch: ${error.message}`,
      );
      // Dacă batch-ul eșuează, întoarcem array gol și folosim IDs în frontend
      return [];
    }
  }

  async findWorkLocationById(
    id: number,
    user?: any,
  ): Promise<WorkLocation & { company_name?: string }> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
      relations: ["task_templates"],
    });
    if (!workLocation)
      throw new NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);

    // Încearcă să obții numele companiei pentru a-l include în răspuns
    let companyName: string | undefined;
    if (workLocation.company_id) {
      try {
        const companiesUrl =
          process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
        const response = await axios.get(
          `${companiesUrl}/companies/${workLocation.company_id}`,
          {
            headers: {
              "x-internal-service": "locations",
              "x-service-secret":
                process.env.SERVICE_SECRET || '',
            },
            timeout: 2000,
          },
        );
        companyName = response.data?.company_name || response.data?.name;
      } catch {
        // Ignoră eroarea - numele companiei e opțional
      }
    }

    // Adaugă company_name la răspuns
    const locationWithCompany = {
      ...workLocation,
      company_name: companyName,
    } as WorkLocation & { company_name?: string };

    // Dacă utilizatorul nu are permisiunea locations.read, verifică dacă locația este în lista sa
    const hasLocationReadPermission =
      user?.permissions?.includes("locations.read");
    if (!hasLocationReadPermission && user) {
      const perms = (user.permissions as string[]) || [];
      const hasAnyReadOwn = perms.some(
        (p) =>
          p === "read_own_locations" ||
          p === "assignment.read_own" ||
          p === "execution.read_own",
      );
      if (hasAnyReadOwn) {
        return locationWithCompany;
      }

      const employeeId = user.id || user.employee_id || user.userId || user.sub;
      const userWorkLocationId = user.work_location_id;

      // Verificare 1: Dacă work_location_id se potrivește
      if (userWorkLocationId && userWorkLocationId === id) {
        return locationWithCompany;
      }

      // Verificare 2: Verifică în employees_locations
      if (employeeId) {
        try {
          const employeesUrl =
            process.env.EMPLOYEES_HTTP_URL || "http://localhost:3011";
          const response = await axios.get(
            `${employeesUrl}/employees/${employeeId}/locations`,
            {
              headers: {
                "x-internal-service": "locations",
                "x-service-secret":
                  process.env.SERVICE_SECRET || '',
                "Content-Type": "application/json",
              },
              timeout: 3000,
            },
          );

          const employeeLocations = Array.isArray(response.data)
            ? response.data
            : [];
          const hasAccess = employeeLocations.some((el: any) => {
            const elLocationId =
              el.idLocation ||
              el.id_location ||
              el.locationId ||
              el.location_id;
            return elLocationId === id || String(elLocationId) === String(id);
          });

          if (hasAccess) {
            return locationWithCompany;
          }
        } catch (error: any) {
          // Dacă microserviciul nu este accesibil, încercăm query direct la baza de date
          if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
            try {
              // Verifică work_location_id sau work_location_default_id din JWT
              const workLocationId =
                user.work_location_id || user.work_location_default_id;
              if (workLocationId && workLocationId === id) {
                return locationWithCompany;
              }

              // Încearcă query direct la baza de date employees
              const employeesDbName =
                process.env.EMPLOYEES_DB_NAME || "restosoft_employees";
              const dbResult = await this.dataSource.query(
                `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`,
                [employeeId, id],
              );

              if (dbResult && dbResult.length > 0) {
                console.log(
                  `✅ Found location ${id} in employees_locations via direct DB query for employee ${employeeId}`,
                );
                return locationWithCompany;
              }

              // Dacă nu găsește, aruncă eroare de permisiuni
              throw new ForbiddenException("Nu ai acces la această locație");
            } catch (dbError: any) {
              console.error(
                `❌ Failed to query employees_locations directly: ${dbError.message}`,
              );
              // Dacă query-ul direct eșuează, verifică doar work_location_id
              const workLocationId =
                user.work_location_id || user.work_location_default_id;
              if (workLocationId && workLocationId === id) {
                return locationWithCompany;
              }
              throw new ForbiddenException("Nu ai acces la această locație");
            }
          }
        }
      }

      // Dacă nu are acces, aruncă eroare
      throw new ForbiddenException("Nu ai acces la această locație");
    }

    return locationWithCompany;
  }

  async findWorkLocationsByCompany(companyId: number): Promise<WorkLocation[]> {
    return await this.workLocationRepository.find({
      where: { company_id: companyId },
      relations: ["task_templates"],
      order: { id: "DESC" },
    });
  }

  /** Un singur request: locații + foldere + fișiere pentru o firmă (optimizare pentru tab Documente). */
  async findWorkLocationsByCompanyWithDocuments(companyId: number): Promise<{
    locations: WorkLocation[];
    foldersByLocationId: Record<number, WorkLocationFolder[]>;
    filesByLocationId: Record<number, WorkLocationFiles[]>;
  }> {
    const locations = await this.findWorkLocationsByCompany(companyId);
    const locationIds = locations.map((l) => l.id);
    if (locationIds.length === 0) {
      return { locations, foldersByLocationId: {}, filesByLocationId: {} };
    }
    const [folders, files] = await Promise.all([
      this.folderRepository.find({
        where: { work_location_id: In(locationIds) },
        order: { description: "ASC" },
      }),
      this.filesRepository.find({
        where: { work_location_id: In(locationIds) },
        order: { updated_at: "DESC" },
      }),
    ]);
    const foldersByLocationId: Record<number, WorkLocationFolder[]> = {};
    const filesByLocationId: Record<number, WorkLocationFiles[]> = {};
    for (const id of locationIds) {
      foldersByLocationId[id] = [];
      filesByLocationId[id] = [];
    }
    for (const f of folders) {
      foldersByLocationId[f.work_location_id].push(f);
    }
    for (const f of files) {
      filesByLocationId[f.work_location_id].push(f);
    }
    return { locations, foldersByLocationId, filesByLocationId };
  }

  async updateWorkLocation(
    id: number,
    dto: UpdateWorkLocationDto,
  ): Promise<WorkLocation> {
    const workLocation = await this.findWorkLocationById(id);
    const oldName = workLocation.location_name;
    Object.assign(workLocation, dto);
    const updatedLocation = await this.workLocationRepository.save(
      workLocation as WorkLocation,
    );

    // Send notification for updated location
    await this.sendLocationNotification(
      "location_updated",
      "Locatie modificata",
      `Locatia ${oldName} a fost modificata`,
      updatedLocation.id,
      {
        oldName,
        newName: updatedLocation.location_name,
        updatedFields: Object.keys(dto),
      },
      `/locatii/${updatedLocation.id}`,
    );

    return updatedLocation;
  }

  async removeWorkLocation(id: number): Promise<void> {
    const workLocation = await this.findWorkLocationById(id);
    const locationName = workLocation.location_name;

    // Get related departments count
    const departmentsCount = await this.departmentsRepository.count({
      where: { work_location_id: id } as any,
    });

    // Get related revenue points count
    const revenuePointsCount = await this.revenuePointsRepository.count({
      where: { work_location_id: id } as any,
    });

    // Send notification for deleted location
    await this.sendLocationNotification(
      "location_deleted",
      "Locatie stearsa",
      `Locatia ${locationName} a fost stearsa (Departamente: ${departmentsCount}, Puncte: ${revenuePointsCount}, Angajati afectati)`,
      id,
      {
        locationName,
        departmentsCount,
        revenuePointsCount,
      },
      `/locatii/${id}`, // Add target_url
    );

    await this.workLocationRepository.remove(workLocation as WorkLocation);
  }

  async createTaskTemplateAssignment(
    dto: CreateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    await this.findWorkLocationById(dto.location_id);
    const existing = await this.taskTemplateRepository.findOne({
      where: {
        location_id: dto.location_id,
        template_id: dto.template_id || 1,
        active: true,
      },
    });
    if (existing)
      throw new BadRequestException(
        `Template-ul ${dto.template_id || 1} este deja atribuit activ la această locație`,
      );
    const assignment: WorkLocationTaskTemplate =
      this.taskTemplateRepository.create({
        ...dto,
        assigned_at: new Date(),
      }) as WorkLocationTaskTemplate;
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async findAllTaskTemplateAssignments(
    page = 1,
    limit = 10,
    locationId?: number,
    templateId?: number,
    active?: boolean,
  ): Promise<{
    assignments: WorkLocationTaskTemplate[];
    total: number;
    totalPages: number;
  }> {
    const qb = this.taskTemplateRepository
      .createQueryBuilder("assignment")
      .leftJoinAndSelect("assignment.work_location", "work_location");
    if (locationId)
      qb.where("assignment.location_id = :locationId", { locationId });
    if (templateId)
      qb.andWhere("assignment.template_id = :templateId", { templateId });
    if (active !== undefined)
      qb.andWhere("assignment.active = :active", { active });
    const offset = (page - 1) * limit;
    const [assignments, total] = await qb
      .orderBy("assignment.assigned_at", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { assignments, total, totalPages: Math.ceil(total / limit) };
  }

  async findTaskTemplateAssignmentById(
    id: number,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.taskTemplateRepository.findOne({
      where: { id },
      relations: ["work_location"],
    });
    if (!assignment)
      throw new NotFoundException(`Atribuirea cu ID-ul ${id} nu a fost găsită`);
    return assignment;
  }

  async findTaskTemplateAssignmentsByLocation(
    locationId: number,
  ): Promise<WorkLocationTaskTemplate[]> {
    await this.findWorkLocationById(locationId);
    return await this.taskTemplateRepository.find({
      where: { location_id: locationId },
      relations: ["work_location"],
      order: { assigned_at: "DESC" },
    });
  }

  // --- Departments ---
  /** Listă departamente: optional limit și ids (comma-separated). Folosit de frontend pentru rapoarte Sarcini. */
  async findWorkLocationDepartmentsList(
    limit = 1000,
    ids?: number[],
  ): Promise<WorkLocationDepartments[]> {
    const opts: any = { order: { name: "ASC" } as any };
    if (ids?.length) {
      opts.where = { id: In(ids) };
    }
    opts.take = Math.min(limit, 5000);
    return this.departmentsRepository.find(opts);
  }

  /** Un singur departament după id. Folosit de veziv-tasks. */
  async findWorkLocationDepartmentById(
    id: number,
  ): Promise<WorkLocationDepartments | null> {
    return this.departmentsRepository.findOne({ where: { id } as any });
  }

  async findDepartmentsByLocation(
    locationId: number,
  ): Promise<WorkLocationDepartments[]> {
    // Return departments directly; do not enforce location existence to avoid 404s when data is partially seeded
    return this.departmentsRepository.find({
      where: { work_location_id: locationId } as any,
      order: { name: "ASC" } as any,
    });
  }

  async createDepartment(dto: {
    work_location_id: number;
    name: string;
    code: string;
    description?: string | null;
  }) {
    const row = this.departmentsRepository.create({
      work_location_id: dto.work_location_id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
    } as Partial<WorkLocationDepartments> as WorkLocationDepartments);
    return this.departmentsRepository.save(row);
  }

  async findPositionsByDepartment(
    departmentId: number,
  ): Promise<WorkLocationDepartmentPositions[]> {
    return this.positionsRepository.find({
      where: { department_id: departmentId } as any,
      order: { name: "ASC" } as any,
    });
  }

  async createDepartmentPosition(dto: {
    department_id: number;
    name: string;
    code: string;
    description?: string | null;
  }) {
    const row = this.positionsRepository.create({
      department_id: dto.department_id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
    } as Partial<WorkLocationDepartmentPositions> as WorkLocationDepartmentPositions);
    return this.positionsRepository.save(row);
  }

  async updateTaskTemplateAssignment(
    id: number,
    dto: UpdateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    Object.assign(assignment, dto);
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async removeTaskTemplateAssignment(id: number): Promise<void> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    await this.taskTemplateRepository.remove(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async deactivateTemplateAssignments(templateId: number): Promise<void> {
    await this.taskTemplateRepository.update(
      { template_id: templateId },
      { active: false },
    );
  }

  async toggleAssignmentStatus(
    id: number,
    active: boolean,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    assignment.active = active;
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async getLocationStatistics(): Promise<{
    total_locations: number;
    locations_by_company: {
      company_id: number;
      company_name: string;
      count: number;
    }[];
    total_assignments: number;
    active_assignments: number;
  }> {
    const total_locations = await this.workLocationRepository.count();
    const total_assignments = await this.taskTemplateRepository.count();
    const active_assignments = await this.taskTemplateRepository.count({
      where: { active: true },
    });
    return {
      total_locations,
      locations_by_company: [],
      total_assignments,
      active_assignments,
    };
  }

  // --- Revenue points management ---
  async setRevenueIntervals(
    workLocationId: number,
    intervals: Array<{ min: number; max?: number | null; points: number }>,
  ) {
    const wl = await this.findWorkLocationById(workLocationId);
    await this.revenuePointsRepository.delete({
      work_location_id: workLocationId,
    } as any);
    const rows: DeepPartial<WorkLocationRevenuePoints>[] = intervals.map(
      (i) => ({
        work_location_id: workLocationId,
        min_revenue: i.min as any,
        max_revenue: (i.max ?? null) as any,
        points: i.points as any,
      }),
    );
    return this.revenuePointsRepository.save(rows);
  }

  async getRevenueIntervals(workLocationId: number) {
    await this.findWorkLocationById(workLocationId);
    return this.revenuePointsRepository.find({
      where: { work_location_id: workLocationId } as any,
      order: { min_revenue: "ASC" } as any,
    });
  }

  async setManagerPercent(
    workLocationId: number,
    managerPercent: number,
    _fallbackRevenuePerPoint?: number,
  ) {
    let cfg = await this.managerConfigRepository.findOne({
      where: { work_location_id: workLocationId } as any,
    });
    if (!cfg) {
      cfg = this.managerConfigRepository.create({
        work_location_id: workLocationId,
        manager_percent: managerPercent as any,
      } as Partial<WorkLocationManagerConfig> as WorkLocationManagerConfig);
    } else {
      cfg.manager_percent = managerPercent as any;
    }
    return this.managerConfigRepository.save(cfg);
  }

  async getManagerConfig(workLocationId: number) {
    await this.findWorkLocationById(workLocationId);
    return this.managerConfigRepository.findOne({
      where: { work_location_id: workLocationId } as any,
    });
  }

  async recordRevenue(
    workLocationId: number,
    revenueDate: string,
    onlineAmount: number,
    cashAmount: number,
    cardAmount: number,
    totalAmount: number,
    status?: RevenueStatus,
    imageUrl?: string,
    userId?: number | null,
  ) {
    // Always insert a new revenue row (allow multiple entries per day)
    await this.findWorkLocationById(workLocationId);

    // Validare STRICTĂ: employee_id este OBLIGATORIU și trebuie să fie un număr valid
    if (!userId || userId === 0 || isNaN(Number(userId))) {
      console.error("❌ [recordRevenue Service] Invalid employee_id:", userId);
      throw new Error("Employee ID is required and must be a valid number");
    }

    const employeeId = Number(userId);

    // Log pentru debugging
    console.log("🔍 [recordRevenue Service] Saving revenue with:", {
      workLocationId,
      revenueDate,
      employeeId,
      userId: employeeId,
    });

    // Extrage doar YYYY-MM-DD și salvează cu 12:00:00 pentru a evita conversia de timezone (00:00 devine ziua anterioară în UTC)
    const normalizedDate = revenueDate
      ? revenueDate.toString().trim().split(" ")[0].split("T")[0]
      : null;
    if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new Error(
        "revenue_date trebuie să fie în format YYYY-MM-DD sau YYYY-MM-DD HH:mm:ss",
      );
    }
    const revenueDateToStore = `${normalizedDate} 12:00:00`;

    const existing = await this.revenueRepository.findOne({
      where: {
        work_location_id: workLocationId,
        revenue_date: Like(`${normalizedDate}%`),
      } as any,
    });
    if (existing) {
      console.error(
        `❌ [recordRevenue Service] Duplicate revenue for date ${normalizedDate} at location ${workLocationId}`,
      );
      throw new ConflictException(
        `Există deja o încasare pentru data ${normalizedDate}`,
      );
    }

    const row = this.revenueRepository.create({
      work_location_id: workLocationId,
      revenue_date: revenueDateToStore,
      online_amount: onlineAmount as any,
      cash_amount: cashAmount as any,
      card_amount: cardAmount as any,
      total_amount: totalAmount as any,
      status: status,
      image_url: imageUrl,
      employee_id: employeeId, // OBLIGATORIU - nu poate fi null sau undefined
    } as Partial<WorkLocationRevenue> as WorkLocationRevenue);

    const saved = await this.revenueRepository.save(row);
    console.log(
      "✅ [recordRevenue Service] Revenue saved successfully with employee_id:",
      saved.employee_id,
    );

    await this.sendRevenueNotification(
      "revenue_sent",
      "Încasare trimisă",
      `A fost trimisă o încasare pentru data ${normalizedDate}, total: ${Number(saved.total_amount ?? 0).toFixed(2)} RON.`,
      saved.id,
      workLocationId,
      {
        revenue_date: normalizedDate,
        total_amount: Number(saved.total_amount ?? 0),
      },
    );

    if (status === RevenueStatus.Approved && normalizedDate) {
      await this.sendRevenueNotification(
        "revenue_approved",
        "Încasare aprobată",
        `Încasarea pentru data ${normalizedDate} a fost aprobată, total: ${Number(saved.total_amount ?? 0).toFixed(2)} RON.`,
        saved.id,
        workLocationId,
        {
          revenue_date: normalizedDate,
          total_amount: Number(saved.total_amount ?? 0),
        },
      );
    }

    // La introducerea încasării cu status approved: declanșăm bonusuri și manager_daily_payout (ca la updateRevenue)
    if (status === RevenueStatus.Approved && normalizedDate) {
      this.triggerBonusAndManagerPayoutOnApprovedRevenue(
        saved.id,
        workLocationId,
        normalizedDate,
      ).catch((err) =>
        console.error(
          `❌ [recordRevenue] triggerBonusAndManagerPayoutOnApprovedRevenue:`,
          err,
        ),
      );
    }

    return saved;
  }

  /**
   * Declanșează calculul bonusurilor angajaților și manager_daily_payout când o încasare este aprobată.
   * Trimite notificări către fiecare angajat pontat în ziua încasării cu suma câștigată.
   * Folosit atât la recordRevenue (introducere cu status approved) cât și la updateRevenue (trecere la approved).
   */
  private async triggerBonusAndManagerPayoutOnApprovedRevenue(
    revenueId: number,
    workLocationId: number,
    revenueDate: string,
  ): Promise<void> {
    console.log(
      `🔔 [BONUS TRIGGER] Încasare ${revenueId} aprobată. Calcul bonusuri și manager_daily_payout pentru data: ${revenueDate}`,
    );
    let earnings: Array<{ employeeId: number; amount: number }> = [];
    try {
      earnings = await this.calculateEmployeeBonusesForDate(
        workLocationId,
        revenueDate,
      );
    } catch (err) {
      console.error(
        `❌ [BONUS TRIGGER] Eroare calcul bonusuri pentru încasare ${revenueId}:`,
        err,
      );
    }
    if (earnings.length > 0) {
      try {
        this.notificationsClient.emit(
          { cmd: "locations.revenue_approved" },
          {
            revenueId,
            workLocationId,
            revenueDate,
            employees: earnings,
          },
        );
      } catch (notifErr) {
        console.error(
          `❌ [BONUS TRIGGER] Eroare trimitere notificări revenue_approved:`,
          notifErr,
        );
      }
    }
    // TASKS_API_BASE = gateway (ex. 3002) sau URL direct tasks (ex. 3008). Path: /tasks/cron/manager-daily-payout
    const tasksApiBase =
      process.env.TASKS_API_BASE || "http://localhost:3002";
    const tasksCronPath =
      tasksApiBase.replace(/\/$/, "") + "/tasks/cron/manager-daily-payout";
    // SERVICE_SECRET trebuie să fie identic în locations ȘI în tasks (veziv-tasks), altfel tasks răspunde 401
    const serviceSecret =
      process.env.SERVICE_SECRET || '';
    const hasCustomSecret = !!process.env.SERVICE_SECRET;
    console.log(
      `📤 [MANAGER PAYOUT TRIGGER] Apel tasks: ${tasksCronPath} (work_location_id=${workLocationId}, work_date=${revenueDate}), x-service-secret: ${hasCustomSecret ? "din env" : "implicit"}`,
    );
    axios
      .post(
        tasksCronPath,
        {
          work_location_id: workLocationId,
          work_date: revenueDate,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-internal-service": "locations",
            "x-service-secret": serviceSecret,
          },
        },
      )
      .then((res) => {
        const data = res.data ?? {};
        if (data.ok && data.created) {
          console.log(
            `✅ [MANAGER PAYOUT TRIGGER] Încasare ${revenueId} → manager_daily_payout creat locație ${workLocationId}, data ${revenueDate}: puncte=${data.total_points}, puncte_manager=${data.amount}`,
          );
        } else {
          console.log(
            `📋 [MANAGER PAYOUT TRIGGER] Încasare ${revenueId} – răspuns tasks: ok=${data.ok}, created=${data.created}, message=${data.message ?? "—"}`,
          );
        }
      })
      .catch((err) => {
        const status = err?.response?.status;
        const body = err?.response?.data;
        console.error(
          `❌ [MANAGER PAYOUT TRIGGER] Eroare apel tasks manager-daily-payout pentru încasare ${revenueId}: status=${status ?? "N/A"}, body=${JSON.stringify(body ?? {})}, message=${err?.message ?? err}`,
        );
      });
  }

  async listRevenue(
    workLocationId: number,
    opts?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.findWorkLocationById(workLocationId);
    const page = Math.max(1, Number(opts?.page || 1));
    const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
    const qb = this.revenueRepository
      .createQueryBuilder("rev")
      .where("rev.work_location_id = :workLocationId", { workLocationId })
      .orderBy("rev.revenue_date", "DESC");

    if (opts?.startDate)
      qb.andWhere("rev.revenue_date >= :startDate", {
        startDate: opts.startDate,
      });
    if (opts?.endDate)
      qb.andWhere("rev.revenue_date <= :endDate", { endDate: opts.endDate });

    const offset = (page - 1) * limit;
    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    // Obține employee_id pentru fiecare revenue cu user_id
    // Trebuie să obținem id_employee din users bazat pe user_id
    const authDbName = process.env.AUTH_DB_NAME || "restosoft_auth";
    const employeesDbName =
      process.env.EMPLOYEES_DB_NAME || "restosoft_employees";

    const revenuesWithEmployeeId = await Promise.all(
      items.map(async (rev: any) => {
        if (!rev.employee_id) {
          return {
            ...rev,
            employee_id: null,
            employee_first_name: null,
            employee_last_name: null,
          };
        }

        try {
          // Obține first_name și last_name direct din employees folosind employee_id
          const employeeResult = await this.dataSource.query(
            `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
            [rev.employee_id],
          );

          if (employeeResult && employeeResult.length > 0) {
            return {
              ...rev,
              employee_id: Number(rev.employee_id),
              employee_first_name: employeeResult[0].first_name || null,
              employee_last_name: employeeResult[0].last_name || null,
            };
          }

          return {
            ...rev,
            employee_id: Number(rev.employee_id),
            employee_first_name: null,
            employee_last_name: null,
          };
        } catch (error: any) {
          console.error(
            `❌ Error fetching employee data for employee_id ${rev.employee_id}:`,
            error.message,
          );
          return {
            ...rev,
            employee_id: Number(rev.employee_id),
            employee_first_name: null,
            employee_last_name: null,
          };
        }
      }),
    );

    return {
      revenues: revenuesWithEmployeeId,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteRevenue(revenueId: number): Promise<void> {
    const revenue = await this.revenueRepository.findOne({
      where: { id: revenueId } as any,
    });
    if (!revenue)
      throw new NotFoundException(
        `Încasarea cu ID-ul ${revenueId} nu a fost găsită`,
      );
    await this.revenueRepository.remove(revenue as WorkLocationRevenue);
  }

  async updateRevenue(
    revenueId: number,
    data: {
      revenue_date?: string;
      online_amount?: number;
      cash_amount?: number;
      card_amount?: number;
      total_amount?: number;
      status?: RevenueStatus;
      image_url?: string;
    },
  ): Promise<WorkLocationRevenue> {
    const revenue = await this.revenueRepository.findOne({
      where: { id: revenueId } as any,
    });
    if (!revenue)
      throw new NotFoundException(
        `Încasarea cu ID-ul ${revenueId} nu a fost găsită`,
      );

    // Track if status is changing to approved (trigger for bonus calculation)
    const wasApproved = revenue.status === RevenueStatus.Approved;
    const becomingApproved = data.status === RevenueStatus.Approved;
    const shouldCalculateBonuses = becomingApproved && !wasApproved;
    // Use revenue_date from the revenue record (date when revenue was created), not approval date
    const revenueDateRaw = data.revenue_date || revenue.revenue_date;
    // Normalize date: extract only YYYY-MM-DD part (remove time if present)
    const revenueDate = revenueDateRaw
      ? revenueDateRaw.toString().split(" ")[0].split("T")[0]
      : null;

    // IMPORTANT: Pentru a evita conversia de timezone care poate schimba ziua,
    // folosim ora 12:00:00 (amiază) pentru a evita conversiile de timezone
    // care pot schimba ziua când se folosește 00:00:00 (miezul nopții)
    if (data.revenue_date) {
      const dateStr = data.revenue_date.toString();
      let datePart: string;

      // Extragem partea de dată (YYYY-MM-DD)
      if (dateStr.includes("T")) {
        datePart = dateStr.split("T")[0];
      } else if (dateStr.includes(" ")) {
        datePart = dateStr.split(" ")[0];
      } else {
        datePart = dateStr;
      }

      // Verificăm că datePart este în format valid YYYY-MM-DD
      if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Folosim ora 12:00:00 pentru a evita conversiile de timezone
        revenue.revenue_date = `${datePart} 12:00:00`;
      } else {
        // Fallback: folosim direct string-ul primit
        revenue.revenue_date = data.revenue_date;
      }
    }
    if (data.online_amount !== undefined)
      revenue.online_amount = data.online_amount as any;
    if (data.cash_amount !== undefined)
      revenue.cash_amount = data.cash_amount as any;
    if (data.card_amount !== undefined)
      revenue.card_amount = data.card_amount as any;
    if (data.total_amount !== undefined)
      revenue.total_amount = data.total_amount as any;
    if (data.status !== undefined) revenue.status = data.status;
    if (data.image_url !== undefined) revenue.image_url = data.image_url;

    const savedRevenue = await this.revenueRepository.save(
      revenue as WorkLocationRevenue,
    );

    const becomingCanceled = data.status === RevenueStatus.Canceled;

    if (shouldCalculateBonuses && revenueDate) {
      await this.sendRevenueNotification(
        "revenue_approved",
        "Încasare aprobată",
        `Încasarea pentru data ${revenueDate} a fost aprobată, total: ${Number(savedRevenue.total_amount ?? 0).toFixed(2)} RON.`,
        revenueId,
        revenue.work_location_id,
        {
          revenue_date: revenueDate,
          total_amount: Number(savedRevenue.total_amount ?? 0),
        },
      );
      this.triggerBonusAndManagerPayoutOnApprovedRevenue(
        revenueId,
        revenue.work_location_id,
        revenueDate,
      ).catch((err) =>
        console.error(
          `❌ [updateRevenue] triggerBonusAndManagerPayoutOnApprovedRevenue:`,
          err,
        ),
      );
    } else if (becomingCanceled) {
      await this.sendRevenueNotification(
        "revenue_rejected",
        "Încasare respinsă",
        `Încasarea pentru data ${revenueDate ?? "N/A"} a fost respinsă.`,
        revenueId,
        revenue.work_location_id,
        { revenue_date: revenueDate },
      );
    }

    return savedRevenue;
  }

  // Calculate bonuses for all employees in a location for a specific date based on approved revenues.
  // Returns list of { employeeId, amount } for employees who had points that day (pentru notificări).
  // IMPORTANT: revenueDate is the date when revenue was created (revenue_date), not the approval date
  private async calculateEmployeeBonusesForDate(
    locationId: number,
    revenueDate: string,
  ): Promise<Array<{ employeeId: number; amount: number }>> {
    try {
      // Normalize date to YYYY-MM-DD format for consistent querying
      const normalizedDate = revenueDate.toString().split(" ")[0].split("T")[0];
      console.log(
        `🔍 [BONUS CALC] Starting bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`,
      );

      // Get all approved revenues for this revenue_date (date when revenue was created)
      // Query uses LIKE to match dates that start with normalizedDate (handles datetime format)
      const approvedRevenues = await this.revenueRepository
        .createQueryBuilder("revenue")
        .where("revenue.work_location_id = :locationId", { locationId })
        .andWhere("DATE(revenue.revenue_date) = :revenueDate", {
          revenueDate: normalizedDate,
        })
        .andWhere("revenue.status = :status", {
          status: RevenueStatus.Approved,
        })
        .getMany();

      if (!approvedRevenues || approvedRevenues.length === 0) {
        console.log(
          `⚠️ [BONUS CALC] No approved revenues found for location ${locationId}, date ${revenueDate}`,
        );
        return [];
      }

      // Get revenue intervals for this location
      const intervals = await this.revenuePointsRepository.find({
        where: { work_location_id: locationId } as any,
        order: { min_revenue: "ASC" } as any,
      });

      // Get manager config (fallback_revenue_per_point was removed from entity, use 0 as default)
      const managerCfg = await this.managerConfigRepository.findOne({
        where: { work_location_id: locationId } as any,
      });
      // fallback_revenue_per_point is no longer in the entity, use 0 as default fallback
      const fallback = 0;

      // Get all employees from this location (folosește EMPLOYEES_HTTP_URL – în Docker setați ex. http://employees:3001)
      const employeesUrl =
        process.env.EMPLOYEES_HTTP_URL || "http://localhost:3011";
      const employeesEndpoint = `${employeesUrl}/employees/locations/${locationId}/employees`;
      let employees: any[] = [];
      const serviceSecret =
        process.env.SERVICE_SECRET || '';
      try {
        console.log(`🔍 [BONUS CALC] Fetch employees: ${employeesEndpoint}`);
        const response = await axios.get(employeesEndpoint, {
          headers: {
            "Content-Type": "application/json",
            "x-internal-service": "locations",
            "x-service-secret": serviceSecret,
          },
        });
        employees = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : [];
        console.log(
          `👥 [BONUS CALC] Found ${employees.length} employees in location ${locationId}`,
        );
      } catch (error) {
        console.error(
          `❌ [BONUS CALC] Failed to fetch employees for location ${locationId} (URL: ${employeesEndpoint}). Set EMPLOYEES_HTTP_URL dacă locations și employees sunt în rețele diferite (ex. Docker: http://nume-serviciu-employees:3001):`,
          error?.message ?? error,
        );
        return [];
      }

      // Helper function to find multiplier for a revenue amount
      const pickMultiplier = (totalAmount: number): number => {
        for (const intv of intervals) {
          const minOk = totalAmount >= Number(intv.min_revenue);
          const maxOk =
            intv.max_revenue == null
              ? true
              : totalAmount <= Number(intv.max_revenue);
          if (minOk && maxOk) {
            // Use 'points' property from WorkLocationRevenuePoints entity
            return Number(intv.points);
          }
        }
        return fallback;
      };

      // Puncte per angajat pentru toată locația, într-un singur apel agregat
      // (înlocuiește fan-out-ul de până la 60 de request-uri secvențiale per angajat).
      const tasksApiUrl =
        process.env.TASKS_API_BASE || "http://localhost:3008";
      const workDate = new Date(revenueDate);
      workDate.setHours(0, 0, 0, 0);

      const pointsByEmployeeId = new Map<number, number>();
      try {
        const pointsUrl = `${tasksApiUrl}/executions/location-employee-points`;
        const pointsResponse = await axios.get(pointsUrl, {
          params: {
            location_id: locationId,
            startDate: normalizedDate,
            endDate: normalizedDate,
          },
          headers: {
            "Content-Type": "application/json",
            "x-internal-service": "locations",
            "x-service-secret": serviceSecret,
          },
        });
        const rows = Array.isArray(pointsResponse.data)
          ? pointsResponse.data
          : Array.isArray(pointsResponse.data?.data)
            ? pointsResponse.data.data
            : [];
        for (const row of rows) {
          const employeeId = Number(row.employee_id);
          const points = Number(row.total_points || 0);
          if (Number.isFinite(employeeId) && employeeId > 0) {
            pointsByEmployeeId.set(employeeId, points);
          }
        }
      } catch (error: any) {
        console.error(
          `❌ [BONUS CALC] Could not fetch location-employee-points for location ${locationId}, revenue_date: ${normalizedDate}:`,
          error?.message ?? error,
        );
      }

      const earnings: Array<{ employeeId: number; amount: number }> = [];

      for (const employee of employees) {
        try {
          const employeeId = Number(employee.id || employee.employee_id);
          if (!employeeId) continue;

          const employeePoints = pointsByEmployeeId.get(employeeId) || 0;

          if (employeePoints <= 0) {
            console.log(
              `⚠️ [BONUS CALC] Employee ${employeeId} has no points for revenue_date: ${normalizedDate}, skipping`,
            );
            continue;
          }

          // Calculate bonus for each approved revenue individually
          let totalBonus = 0;
          for (const revenue of approvedRevenues) {
            const totalAmount = Number(revenue.total_amount);
            const multiplier = pickMultiplier(totalAmount);
            const bonusForThisRevenue = employeePoints * multiplier;
            totalBonus += bonusForThisRevenue;

            console.log(
              `💰 [BONUS CALC] Employee ${employeeId}: ${employeePoints} points × ${multiplier} (revenue ${totalAmount}) = ${bonusForThisRevenue.toFixed(2)} RON`,
            );
          }

          console.log(
            `✅ [BONUS CALC] Employee ${employeeId} total bonus for revenue_date ${normalizedDate}: ${totalBonus.toFixed(2)} RON`,
          );

          earnings.push({ employeeId, amount: totalBonus });
        } catch (employeeError) {
          console.error(
            `❌ [BONUS CALC] Error processing employee ${employee.id}:`,
            employeeError,
          );
        }
      }

      console.log(
        `✅ [BONUS CALC] Finished bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`,
      );
      return earnings;
    } catch (error) {
      console.error(
        `❌ [BONUS CALC] Error in calculateEmployeeBonusesForDate:`,
        error,
      );
      return [];
    }
  }

  async getManagerPointsForDate(workLocationId: number, revenueDate: string) {
    const cfg = await this.managerConfigRepository.findOne({
      where: { work_location_id: workLocationId } as any,
    });
    if (!cfg)
      return {
        totalPoints: 0,
        managerPoints: 0,
        managerPercent: 0,
        breakdown: [],
      } as any;
    const revs = await this.revenueRepository.find({
      where: {
        work_location_id: workLocationId,
        revenue_date: revenueDate,
      } as any,
    });
    if (!revs || revs.length === 0)
      return {
        totalPoints: 0,
        managerPoints: 0,
        managerPercent: Number(cfg.manager_percent),
        breakdown: [],
      } as any;
    const intervals = await this.revenuePointsRepository.find({
      where: { work_location_id: workLocationId } as any,
      order: { min_revenue: "ASC" } as any,
    });
    let totalPoints = 0;
    let totalManagerPoints = 0;
    const breakdown: Array<{
      amount: number;
      pointsPerUnit: number;
      interval: { min: number; max: number | null };
      points: number;
      managerShare: number;
    }> = [];
    for (const rev of revs) {
      let pointsPerUnit: number | null = null;
      let matched: { min: number; max: number | null } | null = null;
      for (const intv of intervals) {
        const minOk = Number(rev.total_amount) >= Number(intv.min_revenue);
        const maxOk =
          intv.max_revenue == null
            ? true
            : Number(rev.total_amount) <= Number(intv.max_revenue);
        if (minOk && maxOk) {
          pointsPerUnit = Number(intv.points);
          matched = {
            min: Number(intv.min_revenue),
            max: intv.max_revenue == null ? null : Number(intv.max_revenue),
          };
          break;
        }
      }
      if (!pointsPerUnit || pointsPerUnit <= 0) continue;
      // Interpret pointsPerUnit as "amount per 1 point"
      const amount = Number(rev.total_amount);
      const pts = amount / pointsPerUnit;
      totalPoints += pts;
      const managerPts = pts * (Number(cfg.manager_percent) / 100);
      totalManagerPoints += managerPts;
      breakdown.push({
        amount,
        pointsPerUnit,
        interval: matched as any,
        points: pts,
        managerShare: managerPts,
      });
    }
    return {
      totalPoints,
      managerPoints: totalManagerPoints,
      managerPercent: Number(cfg.manager_percent),
      breakdown,
    } as any;
  }

  // ==================== LOCATION FILES METHODS ====================

  // Creează un nou fișier pentru locație
  async createFile(
    createFileDto: CreateWorkLocationFileDto & {
      expire_date?: string;
      notes?: string;
    },
  ): Promise<WorkLocationFiles> {
    console.log("📥 Received createFileDto:", {
      work_location_id: createFileDto.work_location_id,
      file_name: createFileDto.file_name,
      file_type: createFileDto.file_type,
      has_content: !!createFileDto.file_content,
      content_length: createFileDto.file_content?.length || 0,
    });

    // Verifică dacă locația există
    const location = await this.workLocationRepository.findOne({
      where: { id: createFileDto.work_location_id },
    });

    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${createFileDto.work_location_id} nu a fost găsită`,
      );
    }

    // Get company information using HTTP call to company service
    let companyName = "Unknown";
    try {
      const companiesUrl =
        process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
      const serviceSecret =
        process.env.SERVICE_SECRET || '';

      const response = await axios.get(
        `${companiesUrl}/companies/${location.company_id}`,
        {
          headers: {
            "x-internal-service": "locations",
            "x-service-secret": serviceSecret,
            "Content-Type": "application/json",
          },
          timeout: 3000,
        },
      );

      if (response.data && response.data.company_name) {
        companyName = response.data.company_name;
      }
    } catch (error) {
      console.warn(
        `⚠️ Could not fetch company name for company ID ${location.company_id}:`,
        error.message,
      );
      // Continue with default name
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const fileExtension = createFileDto.file_name.split(".").pop() || "txt";
    const baseFileName =
      createFileDto.file_name.replace(/\.[^/.]+$/, "") || "file";
    const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    let fileDir: string;
    let updatedFileLink: string;
    const folderIdToSave = createFileDto.folder_id ?? null;

    if (createFileDto.folder_id) {
      const folder = await this.folderRepository.findOne({
        where: { id: createFileDto.folder_id, work_location_id: location.id },
      });
      if (!folder) {
        throw new NotFoundException(
          `Folderul cu ID-ul ${createFileDto.folder_id} nu a fost găsit pentru această locație`,
        );
      }
      const basePath = this.getLocationBasePath(
        companyName,
        location.location_name,
      );
      fileDir = path.join(basePath, folder.folder_path);
      const relativePath = folder.folder_path.replace(/\\/g, "/");
      updatedFileLink =
        `/files/companies/${companyName}/Locații/${location.location_name}/${relativePath}/${uniqueFileName}`.replace(
          /\/+/g,
          "/",
        );
    } else {
      let folderName: string | null = null;
      if (createFileDto.notes) {
        const folderMatch = createFileDto.notes.match(/\|folder:([^|]+)\|/);
        if (folderMatch?.[1]) folderName = folderMatch[1];
      }
      const companyFilesRootDir = this.getFilesCompaniesRoot();
      const companyDir = path.join(companyFilesRootDir, companyName);
      const locationsDir = path.join(companyDir, "Locații");
      const locationDir = path.join(locationsDir, location.location_name);
      if (folderName) {
        fileDir = path.join(locationDir, folderName);
      } else {
        fileDir = locationDir;
      }
      updatedFileLink =
        `/files/companies/${companyName}/Locații/${location.location_name}${folderName ? `/${folderName}` : ""}/${uniqueFileName}`.replace(
          /\/+/g,
          "/",
        );
    }

    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // If file content is provided (base64), save it to disk
    if (createFileDto.file_content) {
      try {
        const filePath = path.join(fileDir, uniqueFileName);

        // Extract base64 content from data URL (remove data:type;base64, prefix)
        let base64Data = createFileDto.file_content;
        if (base64Data.includes(",")) {
          base64Data = base64Data.split(",")[1];
        }

        console.log(
          `💾 Saving file with ${base64Data.length} base64 characters`,
        );
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(filePath, buffer);
        console.log(
          `✅ File saved to disk: ${filePath} (${buffer.length} bytes)`,
        );
      } catch (error) {
        console.error("❌ Error saving file to disk:", error);
      }
    }

    // Verifică dacă există deja un fișier cu același nume pentru aceeași locație
    const existingFile = await this.filesRepository.findOne({
      where: {
        work_location_id: createFileDto.work_location_id,
        file_name: uniqueFileName,
      },
    });

    if (existingFile) {
      throw new ConflictException(
        `Un fișier cu numele "${uniqueFileName}" există deja pentru această locație`,
      );
    }

    const file = this.filesRepository.create({
      ...createFileDto,
      file_name: uniqueFileName,
      file_link: updatedFileLink,
      folder_id: folderIdToSave,
      expire_date: createFileDto.expire_date
        ? new Date(createFileDto.expire_date)
        : null,
    });

    const savedFile = await this.filesRepository.save(file);
    console.log(`✅ File record saved to database with ID: ${savedFile.id}`);

    return savedFile;
  }

  // Găsește un fișier după ID
  async findOneFile(id: number): Promise<WorkLocationFiles> {
    const file = await this.filesRepository.findOne({
      where: { id },
      relations: ["workLocation"],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
    }

    return file;
  }

  // Găsește toate fișierele unei locații
  async findFilesByLocation(
    work_location_id: number,
  ): Promise<WorkLocationFiles[]> {
    const location = await this.workLocationRepository.findOne({
      where: { id: work_location_id },
    });

    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${work_location_id} nu a fost găsită`,
      );
    }

    return await this.filesRepository.find({
      where: { work_location_id },
      relations: ["workLocation"],
      order: { updated_at: "DESC" },
    });
  }

  async findFoldersByLocation(
    work_location_id: number,
  ): Promise<WorkLocationFolder[]> {
    const location = await this.workLocationRepository.findOne({
      where: { id: work_location_id },
    });
    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${work_location_id} nu a fost găsită`,
      );
    }
    return this.folderRepository.find({
      where: { work_location_id },
      order: { description: "ASC" },
    });
  }

  async createFolder(
    locationId: number,
    body: { description: string; parent_id?: number | null },
  ): Promise<WorkLocationFolder> {
    const location = await this.workLocationRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${locationId} nu a fost găsită`,
      );
    }
    const companyName = await this.getCompanyNameForLocation(location);
    const basePath = this.getLocationBasePath(
      companyName,
      location.location_name,
    );

    const parentId = body.parent_id ?? null;
    let folderPath: string;
    if (parentId) {
      const parent = await this.folderRepository.findOne({
        where: { id: parentId, work_location_id: locationId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Folderul părinte cu ID-ul ${parentId} nu a fost găsit`,
        );
      }
      folderPath = path.join(parent.folder_path, body.description);
    } else {
      folderPath = body.description;
    }

    const existing = await this.folderRepository.findOne({
      where: {
        work_location_id: locationId,
        parent_id: parentId,
        description: body.description,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Un folder cu numele "${body.description}" există deja în același loc`,
      );
    }
    const absoluteDir = path.join(basePath, folderPath);
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    const now = new Date();
    const folder = this.folderRepository.create({
      work_location_id: locationId,
      description: body.description,
      folder_path: folderPath.replace(/\\/g, "/"),
      parent_id: parentId,
      created_at: now,
      updated_at: now,
    });
    return this.folderRepository.save(folder);
  }

  async updateFolder(
    locationId: number,
    folderId: number,
    body: { description: string },
  ): Promise<WorkLocationFolder> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, work_location_id: locationId },
    });
    if (!folder) {
      throw new NotFoundException(
        `Folderul cu ID-ul ${folderId} nu a fost găsit`,
      );
    }
    const location = await this.workLocationRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${locationId} nu a fost găsită`,
      );
    }

    const existingSibling = await this.folderRepository.findOne({
      where: {
        work_location_id: locationId,
        parent_id: folder.parent_id,
        description: body.description,
      },
    });
    if (existingSibling && existingSibling.id !== folderId) {
      throw new ConflictException(
        `Un folder cu numele "${body.description}" există deja în același loc`,
      );
    }

    const companyName = await this.getCompanyNameForLocation(location);
    const basePath = this.getLocationBasePath(
      companyName,
      location.location_name,
    );
    const oldAbsolute = path.join(basePath, folder.folder_path);
    const parent = folder.parent_id
      ? await this.folderRepository.findOne({ where: { id: folder.parent_id } })
      : null;
    const newFolderPath = parent
      ? (parent.folder_path + "/" + body.description).replace(/\/+/g, "/")
      : body.description;
    const newAbsolute = path.join(basePath, newFolderPath);

    if (oldAbsolute !== newAbsolute && fs.existsSync(oldAbsolute)) {
      fs.renameSync(oldAbsolute, newAbsolute);
    }
    const oldFolderPath = folder.folder_path;
    folder.description = body.description;
    folder.folder_path = newFolderPath;
    await this.folderRepository.save(folder);
    const prefix = oldFolderPath + "/";
    const children = await this.folderRepository.find({
      where: { work_location_id: locationId },
    });
    for (const c of children) {
      if (c.folder_path.startsWith(prefix) && c.id !== folder.id) {
        c.folder_path =
          newFolderPath + c.folder_path.slice(oldFolderPath.length);
        await this.folderRepository.save(c);
      }
    }
    return this.folderRepository.findOne({
      where: { id: folderId },
    }) as Promise<WorkLocationFolder>;
  }

  async removeFolder(locationId: number, folderId: number): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, work_location_id: locationId },
    });
    if (!folder) {
      throw new NotFoundException(
        `Folderul cu ID-ul ${folderId} nu a fost găsit`,
      );
    }
    const location = await this.workLocationRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Locația cu ID-ul ${locationId} nu a fost găsită`,
      );
    }
    const companyName = await this.getCompanyNameForLocation(location);
    const basePath = this.getLocationBasePath(
      companyName,
      location.location_name,
    );
    const absoluteDir = path.join(basePath, folder.folder_path);

    const allFolders = await this.folderRepository.find({
      where: { work_location_id: locationId },
    });
    const toDelete = allFolders.filter(
      (f) =>
        f.folder_path === folder.folder_path ||
        f.folder_path.startsWith(folder.folder_path + "/"),
    );
    const idsToDelete = toDelete.map((f) => f.id);
    await this.filesRepository.update(
      { folder_id: In(idsToDelete) },
      { folder_id: null },
    );
    await this.folderRepository.delete(idsToDelete);

    const removeDirRecursive = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
          removeDirRecursive(full);
        } else {
          fs.unlinkSync(full);
        }
      }
      fs.rmdirSync(dir);
    };
    if (fs.existsSync(absoluteDir)) {
      removeDirRecursive(absoluteDir);
    }
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
    try {
      console.log(
        `🔍 [serveFile] Starting to serve file with ID: ${file_id}, forceDownload: ${forceDownload}`,
      );

      const file = await this.findOneFile(file_id);
      console.log(`📄 [serveFile] File metadata retrieved:`, {
        id: file.id,
        name: file.file_name,
        work_location_id: file.work_location_id,
        file_link: file.file_link,
      });

      // Get location information
      const location = await this.workLocationRepository.findOne({
        where: { id: file.work_location_id },
      });

      if (!location) {
        throw new NotFoundException(
          `Locația cu ID-ul ${file.work_location_id} nu a fost găsită`,
        );
      }

      let filePath: string;
      if (file.file_link.startsWith("/files/companies/")) {
        const relative = file.file_link
          .replace(/^\/files\/companies\//, "")
          .replace(/\//g, path.sep);
        filePath = path.join(this.getFilesCompaniesRoot(), relative);
      } else {
        let companyName = "Unknown";
        try {
          const companiesUrl =
            process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
          const serviceSecret =
            process.env.SERVICE_SECRET || '';
          const response = await axios.get(
            `${companiesUrl}/companies/${location.company_id}`,
            {
              headers: {
                "x-internal-service": "locations",
                "x-service-secret": serviceSecret,
                "Content-Type": "application/json",
              },
              timeout: 3000,
            },
          );
          if (response.data?.company_name)
            companyName = response.data.company_name;
        } catch (err: any) {
          console.warn(`⚠️ Could not fetch company name:`, err?.message);
        }
        const locationDir = path.join(
          this.getFilesCompaniesRoot(),
          companyName,
          "Locații",
          location.location_name,
        );
        let folderName: string | null = null;
        if (file.notes) {
          const m = file.notes.match(/\|folder:([^|]+)\|/);
          if (m?.[1]) folderName = m[1];
        }
        filePath = folderName
          ? path.join(locationDir, folderName, file.file_name)
          : path.join(locationDir, file.file_name);
      }

      console.log(`📁 [serveFile] Full file path: ${filePath}`);
      console.log(
        `📁 [serveFile] Path exists check: ${fs.existsSync(filePath)}`,
      );

      if (!fs.existsSync(filePath)) {
        console.error(`❌ [serveFile] File not found on disk: ${filePath}`);
        throw new NotFoundException("Fișierul nu a fost găsit pe disk");
      }

      const mimeType = this.getMimeType(file.file_name);
      console.log(`📋 [serveFile] MIME type determined: ${mimeType}`);

      const fileBuffer = fs.readFileSync(filePath);
      console.log(
        `✅ [serveFile] File read successfully: ${file.file_name} (${fileBuffer.length} bytes)`,
      );

      return {
        data: fileBuffer.toString("base64"),
        mimeType,
        fileName: file.file_name,
        disposition: forceDownload ? "attachment" : "inline",
      };
    } catch (error) {
      console.error(`❌ [serveFile] Error serving file ${file_id}:`, error);
      console.error(`❌ [serveFile] Error message:`, error.message);
      console.error(`❌ [serveFile] Error stack:`, error.stack);
      throw error;
    }
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

    // Remove physical file from disk
    try {
      // Get location information
      const location = await this.workLocationRepository.findOne({
        where: { id: file.work_location_id },
      });

      if (location) {
        // Get company information using HTTP call to company service
        let companyName = "Unknown";
        try {
          const companiesUrl =
            process.env.COMPANIES_HTTP_URL || "http://localhost:3003";
          const serviceSecret =
            process.env.SERVICE_SECRET || '';

          const response = await axios.get(
            `${companiesUrl}/companies/${location.company_id}`,
            {
              headers: {
                "x-internal-service": "locations",
                "x-service-secret": serviceSecret,
                "Content-Type": "application/json",
              },
              timeout: 3000,
            },
          );

          if (response.data && response.data.company_name) {
            companyName = response.data.company_name;
          }
        } catch (error) {
          console.warn(
            `⚠️ Could not fetch company name for company ID ${location.company_id}:`,
            error.message,
          );
          // Continue with default name
        }

        // Construct the file path using the same logic as in serveFile
        const companyFilesRootDir = path.resolve(__dirname, "../../../..");
        const companyFilesDir = path.join(
          companyFilesRootDir,
          "files",
          "companies",
        );
        const companyDir = path.join(companyFilesDir, companyName);
        const locationsDir = path.join(companyDir, "Locații");
        const locationDir = path.join(locationsDir, location.location_name);

        // Extract folder name from notes if available (same logic as in createFile)
        let folderName: string | null = null;
        if (file.notes) {
          const folderMatch = file.notes.match(/\|folder:([^|]+)\|/);
          if (folderMatch && folderMatch[1]) {
            folderName = folderMatch[1];
          }
        }

        // Construct the file path based on whether it's in a designated folder or not
        let filePath: string;
        if (folderName) {
          // File is in a designated subfolder within the "Locații" subfolder
          const locatiiSubfolderDir = path.join(locationDir, "Locații");
          const designatedFolderDir = path.join(
            locatiiSubfolderDir,
            folderName,
          );
          filePath = path.join(designatedFolderDir, file.file_name);
        } else {
          // File is directly in the location directory (fallback)
          filePath = path.join(locationDir, file.file_name);
        }

        // Remove the physical file if it exists
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Deleted physical file: ${filePath}`);
        } else {
          console.warn(`⚠️ Physical file not found for removal: ${filePath}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to delete physical file for file ${id}:`, error);
    }

    // Remove database record
    await this.filesRepository.delete(id);

    return {
      message: `Fișierul "${file.file_name}" al locației ${file.workLocation?.location_name || "Unknown"} a fost șters cu succes`,
    };
  }

  // Find files expiring on a specific date
  async findExpiringFiles(targetDate: string): Promise<WorkLocationFiles[]> {
    console.log(`[LOCATIONS SERVICE] Finding files expiring on ${targetDate}`);
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);

    const files = await this.filesRepository
      .createQueryBuilder("file")
      .where("DATE(file.expire_date) = :targetDate", { targetDate })
      .leftJoinAndSelect("file.workLocation", "location")
      .getMany();

    console.log(
      `[LOCATIONS SERVICE] Found ${files.length} files expiring on ${targetDate}`,
    );
    return files;
  }

  // Find files that have already expired
  async findExpiredFiles(): Promise<WorkLocationFiles[]> {
    console.log(`[LOCATIONS SERVICE] Finding expired files`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const files = await this.filesRepository
      .createQueryBuilder("file")
      .where("file.expire_date < :today", { today })
      .andWhere("file.expire_date IS NOT NULL")
      .leftJoinAndSelect("file.workLocation", "location")
      .getMany();

    console.log(`[LOCATIONS SERVICE] Found ${files.length} expired files`);
    return files;
  }

  /**
   * Upload imagine cashing - salvează pe server în images/cashing
   */
  async uploadCashingImage(
    fileName: string,
    base64Content: string,
  ): Promise<string> {
    try {
      // Extract base64 content from data URL (remove data:type;base64, prefix)
      let base64Data = base64Content;
      if (base64Data.includes(",")) {
        base64Data = base64Data.split(",")[1];
      }

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = fileName.split(".").pop() || "jpg";
      const baseFileName = fileName.replace(/\.[^/.]+$/, "") || "image";
      const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

      // Save to images/cashing directory on server
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images");
      const cashingDir = path.join(imagesDir, "cashing");

      // Create images/cashing directory if it doesn't exist
      if (!fs.existsSync(cashingDir)) {
        fs.mkdirSync(cashingDir, { recursive: true });
        console.log(`📁 Created images/cashing directory: ${cashingDir}`);
        console.log(`📁 Repo root: ${repoRoot}`);
        console.log(`📁 Images dir: ${imagesDir}`);
      }

      const filePath = path.join(cashingDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, "base64");

      fs.writeFileSync(filePath, buffer);
      console.log(
        `✅ Cashing image saved: ${filePath} (${buffer.length} bytes)`,
      );
      console.log(`✅ File exists check: ${fs.existsSync(filePath)}`);

      // Return the URL path (with cashing subfolder)
      return `/api/images/cashing/${uniqueFileName}`;
    } catch (error: any) {
      console.error(`❌ Error uploading cashing image: ${error}`);
      throw new BadRequestException(
        `Eroare la salvarea imaginii: ${error?.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Servește imaginea unui cashing
   */
  async serveCashingImage(
    fileName: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "cashing");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      const buffer = fs.readFileSync(filePath);

      // Determină tipul MIME
      const extension = fileName.split(".").pop()?.toLowerCase() || "jpg";
      let mimeType = "image/jpeg";

      switch (extension) {
        case "png":
          mimeType = "image/png";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        case "webp":
          mimeType = "image/webp";
          break;
        case "svg":
          mimeType = "image/svg+xml";
          break;
        case "jfif":
          mimeType = "image/jpeg";
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      console.error(`❌ Error serving cashing image: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge imaginea unui cashing de pe server
   */
  async deleteCashingImage(imageUrl: string): Promise<void> {
    try {
      // Extrage numele fișierului din URL
      // URL-ul este de forma: /api/images/cashing/{fileName}
      const urlParts = imageUrl.split("/");
      const fileName = urlParts[urlParts.length - 1];

      if (!fileName) {
        throw new BadRequestException("URL-ul imaginii nu este valid");
      }

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, "images", "cashing");
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Cashing image not found for deletion: ${filePath}`);
        // Nu aruncăm eroare dacă fișierul nu există, doar logăm
        return;
      }

      fs.unlinkSync(filePath);
      console.log(`✅ Cashing image deleted: ${filePath}`);
    } catch (error: any) {
      console.error(`❌ Error deleting cashing image: ${error}`);
      throw new BadRequestException(
        `Eroare la ștergerea imaginii: ${error?.message || "Unknown error"}`,
      );
    }
  }
}
