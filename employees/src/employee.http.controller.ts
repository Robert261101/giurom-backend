import { Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  HttpStatus,
  UseGuards,
  Res,
  ParseIntPipe,
  Request,
  ForbiddenException,
  BadRequestException, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { EmployeeService } from "./employee.service";
import { EmployeesExportService } from "./employees-export.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateSupplierRegistrationEmployeeDto } from "./dto/create-supplier-registration-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { Employee } from "./entities/employee.entity";
import { EmployeeLocation } from "./entities/employee-location.entity";
import { CreateEmployeeLocationDto } from "./dto/create-employee-location.dto";
import { Response } from "express";
import { CreateEmployeeFileDto } from "./dto/create-employee-file.dto";
import { Buffer } from "buffer";
import { Permissions } from "./permissions/permissions.decorator";
import { InternalServiceGuard } from "./auth/internal-service.guard";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@ApiTags("employees")
@Controller("employees")
@ApiBearerAuth()
export class EmployeeHttpController {
  private readonly logger = new Logger(EmployeeHttpController.name);

  constructor(
    private readonly employeeService: EmployeeService,
    private readonly employeesExportService: EmployeesExportService,
  ) {}

  @Post()
  @Permissions("employees.create")
  @ApiOperation({
    summary: "Creează un angajat nou",
    description:
      "Adaugă un nou angajat în sistem cu toate informațiile necesare.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Angajatul a fost creat cu succes",
    type: Employee,
  })
  @ApiHeader({ name: "x-work-location-id", required: false, description: "Locația selectată în UI (colț dreapta sus)" })
  @ApiQuery({ name: "location_id", required: false, description: "Alternativ: locația selectată (dacă nu e în header)" })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ): Promise<Employee> {
    const fromHeaderOrQuery = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const selectedWorkLocationId = fromHeaderOrQuery ?? req?.user?.work_location_id ?? req?.user?.work_location_default_id;
    const created = await this.employeeService.create(createEmployeeDto, selectedWorkLocationId);
    // Fire-and-forget: crearea angajatului nu trebuie să eșueze fiindcă giurom 2.0 e picat.
    void this.employeesExportService.pushEmployeeSafe(created.id);
    return created;
  }

  /**
   * Creare employee din înregistrarea furnizorului (apel intern auth → employees).
   * Nu expune relaxarea hire_date/contract_type pe POST /employees public.
   */
  @Post("internal/supplier-registration")
  @UseGuards(InternalServiceGuard)
  @ApiOperation({
    summary: "Creează employee pentru înregistrare furnizor (intern)",
    description:
      "Endpoint intern: fără hire_date/contract_type. Doar apeluri cu x-internal-service + x-service-secret.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Angajatul asociat furnizorului a fost creat",
    type: Employee,
  })
  @ApiHeader({
    name: "x-work-location-id",
    required: false,
    description: "Locația sediului creat la înregistrare",
  })
  @ApiQuery({
    name: "location_id",
    required: false,
    description: "Alternativ: locația sediului",
  })
  async createFromSupplierRegistration(
    @Body() dto: CreateSupplierRegistrationEmployeeDto,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: { bypassAuth?: boolean },
  ): Promise<Employee> {
    if (!req?.bypassAuth) {
      throw new ForbiddenException(
        "Endpoint disponibil doar pentru servicii interne",
      );
    }
    const selectedWorkLocationId = parseSelectedWorkLocationId(
      xWorkLocationId ?? location_id,
    );
    return this.employeeService.createFromSupplierRegistration(
      dto,
      selectedWorkLocationId,
    );
  }

  @Get()
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions("employees.read", "employees.read_own")
  @ApiOperation({
    summary: "Listează toți angajații",
    description:
      "Returnează o listă paginată cu toți angajații. Cu employees.read_own se returnează doar angajații din locația utilizatorului (location_id obligatoriu sau work_location din user).",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Numărul paginii (implicit: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Numărul de angajați per pagină (implicit: 10)",
  })
  @ApiQuery({
    name: "is_active",
    required: false,
    description: "Filtrează după status activ",
  })
  @ApiQuery({
    name: "department",
    required: false,
    description: "Filtrează după departament",
  })
  @ApiQuery({
    name: "work_location_id",
    required: false,
    description: "Filtrează după locația implicită a angajatului",
  })
  @ApiQuery({
    name: "location_id",
    required: false,
    description: "Filtrează după locația din employees_locations",
  })
  @ApiQuery({
    name: "contract_type",
    required: false,
    description: "Filtrează după tipul contractului",
  })
  @ApiQuery({
    name: "department_name",
    required: false,
    description: "Filtrează după numele departamentului",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista angajații a fost returnată cu succes",
  })
  async findAll(
    @Request() req: any,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("is_active") is_active?: string,
    @Query("department") department?: string,
    @Query("contract_type") contract_type?: string,
    @Query("work_location_id") work_location_id?: string,
    @Query("location_id") location_id?: string,
    @Query("department_name") department_name?: string,
  ): Promise<{ employees: Employee[]; total: number; totalPages: number }> {
    const user = req?.user;
    const perms = (user?.permissions as string[]) || [];
    const roles = ((user?.roles as string[]) || []).map((r) =>
      String(r).toLowerCase().trim(),
    );
    const isGlobalAdmin =
      perms.includes("assignment.read_all") ||
      roles.includes("admin") ||
      roles.includes("super-admin") ||
      roles.includes("superadmin") ||
      Boolean(req?.bypassAuth);

    const companyId = Number(user?.company_id);
    const hasValidCompany =
      Number.isFinite(companyId) && companyId > 0;

    // Tenant non-global: doar angajații propriei companii (nu avem încredere în company_id din query)
    if (user && !isGlobalAdmin && hasValidCompany) {
      let employees = await this.employeeService.findAllByCompany(companyId);
      const isActiveFilter =
        is_active !== undefined ? is_active === "true" : undefined;
      if (isActiveFilter !== undefined) {
        employees = employees.filter((e) => Boolean(e.is_active) === isActiveFilter);
      }
      const locRaw = location_id || work_location_id;
      if (locRaw != null && String(locRaw).trim() !== "") {
        const locId = parseInt(String(locRaw), 10);
        if (Number.isFinite(locId) && locId > 0) {
          await this.employeeService.assertLocationInCompany(locId, companyId);
          const atLocation = await this.employeeService.findForOwn(locId);
          const idSet = new Set(atLocation.map((e) => e.id));
          employees = employees.filter((e) => idSet.has(e.id));
        }
      }
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const total = employees.length;
      const start = (pageNum - 1) * limitNum;
      const slice = employees.slice(start, start + limitNum);
      return {
        employees: slice,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
      };
    }

    const hasReadOwn =
      perms.includes("employees.read_own") || perms.includes("order.read");
    const hasRead = perms.includes("employees.read");
    if (user && hasReadOwn && !hasRead) {
      const locationId = this.resolveScopedLocationId(
        user,
        location_id,
        work_location_id,
        req?.bypassAuth,
      );
      await this.employeeService.assertLocationInCompany(
        locationId,
        user.company_id,
      );
      const list = await this.employeeService.findForOwn(locationId);
      const total = list.length;
      return { employees: list as unknown as Employee[], total, totalPages: 1 };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const isActiveFilter =
      is_active !== undefined ? is_active === "true" : undefined;
    const departmentFilter = department ? parseInt(department, 10) : undefined;

    return this.employeeService.findAll(
      pageNum,
      limitNum,
      isActiveFilter,
      departmentFilter,
      contract_type,
      work_location_id ? parseInt(work_location_id, 10) : undefined,
      location_id ? parseInt(location_id, 10) : undefined,
      department_name,
    );
  }

  @Get("batch")
  @UseGuards(InternalServiceGuard, JwtAuthGuard) // Permite apeluri interne (header secret) OR JWT autentificat
  // Permite utilizatorilor cu permisiunea completă `employees.read`, `employees.read_own`,
  // `order.read` (operațional) sau `suppliers.create` (furnizor) să apeleze acest endpoint.
  @Permissions(
    "employees.read",
    "employees.read_own",
    "order.read",
    "suppliers.create",
  )
  @ApiOperation({
    summary: "Obține mai mulți angajați după ID-uri (batch)",
    description:
      "Returnează informații de bază (id, first_name, last_name, email, is_active, work_location_default_id) pentru o listă de ID-uri de angajați.",
  })
  @ApiQuery({
    name: "ids",
    required: true,
    description:
      "Lista de ID-uri de angajați, separate prin virgulă (ex: 1,2,3)",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista angajaților a fost returnată cu succes",
    type: [Employee],
  })
  async findBatch(
    @Query("ids") ids: string,
    @Request() req: any,
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
    if (!ids) {
      return [];
    }

    // Permite apelul dacă este un apel intern (InternalServiceGuard) sau dacă user-ul are
    // permisiunea `employees.read` sau `employees.read_own`.
    // Verificăm manual aici (guard-urile pot fi diferite în funcție de implementare).
    const headers = req?.headers || {};
    const internalHeader =
      headers["x-internal-service"] || headers["x-service-secret"] || headers["x-api-key"];
    if (!internalHeader) {
      const userPermissions = req?.user?.permissions || [];
      const canReadBatch = userPermissions.some((perm: string) =>
        [
          "employees.read",
          "employees.read_own",
          "order.read",
          "suppliers.create",
        ].includes(perm),
      );
      if (!Array.isArray(userPermissions) || !canReadBatch) {
        throw new ForbiddenException("Forbidden");
      }
    }

    const idList = ids
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (idList.length === 0) {
      return [];
    }

    return this.employeeService.findByIdsBasic(idList);
  }

  @Get("for-own")
  @Permissions("employees.read_own", "order.read")
  @ApiOperation({
    summary:
      "Listează colegii din aceeași locație (employees.read_own sau order.read operațional)",
    description:
      "Returnează doar id, first_name, last_name pentru angajați activi.",
  })
  @ApiQuery({
    name: "location_id",
    required: false,
    description: "Filtrează după locație",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista angajaților a fost returnată cu succes",
  })
  async findForOwn(
    @Query("location_id") location_id?: string,
    @Query("company_id") company_id?: string,
    @Request() req?: any,
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
    if (company_id != null && String(company_id).trim() !== "") {
      throw new ForbiddenException(
        "Parametrul company_id nu poate fi folosit pentru a extinde scope-ul",
      );
    }

    const user = req?.user;
    const isInternal = Boolean(req?.bypassAuth);

    if (isInternal) {
      const loc = location_id ? parseInt(location_id, 10) : NaN;
      if (!Number.isFinite(loc) || loc <= 0) {
        throw new BadRequestException(
          "Apelurile interne necesită location_id valid în query",
        );
      }
      return this.employeeService.findForOwn(loc);
    }

    if (!user) {
      throw new ForbiddenException("Autentificare necesară");
    }

    const locationId = this.resolveScopedLocationId(user, location_id);
    await this.employeeService.assertLocationInCompany(
      locationId,
      user.company_id,
    );
    return this.employeeService.findForOwn(locationId);
  }

  /**
   * Locația permisă — exclusiv din JWT; query location_id trebuie să coincidă.
   */
  private resolveScopedLocationId(
    user: {
      work_location_id?: number;
      work_location_default_id?: number;
      company_id?: number | null;
    },
    location_id?: string,
    work_location_id?: string,
    isInternal?: boolean,
  ): number {
    if (isInternal) {
      const loc = location_id ? parseInt(location_id, 10) : NaN;
      if (!Number.isFinite(loc) || loc <= 0) {
        throw new BadRequestException("location_id invalid");
      }
      return loc;
    }

    const jwtLocation = Number(
      user?.work_location_id ?? user?.work_location_default_id,
    );
    if (!Number.isFinite(jwtLocation) || jwtLocation <= 0) {
      throw new ForbiddenException(
        "Locația de lucru nu este configurată în tokenul de autentificare",
      );
    }

    const requestedRaw = location_id ?? work_location_id;
    if (requestedRaw != null && String(requestedRaw).trim() !== "") {
      const requested = parseInt(String(requestedRaw), 10);
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new BadRequestException("location_id invalid");
      }
      if (requested !== jwtLocation) {
        throw new ForbiddenException(
          "location_id nu corespunde locației utilizatorului autentificat",
        );
      }
    }

    return jwtLocation;
  }

  @Get("statistics")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Statistici angajați",
    description: "Returnează statistici detaliate despre angajați.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Statisticile au fost returnate cu succes",
  })
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byContractType: { [key: string]: number };
    byGender: { [key: string]: number };
    hiredThisMonth: number;
  }> {
    return this.employeeService.getStatistics();
  }

  // List employee files by employee ID
  @Get(":employeeId/files")
  @Permissions("employees.read", "employees.read_own")
  async getEmployeeFiles(
    @Param("employeeId", ParseIntPipe) employeeId: number,
  ) {
    return this.employeeService.findFilesByEmployee(employeeId);
  }

  /** Creează un folder pentru angajat (body: description, parent_id opțional). */
  @Post(":employeeId/folders")
  @Permissions("employees.update")
  @ApiOperation({ summary: "Creează folder angajat" })
  async createFolder(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body() body: { description: string; parent_id?: number },
  ) {
    return this.employeeService.createFolder(employeeId, body || { description: '' });
  }

  /** Actualizează numele unui folder (body: description). */
  @Patch(":employeeId/folders/:folderId")
  @Permissions("employees.update")
  @ApiOperation({ summary: "Actualizează folder angajat" })
  async updateFolder(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("folderId", ParseIntPipe) folderId: number,
    @Body() body: { description: string },
  ) {
    return this.employeeService.updateFolder(employeeId, folderId, body || { description: '' });
  }

  /** Șterge un folder și descendenții (inclusiv pe disk). */
  @Delete(":employeeId/folders/:folderId")
  @Permissions("employees.delete")
  @ApiOperation({ summary: "Șterge folder angajat" })
  async removeFolder(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("folderId", ParseIntPipe) folderId: number,
  ) {
    return this.employeeService.removeFolder(employeeId, folderId);
  }

  // Optional: list via query (used by some legacy callers)
  @Get("files")
  @Permissions("employees.read")
  async getFilesByQuery(@Query("employee_id") employee_id?: string) {
    if (!employee_id) {
      return [];
    }
    const idNum = parseInt(employee_id as any, 10);
    if (!Number.isFinite(idNum)) {
      return [];
    }
    return this.employeeService.findFilesByEmployee(idNum);
  }

  @Get("email/:email")
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Găsește angajat după email",
    description: "Returnează detaliile angajatului cu email-ul specificat.",
  })
  @ApiParam({ name: "email", description: "Email-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost găsit",
    type: Employee,
  })
  async findByEmail(@Param("email") email: string): Promise<Employee> {
    return this.employeeService.findByEmail(email);
  }

  @Get("phone/:phone")
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Găsește angajat după telefon",
    description:
      "Returnează detaliile angajatului cu numărul de telefon specificat.",
  })
  @ApiParam({ name: "phone", description: "Numărul de telefon al angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost găsit",
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Angajatul nu a fost găsit",
  })
  async findByPhone(@Param("phone") phone: string): Promise<Employee> {
    return this.employeeService.findByPhone(phone);
  }

  @Get("cnp/:cnp")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Găsește angajat după CNP",
    description: "Returnează detaliile angajatului cu CNP-ul specificat.",
  })
  @ApiParam({ name: "cnp", description: "CNP-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost găsit",
    type: Employee,
  })
  async findByCNP(@Param("cnp") cnp: string): Promise<Employee> {
    return this.employeeService.findByCNP(cnp);
  }

  @Get("by-user/:userId")
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Găsește angajat după user ID",
    description:
      "Returnează detaliile angajatului asociat cu user_id-ul specificat.",
  })
  @ApiParam({
    name: "userId",
    description: "ID-ul utilizatorului (din auth service)",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost găsit",
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Angajatul nu a fost găsit pentru acest user_id",
  })
  async findByUserId(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<Employee> {
    return this.employeeService.findByUserId(userId);
  }

  @Get(":id/name")
  @Permissions(
    "employees.read_own",
    "order.read",
    "suppliers.create",
    "employees.read",
  )
  @ApiOperation({
    summary: "Găsește numele unui angajat după ID",
    description:
      "Returnează doar id, first_name, last_name, full_name pentru utilizatori cu permisiunea employees.read_own.",
  })
  @ApiParam({ name: "id", description: "ID-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Numele angajatului a fost returnat cu succes",
  })
  async findNameById(
    @Param("id") id: string,
  ): Promise<{
    id: number;
    first_name: string;
    last_name: string;
    full_name: string;
  }> {
    return this.employeeService.findNameById(+id);
  }

  @Get(":id")
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions("employees.read", "employees.read_own")
  @ApiOperation({
    summary: "Găsește angajat după ID",
    description:
      "Returnează detaliile angajatului. Cu employees.read — orice angajat; altfel doar propriul profil.",
  })
  @ApiParam({ name: "id", description: "ID-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost găsit",
    type: Employee,
  })

  async findOne(
    @Param("id") id: string,
    @Request() req?: any,
  ): Promise<Employee> {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw new ForbiddenException("ID angajat invalid");
    }

    if (!req?.bypassAuth) {
      const user = req?.user;
      const perms = (user?.permissions as string[]) || [];
      const roles = ((user?.roles as string[]) || []).map((r: string) =>
        String(r).toLowerCase().trim(),
      );
      const hasFullRead =
        perms.includes("employees.read") ||
        perms.includes("assignment.read_all") ||
        roles.includes("admin") ||
        roles.includes("super-admin") ||
        roles.includes("superadmin") ||
        (user?.company_type === "furnizor" && perms.includes("suppliers.create"));

      if (!hasFullRead) {
        const selfId = Number(
          user?.id_employee ?? user?.id ?? user?.userId ?? user?.sub,
        );
        if (!Number.isFinite(selfId) || selfId !== numericId) {
          throw new ForbiddenException("Permisiuni insuficiente");
        }
      }
    }

    return this.employeeService.findOne(numericId);
    return this.employeeService.findOne(numericId, req?.user);
  }

  @Patch(":id")
  @Permissions("employees.update")
  @ApiOperation({
    summary: "Actualizează un angajat",
    description: "Actualizează informațiile unui angajat existent.",
  })
  @ApiParam({ name: "id", description: "ID-ul angajatului de actualizat" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost actualizat cu succes",
    type: Employee,
  })
  @ApiHeader({ name: "x-work-location-id", required: false })
  @ApiQuery({ name: "location_id", required: false })
  async update(
    @Param("id") id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ): Promise<Employee> {
    const fromHeaderOrQuery = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const selectedWorkLocationId = fromHeaderOrQuery ?? req?.user?.work_location_id ?? req?.user?.work_location_default_id;
    const updated = await this.employeeService.update(+id, updateEmployeeDto, selectedWorkLocationId, req?.user);
    void this.employeesExportService.pushEmployeeSafe(+id);
    return updated;
  }

  @Patch(":id/toggle-active")
  @Permissions("employees.update")
  @ApiOperation({
    summary: "Activează/dezactivează un angajat",
    description: "Schimbă statusul activ al unui angajat (activ ↔ inactiv).",
  })
  @ApiParam({ name: "id", description: "ID-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Statusul angajatului a fost schimbat cu succes",
    type: Employee,
  })
  async toggleActive(@Param("id") id: string, @Request() req?: any): Promise<Employee> {
    const employee = await this.employeeService.toggleActive(+id, req?.user);
    // Dezactivarea trebuie să ajungă repede în giurom 2.0: acolo blochează login-ul.
    void this.employeesExportService.pushEmployeeSafe(+id);
    return employee;
  }

  @Delete(":id")
  @Permissions("employees.delete")
  @ApiOperation({
    summary: "Șterge un angajat",
    description:
      "Șterge definitiv un angajat din sistem. Atenție: această operație este ireversibilă!",
  })
  @ApiParam({ name: "id", description: "ID-ul angajatului de șters" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost șters cu succes",
  })
  @ApiHeader({ name: "x-work-location-id", required: false })
  @ApiQuery({ name: "location_id", required: false })
  async remove(
    @Param("id") id: string,
    @Headers("x-work-location-id") xWorkLocationId?: string,
    @Query("location_id") location_id?: string,
    @Request() req?: any,
  ): Promise<{ message: string }> {
    const fromHeaderOrQuery = parseSelectedWorkLocationId(xWorkLocationId ?? location_id);
    const selectedWorkLocationId = fromHeaderOrQuery ?? req?.user?.work_location_id ?? req?.user?.work_location_default_id;
    return this.employeeService.remove(+id, selectedWorkLocationId, req?.user);
  }

  // Serve employee file (download or inline based on query)
  @Get("file/:fileId")
  @Permissions("employees.read", "employees.read_own")
  async getEmployeeFile(
    @Param("fileId", ParseIntPipe) fileId: number,
    @Query("download") download: string,
    @Res() res: Response,
    @Request() req: any,
  ) {
    const file = await this.employeeService.findOneFile(fileId);
    const user = req?.user;
    const perms = (user?.permissions as string[]) || [];
    const hasReadOwn = perms.includes("employees.read_own");
    const hasRead = perms.includes("employees.read");
    if (user && hasReadOwn && !hasRead) {
      const employeeId = user.id_employee ?? user.employee_id ?? user.id ?? user.sub;
      if (file.employee_id !== employeeId) {
        throw new ForbiddenException("Nu ai acces la acest fișier.");
      }
    }
    const forceDownload = download === "true";
    const served = await this.employeeService.serveFile(fileId, forceDownload);
    const buffer = Buffer.from(served.data, "base64");
    res.setHeader(
      "Content-Type",
      served.mimeType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `${forceDownload || served.disposition === "attachment" ? "attachment" : "inline"}; filename="${served.fileName}"`,
    );
    res.setHeader("Content-Length", buffer.length.toString());
    return res.send(buffer);
  }

  // Delete employee file
  @Delete("files/:fileId")
  @Permissions("employees.delete")
  @ApiOperation({
    summary: "Șterge un fișier al unui angajat",
    description:
      "Șterge definitiv un fișier al unui angajat din sistem. Atenție: această operație este ireversibilă!",
  })
  @ApiParam({ name: "fileId", description: "ID-ul fișierului de șters" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Fișierul a fost șters cu succes",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Fișierul nu a fost găsit",
  })
  async deleteEmployeeFile(
    @Param("fileId", ParseIntPipe) fileId: number,
  ): Promise<{ message: string }> {
    return this.employeeService.removeFile(fileId);
  }

  // Force inline view (inclusiv imagine profil – utilizatorul cu read_own vede doar fișierele proprii)
  @Get("file/:fileId/view")
  @Permissions("employees.read", "employees.read_own")
  async viewEmployeeFile(
    @Param("fileId", ParseIntPipe) fileId: number,
    @Res() res: Response,
    @Request() req: any,
  ) {
    const file = await this.employeeService.findOneFile(fileId);
    const user = req?.user;
    const perms = (user?.permissions as string[]) || [];
    const hasReadOwn = perms.includes("employees.read_own");
    const hasRead = perms.includes("employees.read");
    if (user && hasReadOwn && !hasRead) {
      const employeeId = user.id_employee ?? user.employee_id ?? user.id ?? user.sub;
      if (file.employee_id !== employeeId) {
        throw new ForbiddenException("Nu ai acces la acest fișier.");
      }
    }
    const served = await this.employeeService.serveFile(fileId, false);
    const buffer = Buffer.from(served.data, "base64");
    res.setHeader(
      "Content-Type",
      served.mimeType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${served.fileName}"`,
    );
    res.setHeader("Content-Length", buffer.length.toString());
    return res.send(buffer);
  }

  // Create employee file (metadata or with base64 content)
  @Post(":employeeId/files")
  @Permissions("employees.create")
  async addEmployeeFile(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body()
    body: Omit<CreateEmployeeFileDto, "employee_id"> & { employee_id?: number },
  ) {
    this.logger.log("📥 Received addEmployeeFile request:", { employeeId, body });

    const dto: CreateEmployeeFileDto = {
      employee_id: employeeId,
      file_name: body.file_name,
      file_type: body.file_type,
      file_link: body.file_link,
      file_content: body.file_content,
      note: body.note,
    } as CreateEmployeeFileDto;

    this.logger.log("📤 Sending to employee service from addEmployeeFile:", {
      dto,
    });
    return this.employeeService.createFile(dto);
  }

  // Backwards-compatible route used by frontend add form
  @Post(":employeeId/documents-with-content")
  @Permissions("employees.create")
  async addEmployeeDocumentWithContent(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Body()
    body: {
      documents: Array<{
        fileName: string;
        name?: string;
        size?: number;
        content: string;
        type?: string;
        document_type?: string;
        note?: string;
        expire_date?: string;
      }>;
      folder_id?: number;
    },
  ) {
    this.logger.log("📥 Received document upload request:", { employeeId, body });

    if (!body?.documents || body.documents.length === 0) {
      return { message: "No documents provided" };
    }
    const first = body.documents[0];
    const fileName = first.fileName || first.name || "document.bin";

    // Get employee to construct proper file link
    const employee = await this.employeeService.findOne(employeeId);

    // Check if this is a profile picture
    const isProfilePicture =
      (first.document_type || first.type) === "profile_picture";

    // Don't provide file_link - let the service construct the correct path based on employee location binding or folder_id
    const createFileDto = {
      employee_id: employeeId,
      file_name: fileName,
      file_type: first.document_type || first.type || "Altele",
      file_content: first.content,
      expire_date: first.expire_date,
      note: first.note,
      ...(body.folder_id != null && { folder_id: body.folder_id }),
    };

    this.logger.log("📤 Sending to employee service:", { createFileDto });

    return this.employeeService.createFile(
      createFileDto as CreateEmployeeFileDto,
    );
  }

  // ==================== EMPLOYEES LOCATIONS ENDPOINTS ====================

  @Post("locations/assign")
  @Permissions("employees.update")
  @ApiOperation({
    summary: "Asignă un angajat la o locație",
    description: "Creează o asociere între un angajat și o locație de lucru.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Angajatul a fost asignat cu succes la locație",
    type: EmployeeLocation,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Angajatul este deja asignat la această locație",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Angajatul nu a fost găsit",
  })
  async assignEmployeeToLocation(
    @Body() assignDto: CreateEmployeeLocationDto,
  ): Promise<EmployeeLocation> {
    return this.employeeService.assignEmployeeToLocation(assignDto);
  }

  @Get(":employeeId/locations")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Obține locațiile unui angajat",
    description: "Returnează toate locațiile la care este asignat un angajat.",
  })
  @ApiParam({ name: "employeeId", description: "ID-ul angajatului" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista locațiilor angajatului",
    type: [EmployeeLocation],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Angajatul nu a fost găsit",
  })
  async getEmployeeLocations(
    @Param("employeeId", ParseIntPipe) employeeId: number,
  ): Promise<EmployeeLocation[]> {
    return this.employeeService.findEmployeeLocations(employeeId);
  }

  @Get("locations/:locationId/employees")
  @UseGuards(InternalServiceGuard, JwtAuthGuard)
  @Permissions("employees.read", "employees.read_own")
  @ApiOperation({
    summary: "Obține angajații unei locații",
    description: "Returnează toți angajații asignați la o locație. Cu read_own doar pentru propria locație (ex.: realocare task).",
  })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Lista angajaților de la locație",
    type: [EmployeeLocation],
  })
  async getLocationEmployees(
    @Param("locationId", ParseIntPipe) locationId: number,
    @Request() req: any,
  ): Promise<EmployeeLocation[] | { employee: { id: number; first_name: string; last_name: string } }[]> {
    const user = req?.user;
    const perms = (user?.permissions as string[]) || [];
    const hasReadOwn = perms.includes("employees.read_own");
    const hasRead = perms.includes("employees.read");

    if (user && hasReadOwn && !hasRead) {
      const employeeId = user.id_employee ?? user.employee_id ?? user.id ?? user.sub;
      if (employeeId == null) {
        throw new ForbiddenException("Lipsă id angajat în token.");
      }
      const allowedIds = await this.employeeService.getLocationIdsForEmployee(Number(employeeId));
      if (!allowedIds.includes(locationId)) {
        throw new ForbiddenException("Nu ai acces la angajații acestei locații.");
      }
      const list = await this.employeeService.findForOwn(locationId);
      return list.map((e) => ({ employee: e })) as any;
    }

    this.logger.log("🔍 [EMPLOYEES CONTROLLER] Cerere pentru angajații din locația:",
      locationId,);
    const result = await this.employeeService.findLocationEmployees(locationId);
    this.logger.log("🔍 [EMPLOYEES CONTROLLER] Angajați returnați:", result.length);
    return result;
  }

  @Get("location/:locationId")
  @Permissions("employees.read", "employees.read_own")
  @ApiOperation({
    summary: "Obține toți angajații din locația specificată",
    description: "Cu read_own doar pentru propria locație (ex.: realocare task).",
  })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({ status: 200, description: "Lista angajaților din locație" })
  async getEmployeesByLocation(
    @Param("locationId", ParseIntPipe) locationId: number,
    @Request() req: any,
  ) {
    const user = req?.user;
    const perms = (user?.permissions as string[]) || [];
    const hasReadOwn = perms.includes("employees.read_own");
    const hasRead = perms.includes("employees.read");

    if (user && hasReadOwn && !hasRead) {
      const employeeId = user.id_employee ?? user.employee_id ?? user.id ?? user.sub;
      if (employeeId == null) {
        throw new ForbiddenException("Lipsă id angajat în token.");
      }
      const allowedIds = await this.employeeService.getLocationIdsForEmployee(Number(employeeId));
      if (!allowedIds.includes(locationId)) {
        throw new ForbiddenException("Nu ai acces la angajații acestei locații.");
      }
      const employees = await this.employeeService.findForOwn(locationId);
      return { employees };
    }

    this.logger.log("🔍 [EMPLOYEES CONTROLLER] Cerere pentru angajații din locația:",
      locationId,);
    const employees = await this.employeeService.findAll(
      1,
      1000,
      undefined,
      undefined,
      undefined,
      undefined,
      locationId,
    );
    this.logger.log("🔍 [EMPLOYEES CONTROLLER] Angajați returnați:",
      employees.employees.length,);
    return { employees: employees.employees };
  }

  @Delete(":employeeId/locations/:locationId")
  @Permissions("employees.update")
  @ApiOperation({
    summary: "Elimină angajatul de la locație",
    description: "Șterge asocierea dintre un angajat și o locație de lucru.",
  })
  @ApiParam({ name: "employeeId", description: "ID-ul angajatului" })
  @ApiParam({ name: "locationId", description: "ID-ul locației" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Angajatul a fost eliminat cu succes de la locație",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Asocierea nu a fost găsită",
  })
  async removeEmployeeFromLocation(
    @Param("employeeId", ParseIntPipe) employeeId: number,
    @Param("locationId", ParseIntPipe) locationId: number,
  ): Promise<{ message: string }> {
    return this.employeeService.removeEmployeeFromLocation(
      employeeId,
      locationId,
    );
  }

  @Get("company/:companyId")
  @Permissions("employees.read")
  @ApiOperation({ summary: "Obține toți angajații companiei" })
  @ApiParam({ name: "companyId", description: "ID-ul companiei" })
  @ApiResponse({ status: 200, description: "Lista angajaților companiei" })
  async getEmployeesByCompany(
    @Request() req: any,
    @Param("companyId", ParseIntPipe) companyId: number,
  ) {
    const user = req?.user;
    if (!req?.bypassAuth && user) {
      const perms = (user?.permissions as string[]) || [];
      const roles = ((user?.roles as string[]) || []).map((r: string) =>
        String(r).toLowerCase().trim(),
      );
      const isGlobalAdmin =
        perms.includes("assignment.read_all") ||
        roles.includes("admin") ||
        roles.includes("super-admin") ||
        roles.includes("superadmin");
      if (!isGlobalAdmin) {
        const jwtCompanyId = Number(user.company_id);
        if (
          !Number.isFinite(jwtCompanyId) ||
          jwtCompanyId <= 0 ||
          jwtCompanyId !== companyId
        ) {
          throw new ForbiddenException(
            "Nu puteți lista angajații unei alte companii",
          );
        }
      }
    }
    return this.employeeService.findAllByCompany(companyId);
  }

  // Get files expiring on a specific date
  @Get("files/expiring/:targetDate")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Obține fișierele angajaților care expiră la o anumită dată",
  })
  @ApiParam({
    name: "targetDate",
    description: "Data la care expiră fișierele (format: YYYY-MM-DD)",
  })
  @ApiResponse({
    status: 200,
    description: "Lista fișierelor care expiră la data specificată",
  })
  async getExpiringFiles(@Param("targetDate") targetDate: string) {
    this.logger.log(`[EMPLOYEES CONTROLLER] Getting files expiring on ${targetDate}`,);
    return this.employeeService.findExpiringFiles(targetDate);
  }

  // Get files that have already expired
  @Get("files/expired")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Obține fișierele angajaților care au expirat deja",
  })
  @ApiResponse({
    status: 200,
    description: "Lista fișierelor care au expirat deja",
  })
  async getExpiredFiles() {
    this.logger.log(`[EMPLOYEES CONTROLLER] Getting expired files`);
    return this.employeeService.findExpiredFiles();
  }
}

/** Locația selectată în UI (colț dreapta sus): header x-work-location-id sau query location_id. */
function parseSelectedWorkLocationId(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}
