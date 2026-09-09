import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES,
  CLIENT_ADMIN_ROLE_NAME,
  getClientAdminAssignRoleBlockReason,
  isClientAdminRequester,
  normalizeRoleName,
} from './client-role-assignment.util';
import { hasPlatformWideAccess } from '@giurom/tenant-access';
import {
  filterUserRolesForRequester,
  hasPlatformRbacCatalogAccess,
  shouldListUserRolesGlobally,
  type UserRolesListFilters,
} from './user-roles-list-scope.util';
import * as bcrypt from 'bcrypt';
import { firstValueFrom } from 'rxjs';

/** Payload JWT relevant pentru scope tenant pe /users. */
export type RequesterAuthContext = {
  sub?: number;
  id?: number;
  company_id?: number | null;
  companyId?: number | null;
  company_type?: string | null;
  isSuperAdmin?: boolean;
  roles?: string[];
  permissions?: string[];
};

/** Nume posibile pentru rolul default de angajat (DB poate avea casing diferit). */
const DEFAULT_EMPLOYEE_ROLE_NAMES = ['angajat', 'employee'] as const;

/**
 * Permisiuni minime în JWT pentru dashboard / flow-uri proprii ale angajatului.
 * Se aplică când user_roles lipsește sau rolul angajat e incomplet.
 */
const PLAIN_EMPLOYEE_BASELINE_PERMISSIONS = [
  'assignment.read_own',
  'execution.read_own',
  'execution.create',
  'execution.read',
  'companies.read_own',
  'employees.read_own',
  'leave-requests.read',
  'leave-requests.create',
  'attendance.read',
  'attendance.create',
  'attendance.update',
  'calendar.read',
  'cashing.create',
  'leaves.read',
  // Comenzi client: listă + detalii + recepție parțială (+ lookup produse)
  'order.read',
  'order.create',
  'order.reception',
  'products.read',
  // GIU-15: aruncare (pending) + consum propriu — fără waste_approve / stock.* admin
  'stock.waste_own',
  'stock.consume_own',
] as const;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly httpService: HttpService,
  ) {}

  private internalServiceHeaders(): Record<string, string> {
    return {
      'X-Internal-Service': 'auth-service',
      'X-Service-Secret':
        process.env.SERVICE_SECRET || '',
    };
  }

  /**
   * Rezolvă company_id din locație (fără company_type).
   */
  private async resolveCompanyIdFromLocationId(
    locationId: number,
  ): Promise<number | null> {
    try {
      const locationsUrl =
        process.env.LOCATIONS_HTTP_URL || 'http://localhost:3004';
      const locationResponse = await firstValueFrom(
        this.httpService.get(`${locationsUrl}/locations/${locationId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
      const location = locationResponse.data?.data || locationResponse.data;
      const companyId = location?.company_id ?? location?.companyId ?? null;
      const parsed = Number(companyId);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch (error) {
      console.error(
        `Eroare la rezolvarea company_id din locația ${locationId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Rezolvă company_id și company_type din locația implicită a angajatului.
   */
  async resolveCompanyContext(idEmployee: number): Promise<{
    company_id: number | null;
    company_type: 'furnizor' | 'client' | null;
  }> {
    try {
      const employee = await this.findEmployeeById(idEmployee);
      const locationId = employee?.work_location_default_id;
      if (!locationId) {
        return { company_id: null, company_type: null };
      }

      const locationsUrl =
        process.env.LOCATIONS_HTTP_URL || 'http://localhost:3004';
      const locationResponse = await firstValueFrom(
        this.httpService.get(`${locationsUrl}/locations/${locationId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
      const location = locationResponse.data?.data || locationResponse.data;
      const companyId = location?.company_id ?? location?.companyId ?? null;
      if (!companyId) {
        return { company_id: null, company_type: null };
      }

      const companiesUrl =
        process.env.COMPANIES_HTTP_URL || 'http://localhost:3003';
      const companyResponse = await firstValueFrom(
        this.httpService.get(`${companiesUrl}/companies/${companyId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
      const company = companyResponse.data?.data || companyResponse.data;
      const companyType = company?.company_type ?? company?.companyType ?? null;
      if (companyType !== 'furnizor' && companyType !== 'client') {
        return { company_id: companyId, company_type: null };
      }

      return { company_id: companyId, company_type: companyType };
    } catch (error) {
      console.error(
        `Eroare la rezolvarea contextului companiei pentru angajat ${idEmployee}:`,
        error,
      );
      return { company_id: null, company_type: null };
    }
  }

  /**
   * Construiește payload-ul utilizator folosit la generarea JWT (login, refresh, 2FA).
   */
  async buildUserDataForToken(
    idEmployee: number,
    usersTableId: number,
    options?: {
      profile_image?: string | null;
      is_2fa_active?: boolean;
    },
  ): Promise<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    profile_image: string | null;
    birth_date: string;
    department_id: number | null;
    work_location_id: number | null;
    company_id: number | null;
    company_type: 'furnizor' | 'client' | null;
    position_default_id: number | null;
    roles: string[];
    permissions: string[];
    is_2fa_active?: boolean;
  }> {
    const employeeData = await this.findEmployeeById(idEmployee);
    const { roles, permissions } = await this.resolveTokenRolesAndPermissions(
      usersTableId,
      employeeData?.position_default_id,
    );
    const companyContext = await this.resolveCompanyContext(idEmployee);
    const workLocationId = employeeData?.work_location_default_id ?? null;
    let resolvedCompanyId = companyContext.company_id;
    if (resolvedCompanyId == null && workLocationId != null) {
      resolvedCompanyId = await this.resolveCompanyIdFromLocationId(workLocationId);
    }
    const resolvedCompanyType =
      companyContext.company_type ??
      (() => {
        const normalizedRoles = roles.map((role) =>
          String(role).toLowerCase().trim(),
        );
        if (normalizedRoles.includes('furnizor')) return 'furnizor' as const;
        if (normalizedRoles.includes('client')) return 'client' as const;
        return null;
      })();

    const withOperational = this.ensureCompaniesReadOwnForOperationalStaff(
      roles,
      permissions,
      employeeData?.position_default_id,
    );
    const effectivePermissions = this.ensureFurnizorTenantPermissions(
      resolvedCompanyType,
      roles,
      withOperational,
      employeeData?.position_default_id,
    );

    return {
      id: idEmployee,
      email: employeeData?.email || '',
      first_name: employeeData?.first_name || '',
      last_name: employeeData?.last_name || '',
      phone: employeeData?.phone || '',
      profile_image: options?.profile_image ?? null,
      birth_date: employeeData?.birth_date || '',
      department_id: employeeData?.department_default_id ?? null,
      work_location_id: workLocationId,
      company_id: resolvedCompanyId,
      company_type: resolvedCompanyType,
      position_default_id: employeeData?.position_default_id ?? null,
      roles,
      permissions: effectivePermissions,
      ...(options?.is_2fa_active !== undefined
        ? { is_2fa_active: options.is_2fa_active }
        : {}),
    };
  }

  /**
   * Creează un utilizator nou
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Verifică dacă există deja un utilizator cu acest id_employee
    const existingUser = await this.userRepository.findOne({
      where: { id_employee: createUserDto.id_employee },
    });

    if (existingUser) {
      throw new ConflictException(
        `Utilizatorul cu id_employee ${createUserDto.id_employee} există deja`,
      );
    }

    // Hash-uiește parola
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    // Creează utilizatorul
    const user = this.userRepository.create({
      id_employee: createUserDto.id_employee,
      password: hashedPassword,
      profile_image: createUserDto.profile_image || null,
      is_active: createUserDto.is_active ?? true,
      is_2fa: createUserDto.is_2fa ?? false,
    });

    const saved = await this.userRepository.save(user);
    // Conturile din Setări → Conturi nu primesc rol în UI; fără rol JWT-ul e gol → 403 pe dashboard.
    await this.assignDefaultEmployeeRoleIfNeeded(saved.id);
    return saved;
  }

  /**
   * Găsește un utilizator după id_employee
   */
  async findByEmployeeId(id_employee: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id_employee },
    });
  }

  /**
   * Găsește un utilizator după id_employee cu parola inclusă
   */
  async findByEmployeeIdWithPassword(
    id_employee: number,
  ): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.profile_image')
      .where('user.id_employee = :id_employee', { id_employee })
      .getOne();
  }

  /**
   * Găsește un utilizator după ID
   */
  async findOne(id: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Găsește utilizatorii. Dacă includeInactive este true, returnează toți (inclusiv dezactivați).
   */
  async findAll(includeInactive = false): Promise<User[]> {
    return await this.userRepository.find({
      where: includeInactive ? {} : { is_active: true },
      order: { id: 'ASC' },
    });
  }

  /**
   * Actualizează parola unui utilizator
   */
  async updatePassword(
    id_employee: number,
    newPassword: string,
  ): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.userRepository.update(
      { id_employee },
      { password: hashedPassword },
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    return updatedUser;
  }

  /**
   * Actualizează imaginea de profil a unui utilizator
   */
  async updateProfileImage(
    id_employee: number,
    profileImageUrl: string,
  ): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }

    // Handle profile image URL properly
    let processedProfileImageUrl = profileImageUrl;
    if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
      // This is a direct file path, we need to convert it to an API proxy URL
      // For now, we'll store empty string to use default avatar
      // In a real implementation, we would need to find the file ID and create the proper URL
      processedProfileImageUrl = '';
    }
    // If this is already an API proxy URL, keep it as is
    else if (profileImageUrl && profileImageUrl.startsWith('/api/')) {
      processedProfileImageUrl = profileImageUrl;
    }

    await this.userRepository.update(
      { id_employee },
      { profile_image: processedProfileImageUrl },
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    return updatedUser;
  }

  /**
   * Actualizează statusul activ al unui utilizator
   */
  async updateActiveStatus(
    id_employee: number,
    is_active: boolean,
  ): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }

    await this.userRepository.update({ id_employee }, { is_active });

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    return updatedUser;
  }

  /**
   * Actualizează statusul 2FA al unui utilizator
   */
  async update2FAStatus(id_employee: number, is_2fa: boolean): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }

    await this.userRepository.update({ id_employee }, { is_2fa });

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    return updatedUser;
  }

  /**
   * Verifică parola unui utilizator
   */
  async validatePassword(
    id_employee: number,
    password: string,
  ): Promise<boolean> {
    const user = await this.findByEmployeeIdWithPassword(id_employee);
    if (!user) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  /**
   * Actualizează profilul complet al unui utilizator
   */
  async updateProfile(
    id_employee: number,
    updateData: UpdateUserDto,
  ): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }

    // Pregătește datele pentru actualizare
    const updateFields: any = {};

    if (updateData.password) {
      const saltRounds = 10;
      updateFields.password = await bcrypt.hash(
        updateData.password,
        saltRounds,
      );
    }

    // Handle profile image URL properly
    if (updateData.profile_image !== undefined) {
      let profileImageUrl = updateData.profile_image;
      if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
        // This is a direct file path, we need to convert it to an API proxy URL
        // For now, we'll store empty string to use default avatar
        // In a real implementation, we would need to find the file ID and create the proper URL
        profileImageUrl = '';
      }
      // If this is already an API proxy URL, keep it as is
      else if (profileImageUrl && profileImageUrl.startsWith('/api/')) {
        profileImageUrl = profileImageUrl;
      }
      // For any other URL (including empty/null), keep as is
      updateFields.profile_image = profileImageUrl;
    }

    if (updateData.is_active !== undefined)
      updateFields.is_active = updateData.is_active;
    if (updateData.is_2fa !== undefined)
      updateFields.is_2fa = updateData.is_2fa;

    await this.userRepository.update({ id_employee }, updateFields);

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    return updatedUser;
  }

  /**
   * Get user roles by user id
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });

    return userRoles.map((userRole) => userRole.role);
  }

  /**
   * Get user permissions by user id
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    // First get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });

    // Then get role permissions
    const roleIds = userRoles.map((userRole) => userRole.roleId);
    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: In(roleIds) },
      relations: ['permission'],
    });

    // Extract unique permissions
    const permissions = rolePermissions.map((rp) => rp.permission);
    const uniquePermissions = permissions.filter(
      (permission, index, self) =>
        index === self.findIndex((p) => p.id === permission.id),
    );

    return uniquePermissions;
  }

  /**
   * Get user roles by employee id
   */
  async getUserRolesByEmployeeId(employeeId: number): Promise<Role[]> {
    const user = await this.findByEmployeeId(employeeId);
    if (!user) {
      return [];
    }
    return this.getUserRoles(user.id);
  }

  /**
   * Get user permissions by employee id
   */
  async getUserPermissionsByEmployeeId(
    employeeId: number,
  ): Promise<Permission[]> {
    const user = await this.findByEmployeeId(employeeId);
    if (!user) {
      return [];
    }
    return this.getUserPermissions(user.id);
  }

  /**
   * Obține roles și permissions pentru un utilizator
   */
  async getUserRolesAndPermissions(
    userId: number,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    try {
      // Obține toate role-urile utilizatorului
      const userRoles = await this.userRoleRepository
        .createQueryBuilder('ur')
        .leftJoinAndSelect('ur.role', 'role')
        .where('ur.userId = :userId', { userId })
        .getMany();

      const roles = userRoles.map((ur) => ur.role.name);

      // Obține toate permisiunile pentru role-urile utilizatorului
      const roleIds = userRoles.map((ur) => ur.roleId);

      let permissions: string[] = [];
      if (roleIds.length > 0) {
        const rolePermissions = await this.rolePermissionRepository
          .createQueryBuilder('rp')
          .leftJoinAndSelect('rp.permission', 'permission')
          .where('rp.roleId IN (:...roleIds)', { roleIds })
          .getMany();

        permissions = rolePermissions.map((rp) => rp.permission.name);
      }

      return { roles, permissions };
    } catch (error) {
      console.error('Eroare la obținerea roles și permissions:', error);
      return { roles: [], permissions: [] };
    }
  }

  /**
   * Permisiuni din rolul auth (ex. magazioner id 5) — folosit când user_roles lipsește
   * dar employees.position_default_id indică rol operațional.
   */
  async getRolesAndPermissionsByRoleName(
    roleName: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (!role) {
      return { roles: [], permissions: [] };
    }

    const rolePermissions = await this.rolePermissionRepository
      .createQueryBuilder('rp')
      .leftJoinAndSelect('rp.permission', 'permission')
      .where('rp.roleId = :roleId', { roleId: role.id })
      .getMany();

    const permissions = [
      ...new Set(
        rolePermissions
          .map((rp) => rp.permission?.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0),
      ),
    ];

    return {
      roles: [role.name],
      permissions: this.ensureCompaniesReadOwnForOperationalStaff(
        [role.name],
        permissions,
        role.name === 'magazioner' ? 5 : role.name === 'sofer' ? 4 : undefined,
      ),
    };
  }

  /**
   * Magazioner/șofer: permisiuni minime în JWT (header firmă + finalizare sarcini).
   */
  private ensureCompaniesReadOwnForOperationalStaff(
    roles: string[],
    permissions: string[],
    positionDefaultId?: number | null,
  ): string[] {
    const normalized = roles.map((r) => String(r).toLowerCase());
    const isOperational =
      normalized.includes('magazioner') ||
      normalized.includes('sofer') ||
      positionDefaultId === 5 ||
      positionDefaultId === 4;
    if (!isOperational) {
      return permissions;
    }
    const out = [...permissions];
    for (const perm of [
      'companies.read_own',
      'execution.create',
      'leave-requests.create',
      'leave-requests.read',
    ]) {
      if (!out.includes(perm)) {
        out.push(perm);
      }
    }
    return out;
  }

  private mergeUniquePermissions(
    permissions: string[],
    extras: readonly string[],
  ): string[] {
    const out = [...permissions];
    for (const perm of extras) {
      if (!out.includes(perm)) {
        out.push(perm);
      }
    }
    return out;
  }

  private isElevatedAuthRole(roles: string[]): boolean {
    const normalized = roles.map((r) => String(r).toLowerCase().trim());
    return (
      normalized.includes('admin') ||
      normalized.includes('super-admin') ||
      normalized.includes('superadmin') ||
      normalized.includes('furnizor') ||
      normalized.includes('manager')
    );
  }

  private async findDefaultEmployeeRole(): Promise<Role | null> {
    for (const name of DEFAULT_EMPLOYEE_ROLE_NAMES) {
      const exact = await this.roleRepository.findOne({ where: { name } });
      if (exact) {
        return exact;
      }
    }
    const allRoles = await this.roleRepository.find();
    const candidates = new Set<string>(DEFAULT_EMPLOYEE_ROLE_NAMES);
    return (
      allRoles.find((role) =>
        candidates.has(String(role.name).toLowerCase().trim()),
      ) ?? null
    );
  }

  private async resolveDefaultEmployeeRolesAndPermissions(): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    const role = await this.findDefaultEmployeeRole();
    if (role) {
      const resolved = await this.getRolesAndPermissionsByRoleName(role.name);
      return {
        roles: resolved.roles.length > 0 ? resolved.roles : [role.name],
        permissions: this.mergeUniquePermissions(
          resolved.permissions,
          PLAIN_EMPLOYEE_BASELINE_PERMISSIONS,
        ),
      };
    }
    return {
      roles: ['angajat'],
      permissions: [...PLAIN_EMPLOYEE_BASELINE_PERMISSIONS],
    };
  }

  /**
   * Conturi create din Setări fără rol: asociază rolul default „angajat” dacă există în DB.
   */
  private async assignDefaultEmployeeRoleIfNeeded(
    userId: number,
  ): Promise<void> {
    const existing = await this.userRoleRepository.find({
      where: { userId },
    });
    if (existing.length > 0) {
      return;
    }
    const role = await this.findDefaultEmployeeRole();
    if (!role) {
      return;
    }
    await this.userRoleRepository.save(
      this.userRoleRepository.create({ userId, roleId: role.id }),
    );
  }

  /**
   * Angajat plain: asigură permisiunile de dashboard / comenzi proprii în JWT.
   * Mereu face merge (nu early-return pe subset) ca noile baseline să ajungă și la conturile deja „parțial” populate.
   */
  private ensurePlainEmployeeBaselinePermissions(
    roles: string[],
    permissions: string[],
  ): string[] {
    if (this.isElevatedAuthRole(roles)) {
      return permissions;
    }
    // Conturi cu drepturi de administrare — nu diluăm / nu adăugăm baseline de angajat.
    if (
      permissions.includes('suppliers.create') ||
      permissions.includes('assignment.read_all') ||
      permissions.includes('employees.read')
    ) {
      return permissions;
    }
    return this.mergeUniquePermissions(
      permissions,
      PLAIN_EMPLOYEE_BASELINE_PERMISSIONS,
    );
  }

  private isOperationalStaffForToken(
    roles: string[],
    positionDefaultId?: number | null,
  ): boolean {
    const normalized = roles.map((r) => String(r).toLowerCase());
    return (
      normalized.includes('magazioner') ||
      normalized.includes('sofer') ||
      positionDefaultId === 5 ||
      positionDefaultId === 4
    );
  }

  /**
   * Cont tenant furnizor: permisiuni minime în JWT pentru șabloane, imagini catalog etc.
   * Nu se aplică magazionerilor / șoferilor — company_type=furnizor nu înseamnă rol furnizor.
   */
  private ensureFurnizorTenantPermissions(
    companyType: 'furnizor' | 'client' | null,
    roles: string[],
    permissions: string[],
    positionDefaultId?: number | null,
  ): string[] {
    if (this.isOperationalStaffForToken(roles, positionDefaultId)) {
      return permissions;
    }
    const normalized = roles.map((r) => String(r).toLowerCase());
    const isFurnizorAdmin =
      normalized.includes('furnizor') ||
      (companyType === 'furnizor' && permissions.includes('suppliers.create'));
    if (!isFurnizorAdmin) {
      return permissions;
    }
    const out = [...permissions];
    for (const perm of [
      'suppliers.create',
      'template.create',
      'template.read',
      'order.read',
      'attendance.create',
      'attendance.update',
      'leave-requests.create',
      'leave-requests.read',
      'leave-requests.update',
      // Locații proprii: listare / creare / editare (quota locations.max pe locations-ms)
      'locations.read',
      'locations.create',
      'locations.update',
      // Setări → Conturi: creare cont autentificare pentru angajații propriei companii
      'users.read',
      'users.create',
    ]) {
      if (!out.includes(perm)) {
        out.push(perm);
      }
    }
    return out;
  }

  /** Platform-wide users admin — tenant-bound JWT stays company-scoped. */
  isGlobalUsersAdmin(requester?: RequesterAuthContext | null): boolean {
    if (!requester) return false;
    return hasPlatformWideAccess(requester);
  }

  /** id_employee din payload JWT (câmp `id` sau `sub`). */
  getRequesterEmployeeId(requester?: RequesterAuthContext | null): number | null {
    if (!requester) return null;
    const raw = requester.id ?? requester.sub;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  /** Apel intern (microserviciu) — fără restricții tenant. */
  isInternalRequest(req: { bypassAuth?: boolean }): boolean {
    return req?.bypassAuth === true;
  }

  private async assertSameCompany(
    requester: RequesterAuthContext,
    targetEmployeeId: number,
  ): Promise<void> {
    const companyId = Number(requester.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new ForbiddenException(
        'Compania utilizatorului nu este determinată',
      );
    }
    const targetContext = await this.resolveCompanyContext(targetEmployeeId);
    if (
      targetContext.company_id == null ||
      Number(targetContext.company_id) !== companyId
    ) {
      throw new ForbiddenException('Acces interzis la resurse din altă companie');
    }
  }

  async assertCanReadEmployee(
    requester: RequesterAuthContext | null | undefined,
    employeeId: number,
    isInternal: boolean,
  ): Promise<void> {
    if (isInternal || this.isGlobalUsersAdmin(requester)) return;

    const requesterEmpId = this.getRequesterEmployeeId(requester);
    if (requesterEmpId === employeeId) return;

    const perms = requester?.permissions || [];
    if (perms.includes('users.read') || perms.includes('users.create')) {
      await this.assertSameCompany(requester!, employeeId);
      return;
    }

    throw new ForbiddenException('Permisiuni insuficiente pentru vizualizare');
  }

  async assertCanWriteEmployee(
    requester: RequesterAuthContext | null | undefined,
    employeeId: number,
    isInternal: boolean,
    allowSelfProfile = false,
  ): Promise<void> {
    if (isInternal || this.isGlobalUsersAdmin(requester)) return;

    const requesterEmpId = this.getRequesterEmployeeId(requester);
    if (allowSelfProfile && requesterEmpId === employeeId) return;

    const perms = requester?.permissions || [];
    if (perms.includes('users.create')) {
      await this.assertSameCompany(requester!, employeeId);
      return;
    }

    throw new ForbiddenException('Permisiuni insuficiente pentru modificare');
  }

  async assertCanManageRoles(
    requester: RequesterAuthContext | null | undefined,
    isInternal: boolean,
  ): Promise<void> {
    if (isInternal || this.isGlobalUsersAdmin(requester)) return;
    if (hasPlatformRbacCatalogAccess(requester)) return;
    throw new ForbiddenException(
      'Permisiuni insuficiente pentru gestionarea rolurilor',
    );
  }

  /**
   * Gate for user↔role mutations.
   * Platform: permissions.read or global admin.
   * Tenant client-admin: users.assign_role (without needing permissions.read).
   */
  async assertCanAssignUserRoles(
    requester: RequesterAuthContext | null | undefined,
    isInternal: boolean,
  ): Promise<void> {
    if (isInternal || this.isGlobalUsersAdmin(requester)) return;
    const perms = requester?.permissions || [];
    if (perms.includes('permissions.read') || perms.includes('users.assign_role')) {
      return;
    }
    throw new ForbiddenException(
      'Permisiuni insuficiente pentru atribuirea rolurilor',
    );
  }

  /**
   * Extra checks when requester is a tenant client-admin (not platform).
   * - same company (already via assertCanManageUserAccount)
   * - allowlist / deny-list / privilege ceiling on target role
   * - cannot remove own client-admin role
   */
  async assertClientAdminRoleAssignmentAllowed(
    requester: RequesterAuthContext | null | undefined,
    opts: {
      targetUserId: number;
      roleId?: number | null;
      /** When removing an existing user_role row */
      existingUserRoleId?: number | null;
      action: 'assign' | 'remove' | 'replace';
    },
  ): Promise<void> {
    if (!requester || !isClientAdminRequester(requester)) {
      return;
    }
    if (this.isGlobalUsersAdmin(requester)) {
      return;
    }

    const requesterEmpId = this.getRequesterEmployeeId(requester);
    const targetUser = await this.userRepository.findOne({
      where: { id: opts.targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException(
        `Utilizatorul cu id ${opts.targetUserId} nu a fost găsit`,
      );
    }

    // Same-company: requester company_id must equal target user's company
    const requesterCompanyId = Number(requester.company_id);
    if (!Number.isFinite(requesterCompanyId) || requesterCompanyId <= 0) {
      throw new ForbiddenException(
        'Context de companie lipsă pentru atribuirea rolurilor',
      );
    }
    const targetContext = await this.resolveCompanyContext(
      targetUser.id_employee,
    );
    if (
      targetContext.company_id == null ||
      Number(targetContext.company_id) !== requesterCompanyId
    ) {
      throw new ForbiddenException(
        'Acces interzis la resurse din altă companie',
      );
    }

    // Self-protection: cannot strip own client-admin role
    if (
      requesterEmpId != null &&
      targetUser.id_employee === requesterEmpId &&
      (opts.action === 'remove' || opts.action === 'replace')
    ) {
      let roleIdToCheck = opts.roleId ?? null;
      if (opts.existingUserRoleId != null) {
        const existing = await this.userRoleRepository.findOne({
          where: { id: opts.existingUserRoleId },
        });
        if (existing) {
          roleIdToCheck = existing.roleId;
        }
      }
      if (roleIdToCheck != null) {
        const role = await this.roleRepository.findOne({
          where: { id: roleIdToCheck },
        });
        if (role && normalizeRoleName(role.name) === CLIENT_ADMIN_ROLE_NAME) {
          throw new ForbiddenException(
            'Nu vă puteți elimina propriul rol client-admin',
          );
        }
      }
      // delete all roles for self
      if (opts.action === 'remove' && opts.roleId == null && opts.existingUserRoleId == null) {
        const ownRoles = await this.userRoleRepository.find({
          where: { userId: opts.targetUserId },
        });
        const roleIds = ownRoles.map((ur) => ur.roleId);
        if (roleIds.length > 0) {
          const roles = await this.roleRepository.find({
            where: { id: In(roleIds) },
          });
          if (
            roles.some(
              (r) => normalizeRoleName(r.name) === CLIENT_ADMIN_ROLE_NAME,
            )
          ) {
            throw new ForbiddenException(
              'Nu vă puteți elimina propriul rol client-admin',
            );
          }
        }
      }
    }

    if (opts.action === 'assign' || opts.action === 'replace') {
      if (opts.roleId == null) {
        throw new BadRequestException('roleId este obligatoriu');
      }
      const role = await this.roleRepository.findOne({
        where: { id: opts.roleId },
      });
      if (!role) {
        throw new NotFoundException(`Rolul cu ID ${opts.roleId} nu a fost găsit`);
      }
      const rolePerms = await this.rolePermissionRepository.find({
        where: { roleId: role.id },
      });
      const permissionIds = rolePerms.map((rp) => rp.permissionId);
      let permissionNames: string[] = [];
      if (permissionIds.length > 0) {
        const perms = await this.permissionRepository.find({
          where: { id: In(permissionIds) },
        });
        permissionNames = perms.map((p) => p.name);
      }
      const block = getClientAdminAssignRoleBlockReason({
        roleName: role.name,
        rolePermissionNames: permissionNames,
      });
      if (block) {
        throw new ForbiddenException(block);
      }
    }
  }

  async assertCanManageUserAccount(
    requester: RequesterAuthContext | null | undefined,
    userId: number,
    isInternal: boolean,
  ): Promise<void> {
    if (isInternal || this.isGlobalUsersAdmin(requester)) return;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id ${userId} nu a fost găsit`);
    }
    await this.assertCanWriteEmployee(requester, user.id_employee, false);
  }

  async findByEmployeeIdForRequester(
    requester: RequesterAuthContext | null | undefined,
    idEmployee: number,
    isInternal: boolean,
  ): Promise<User> {
    await this.assertCanReadEmployee(requester, idEmployee, isInternal);
    const user = await this.findByEmployeeId(idEmployee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${idEmployee} nu a fost găsit`,
      );
    }
    return user;
  }

  async findOneForRequester(
    requester: RequesterAuthContext | null | undefined,
    id: number,
    isInternal: boolean,
  ): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu ID ${id} nu a fost găsit`);
    }
    await this.assertCanReadEmployee(requester, user.id_employee, isInternal);
    return user;
  }

  async findUsersByIdsBasicForRequester(
    requester: RequesterAuthContext | null | undefined,
    ids: number[],
    isInternal: boolean,
  ): Promise<Array<Pick<User, 'id' | 'id_employee'>>> {
    const results = await this.findUsersByIdsBasic(ids);
    if (isInternal || this.isGlobalUsersAdmin(requester)) {
      return results;
    }
    const companyId = Number(requester?.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return [];
    }
    const employeeIds = await this.findEmployeeIdsByCompany(companyId);
    const allowed = new Set(employeeIds);
    const requesterEmpId = this.getRequesterEmployeeId(requester);
    const filtered: Array<Pick<User, 'id' | 'id_employee'>> = [];
    for (const row of results) {
      if (
        allowed.has(row.id_employee) ||
        (requesterEmpId != null && row.id_employee === requesterEmpId)
      ) {
        filtered.push(row);
      }
    }
    return filtered;
  }

  async updateProfileForRequester(
    requester: RequesterAuthContext | null | undefined,
    idEmployee: number,
    updateData: UpdateUserDto,
    isInternal: boolean,
    allowSelfProfile = false,
  ): Promise<User> {
    await this.assertCanWriteEmployee(
      requester,
      idEmployee,
      isInternal,
      allowSelfProfile,
    );
    return this.updateProfile(idEmployee, updateData);
  }

  async removeForRequester(
    requester: RequesterAuthContext | null | undefined,
    idEmployee: number,
    isInternal: boolean,
  ): Promise<void> {
    await this.assertCanWriteEmployee(requester, idEmployee, isInternal);
    return this.remove(idEmployee);
  }

  async removeByUserIdForRequester(
    requester: RequesterAuthContext | null | undefined,
    userId: number,
    isInternal: boolean,
  ): Promise<void> {
    await this.assertCanManageUserAccount(requester, userId, isInternal);
    return this.removeByUserId(userId);
  }

  /**
   * Contul de tenant al unei companii client: cine se loghează pentru firma asta.
   *
   * Se preferă `client-admin` — rolul primit la self-registration, deci contul „firmei",
   * nu al unui angajat oarecare. Fără el se întoarce primul cont activ, ca ecranul care
   * întreabă „există cont?" să nu răspundă „nu" pentru o firmă care are totuși logări.
   *
   * Apel intern (x-service-secret): nu are requester, deci nu poate face verificare de
   * scope — de aceea nu e expus pe nicio rută cu JWT.
   */
  async findTenantAccountForCompany(companyId: number): Promise<{
    exists: boolean;
    employee_id: number | null;
    email: string | null;
    name: string | null;
    is_active: boolean | null;
    roles: string[];
    /** Cate conturi de autentificare are firma in total. */
    accounts_total: number;
  }> {
    const empty = {
      exists: false,
      employee_id: null,
      email: null,
      name: null,
      is_active: null,
      roles: [] as string[],
      accounts_total: 0,
    };
    if (!Number.isFinite(companyId) || companyId <= 0) return empty;

    const employees = await this.findEmployeesByCompany(companyId);
    if (employees.length === 0) return empty;

    const employeeById = new Map(employees.map((e) => [e.id, e]));
    const users = await this.userRepository.find({
      where: { id_employee: In([...employeeById.keys()]) },
    });
    if (users.length === 0) return empty;

    const withRoles = await Promise.all(
      users.map(async (user) => ({
        user,
        roles: (await this.getUserRoles(user.id)).map((r) =>
          normalizeRoleName(r.name),
        ),
      })),
    );

    const chosen =
      withRoles.find(
        (c) => c.user.is_active && c.roles.includes(CLIENT_ADMIN_ROLE_NAME),
      ) ??
      withRoles.find((c) => c.roles.includes(CLIENT_ADMIN_ROLE_NAME)) ??
      withRoles.find((c) => c.user.is_active) ??
      withRoles[0];

    const employee = employeeById.get(chosen.user.id_employee);
    const fullName = [employee?.first_name, employee?.last_name]
      .filter((part) => (part || '').trim())
      .join(' ')
      .trim();

    return {
      exists: true,
      employee_id: chosen.user.id_employee,
      email: employee?.email?.trim() || null,
      name: fullName || null,
      is_active: chosen.user.is_active,
      roles: chosen.roles,
      accounts_total: users.length,
    };
  }

  /** Angajatii companiei, cu datele de contact (via microserviciul employees, apel intern). */
  private async findEmployeesByCompany(companyId: number): Promise<
    Array<{ id: number; email: string; first_name: string; last_name: string }>
  > {
    try {
      const employeesUrl =
        process.env.EMPLOYEES_SERVICE_URL || 'http://localhost:3011';
      const response = await firstValueFrom(
        this.httpService.get(`${employeesUrl}/employees/company/${companyId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : [];
      return list
        .map((e: Record<string, unknown>) => ({
          id: Number(e?.id),
          email: String(e?.email ?? ''),
          first_name: String(e?.first_name ?? e?.firstName ?? ''),
          last_name: String(e?.last_name ?? e?.lastName ?? ''),
        }))
        .filter((e) => Number.isFinite(e.id) && e.id > 0);
    } catch (error) {
      console.error(
        `Eroare la listarea angajatilor pentru company ${companyId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * ID-uri angajați din compania dată (via microserviciul employees, apel intern).
   */
  async findEmployeeIdsByCompany(companyId: number): Promise<number[]> {
    try {
      const employeesUrl =
        process.env.EMPLOYEES_SERVICE_URL || 'http://localhost:3011';
      const response = await firstValueFrom(
        this.httpService.get(`${employeesUrl}/employees/company/${companyId}`, {
          headers: this.internalServiceHeaders(),
        }),
      );
      const data = response.data?.data || response.data;
      const list = Array.isArray(data) ? data : [];
      return list
        .map((e: { id?: number }) => Number(e?.id))
        .filter((id: number) => Number.isFinite(id) && id > 0);
    } catch (error) {
      console.error(
        `Eroare la listarea angajaților pentru company ${companyId}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Listează userii: global = toți; altfel doar cei cu id_employee din compania JWT.
   */
  async findAllForRequester(
    requester: RequesterAuthContext,
    includeInactive = false,
  ): Promise<User[]> {
    const all = await this.findAll(includeInactive);
    if (this.isGlobalUsersAdmin(requester)) {
      return all;
    }
    const companyId = Number(requester.company_id);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return [];
    }
    const employeeIds = await this.findEmployeeIdsByCompany(companyId);
    const idSet = new Set(employeeIds);
    return all.filter((u) => idSet.has(u.id_employee));
  }

  /**
   * Creează cont autentificare; pentru non-global verifică că angajatul e din aceeași companie.
   */
  async createForRequester(
    requester: RequesterAuthContext,
    createUserDto: CreateUserDto,
  ): Promise<User> {
    if (!this.isGlobalUsersAdmin(requester)) {
      const companyId = Number(requester.company_id);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        throw new ForbiddenException(
          'Compania utilizatorului nu este determinată; nu puteți crea conturi',
        );
      }
      const targetContext = await this.resolveCompanyContext(
        createUserDto.id_employee,
      );
      if (
        targetContext.company_id == null ||
        Number(targetContext.company_id) !== companyId
      ) {
        throw new ForbiddenException(
          'Angajatul selectat nu aparține companiei dumneavoastră',
        );
      }
    }
    return this.create(createUserDto);
  }

  /**
   * user_roles are prioritate; dacă lipsesc, derivăm din position_default_id (5=magazioner, 4=șofer),
   * altfel rol/permisiuni baseline de angajat (evită JWT gol → 403 pe dashboard).
   */
  private async resolveTokenRolesAndPermissions(
    usersTableId: number,
    positionDefaultId: number | null | undefined,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const fromUser = await this.getUserRolesAndPermissions(usersTableId);
    if (fromUser.roles.length > 0 || fromUser.permissions.length > 0) {
      const withOperational = this.ensureCompaniesReadOwnForOperationalStaff(
        fromUser.roles,
        fromUser.permissions,
        positionDefaultId,
      );
      return {
        roles: fromUser.roles,
        permissions: this.ensurePlainEmployeeBaselinePermissions(
          fromUser.roles,
          withOperational,
        ),
      };
    }

    if (positionDefaultId === 5) {
      const resolved = await this.getRolesAndPermissionsByRoleName('magazioner');
      return {
        roles: resolved.roles,
        permissions: this.ensureCompaniesReadOwnForOperationalStaff(
          resolved.roles,
          resolved.permissions,
          5,
        ),
      };
    }
    if (positionDefaultId === 4) {
      const resolved = await this.getRolesAndPermissionsByRoleName('sofer');
      return {
        roles: resolved.roles,
        permissions: this.ensureCompaniesReadOwnForOperationalStaff(
          resolved.roles,
          resolved.permissions,
          4,
        ),
      };
    }

    return this.resolveDefaultEmployeeRolesAndPermissions();
  }

  /**
   * Șterge un utilizator după id_employee. Șterge mai întâi rolurile din user_roles (FK către users), apoi userul.
   */
  async remove(id_employee: number): Promise<void> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id_employee ${id_employee} nu a fost găsit`,
      );
    }
    await this.removeUserAndRoles(user.id, id_employee);
  }

  /**
   * Șterge un utilizator după user id (users.id). Folosit și intern, după ce user_roles sunt șterse.
   */
  async removeByUserId(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(
        `Utilizatorul cu id ${userId} nu a fost găsit`,
      );
    }
    await this.removeUserAndRoles(user.id, undefined);
  }

  private async removeUserAndRoles(
    userId: number,
    id_employee?: number,
  ): Promise<void> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
    });
    if (userRoles.length > 0) {
      await this.userRoleRepository.remove(userRoles);
    }
    if (id_employee != null) {
      await this.userRepository.delete({ id_employee });
    } else {
      await this.userRepository.delete({ id: userId });
    }
  }

  /**
   * Găsește un angajat după email din microserviciul employees
   */
  async findEmployeeByEmail(email: string): Promise<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    profile_image: string | null;
    birth_date: string | null;
    department_default_id: number | null;
    work_location_default_id: number | null;
  } | null> {
    try {
      // Add internal service authentication header
      const response = await firstValueFrom(
        this.httpService.get(
          `${process.env.EMPLOYEES_SERVICE_URL}/employees/email/${encodeURIComponent(email)}`,
          {
            headers: {
              'X-Internal-Service': 'auth-service',
              'X-Service-Secret':
                process.env.SERVICE_SECRET || '',
            },
          },
        ),
      );
      const data = response.data;
      // Ensure the response includes the required fields, defaulting to null if missing
      return {
        ...data,
        department_default_id: data?.department_default_id ?? null,
        work_location_default_id: data?.work_location_default_id ?? null,
      };
    } catch (error) {
      console.error('Eroare la găsirea angajatului după email:', error);
      return null;
    }
  }

  /**
   * Găsește un angajat după telefon din microserviciul employees
   */
  /**
   * Găsește un employee după ID
   */
  async findEmployeeById(employeeId: number): Promise<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    profile_image: string | null;
    birth_date: string | null;
    department_default_id: number | null;
    work_location_default_id: number | null;
    position_default_id: number | null;
  } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${process.env.EMPLOYEES_SERVICE_URL}/employees/${employeeId}`, {
          headers: {
            'X-Internal-Service': 'auth-service',
            'X-Service-Secret':
              process.env.SERVICE_SECRET || '',
          },
        }),
      );
      const employee = response.data?.data || response.data;
      if (!employee) {
        return null;
      }
      return {
        id: employee.id,
        email: employee.email || '',
        first_name: employee.first_name || employee.firstName || '',
        last_name: employee.last_name || employee.lastName || '',
        phone: employee.phone || '',
        profile_image: employee.profile_image || employee.profileImage || null,
        birth_date: employee.birth_date || employee.birthDate || null,
        department_default_id:
          employee.department_default_id ||
          employee.departmentDefaultId ||
          null,
        work_location_default_id:
          employee.work_location_default_id ||
          employee.workLocationDefaultId ||
          null,
        position_default_id:
          employee.position_default_id ??
          employee.positionDefaultId ??
          null,
      };
    } catch (error) {
      console.error(
        `Eroare la găsirea employee-ului cu ID ${employeeId}:`,
        error,
      );
      return null;
    }
  }

  async findEmployeeByPhone(phone: string): Promise<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string;
    profile_image: string | null;
    birth_date: string | null;
    department_default_id: number | null;
    work_location_default_id: number | null;
  } | null> {
    try {
      // Add internal service authentication header
      const response = await firstValueFrom(
        this.httpService.get(
          `${process.env.EMPLOYEES_SERVICE_URL}/employees/phone/${encodeURIComponent(phone)}`,
          {
            headers: {
              'X-Internal-Service': 'auth-service',
              'X-Service-Secret':
                process.env.SERVICE_SECRET || '',
            },
          },
        ),
      );
      const data = response.data;
      // Ensure the response includes the required fields, defaulting to null if missing
      return {
        ...data,
        department_default_id: data?.department_default_id ?? null,
        work_location_default_id: data?.work_location_default_id ?? null,
      };
    } catch (error) {
      console.error('Eroare la găsirea angajatului după telefon:', error);
      return null;
    }
  }

  /**
   * Găsește utilizatori după ID-urile lor și returnează doar informații de bază (pentru batch lookups)
   */
  async findUsersByIdsBasic(
    ids: number[],
  ): Promise<Array<Pick<User, 'id' | 'id_employee'>>> {
    if (!ids || ids.length === 0) {
      return [];
    }

    const uniqueIds = Array.from(new Set(ids));

    const users = await this.userRepository.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'id_employee'],
    });

    return users;
  }

  // ===== PERMISSIONS METHODS =====
  async createPermission(createPermissionDto: {
    name: string;
    group?: string;
    description?: string;
  }): Promise<Permission> {
    const permission = this.permissionRepository.create(createPermissionDto);
    return await this.permissionRepository.save(permission);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await this.permissionRepository.find();
  }

  // ===== ROLES CRUD METHODS =====
  async createRole(createRoleDto: {
    name: string;
    description?: string;
  }): Promise<Role> {
    const role = this.roleRepository.create(createRoleDto);
    return await this.roleRepository.save(role);
  }

  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find();
  }

  /**
   * Roles a requester may assign via user-roles APIs.
   * Platform / permissions.read → all roles.
   * Tenant users.assign_role → V1 allowlist only (angajat/magazioner/sofer).
   */
  async getAssignableRolesForRequester(
    requester: RequesterAuthContext | null | undefined,
    isInternal: boolean,
  ): Promise<Role[]> {
    if (
      isInternal ||
      this.isGlobalUsersAdmin(requester) ||
      hasPlatformRbacCatalogAccess(requester)
    ) {
      return this.getAllRoles();
    }
    const perms = requester?.permissions || [];
    if (!perms.includes('users.assign_role')) {
      throw new ForbiddenException(
        'Permisiuni insuficiente pentru listarea rolurilor atribuibile',
      );
    }
    const all = await this.getAllRoles();
    const allow = new Set(
      (CLIENT_ADMIN_ASSIGNABLE_ROLE_NAMES as readonly string[]).map((n) =>
        n.toLowerCase(),
      ),
    );
    return all.filter((r) => allow.has(normalizeRoleName(r.name)));
  }

  async getRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Rolul cu ID ${id} nu a fost găsit`);
    }
    return role;
  }

  async findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  async updateRole(
    id: number,
    updateRoleDto: { name?: string; description?: string },
  ): Promise<Role> {
    const role = await this.getRoleById(id);
    Object.assign(role, updateRoleDto);
    return await this.roleRepository.save(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getRoleById(id);
    await this.roleRepository.remove(role);
  }

  /** Detectează erori MySQL de duplicate-key / lipsă FK pentru role_permissions. */
  private mapRolePermissionQueryError(err: unknown): void {
    if (!(err instanceof QueryFailedError)) {
      return;
    }
    const driverError: { code?: string; errno?: number } =
      (err as { driverError?: { code?: string; errno?: number } }).driverError ??
      (err as { code?: string; errno?: number });
    const code = driverError?.code;
    const errno = driverError?.errno;
    if (code === 'ER_DUP_ENTRY' || errno === 1062) {
      throw new ConflictException('Asocierea rol-permisiune există deja');
    }
    if (
      code === 'ER_NO_REFERENCED_ROW' ||
      code === 'ER_NO_REFERENCED_ROW_2' ||
      errno === 1452
    ) {
      throw new BadRequestException('roleId sau permissionId nu există');
    }
  }

  // ===== ROLE_PERMISSIONS CRUD METHODS =====
  async createRolePermission(createRolePermissionDto: {
    roleId: number;
    permissionId: number;
  }): Promise<RolePermission> {
    const roleId = Number(createRolePermissionDto?.roleId);
    const permissionId = Number(createRolePermissionDto?.permissionId);

    if (!Number.isFinite(roleId) || roleId <= 0) {
      throw new BadRequestException('roleId trebuie să fie un număr pozitiv');
    }
    if (!Number.isFinite(permissionId) || permissionId <= 0) {
      throw new BadRequestException(
        'permissionId trebuie să fie un număr pozitiv',
      );
    }

    // Aruncă NotFoundException dacă rolul/permisiunea nu există.
    await this.getRoleById(roleId);
    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException(
        `Permisiunea cu ID ${permissionId} nu a fost găsită`,
      );
    }

    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });
    if (existing) {
      throw new ConflictException('Asocierea rol-permisiune există deja');
    }

    const rolePermission = this.rolePermissionRepository.create({
      roleId,
      permissionId,
    });
    try {
      return await this.rolePermissionRepository.save(rolePermission);
    } catch (err) {
      this.mapRolePermissionQueryError(err);
      throw err;
    }
  }

  async getAllRolePermissions(): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find();
  }

  async getRolePermissionsByRoleId(roleId: number): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find({
      where: { roleId },
    });
  }

  async getRolePermissionById(id: number): Promise<RolePermission> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { id },
    });
    if (!rolePermission) {
      throw new NotFoundException(
        `Asocierea rol-permisiune cu ID ${id} nu a fost găsită`,
      );
    }
    return rolePermission;
  }

  async updateRolePermission(
    id: number,
    updateRolePermissionDto: { roleId?: number; permissionId?: number },
  ): Promise<RolePermission> {
    const rolePermission = await this.getRolePermissionById(id);
    Object.assign(rolePermission, updateRolePermissionDto);
    return await this.rolePermissionRepository.save(rolePermission);
  }

  async deleteRolePermission(id: number): Promise<void> {
    const rolePermission = await this.getRolePermissionById(id);
    await this.rolePermissionRepository.remove(rolePermission);
  }

  /**
   * Șterge toate permisiunile pentru un rol într-un singur query (bulk delete)
   * Optimizare pentru a evita N+1 queries
   */
  async deleteRolePermissionsBulk(
    roleId: number,
  ): Promise<{ deleted: number }> {
    const result = await this.rolePermissionRepository.delete({ roleId });
    return { deleted: result.affected || 0 };
  }

  /**
   * Creează multiple asocieri rol-permisiune într-un singur request (bulk insert)
   * Optimizare pentru a evita N+1 queries
   */
  async createRolePermissionsBulk(
    roleId: number,
    permissionIds: number[],
  ): Promise<{ created: number; rolePermissions: RolePermission[] }> {
    const normalizedRoleId = Number(roleId);
    if (!Number.isFinite(normalizedRoleId) || normalizedRoleId <= 0) {
      throw new BadRequestException('roleId trebuie să fie un număr pozitiv');
    }
    if (!permissionIds || permissionIds.length === 0) {
      return { created: 0, rolePermissions: [] };
    }

    const normalizedPermissionIds = Array.from(
      new Set(
        permissionIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    );
    if (normalizedPermissionIds.length !== permissionIds.length) {
      throw new BadRequestException(
        'permissionIds conține valori invalide (numere pozitive necesare)',
      );
    }

    // Aruncă NotFoundException dacă rolul nu există.
    await this.getRoleById(normalizedRoleId);

    const existingPermissions = await this.permissionRepository.find({
      where: { id: In(normalizedPermissionIds) },
    });
    if (existingPermissions.length !== normalizedPermissionIds.length) {
      const foundIds = new Set(existingPermissions.map((p) => p.id));
      const missing = normalizedPermissionIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Permisiunile cu ID-urile [${missing.join(', ')}] nu au fost găsite`,
      );
    }

    // Verifică dacă permisiunile există deja pentru acest rol
    const existingRolePermissions = await this.rolePermissionRepository.find({
      where: {
        roleId: normalizedRoleId,
        permissionId: In(normalizedPermissionIds),
      },
    });

    const existingPermissionIds = new Set(
      existingRolePermissions.map((rp) => rp.permissionId),
    );

    // Filtrează doar permisiunile care nu există deja
    const newPermissionIds = normalizedPermissionIds.filter(
      (permissionId) => !existingPermissionIds.has(permissionId),
    );

    if (newPermissionIds.length === 0) {
      return { created: 0, rolePermissions: existingRolePermissions };
    }

    // Creează toate asocierile într-un singur bulk insert
    const rolePermissionsToCreate = newPermissionIds.map((permissionId) =>
      this.rolePermissionRepository.create({
        roleId: normalizedRoleId,
        permissionId,
      }),
    );

    let savedRolePermissions: RolePermission[];
    try {
      savedRolePermissions = await this.rolePermissionRepository.save(
        rolePermissionsToCreate,
      );
    } catch (err) {
      this.mapRolePermissionQueryError(err);
      throw err;
    }

    return {
      created: savedRolePermissions.length,
      rolePermissions: [...existingRolePermissions, ...savedRolePermissions],
    };
  }

  // ===== USER_ROLES CRUD METHODS =====
  async createUserRole(createUserRoleDto: {
    userId: number;
    roleId: number;
  }): Promise<UserRole> {
    const userRole = this.userRoleRepository.create(createUserRoleDto);
    return await this.userRoleRepository.save(userRole);
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return await this.userRoleRepository.find();
  }

  /**
   * Listează user_roles: platform/global = toate;
   * tenant (users.assign_role fără platform) = doar users din requester.company_id
   * (JWT company via employee → location → company).
   * Filtrele userId/roleId se aplică după scope și nu pot bypass cross-company.
   */
  async getAllUserRolesForRequester(
    requester: RequesterAuthContext | null | undefined,
    isInternal: boolean,
    filters?: UserRolesListFilters,
  ): Promise<UserRole[]> {
    const all = await this.getAllUserRoles();
    const global = shouldListUserRolesGlobally(requester, isInternal);

    let allowedUserIds: Set<number> | null = null;
    if (!global) {
      const companyId = Number(requester?.company_id);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return [];
      }
      const employeeIds = await this.findEmployeeIdsByCompany(companyId);
      if (employeeIds.length === 0) {
        return [];
      }
      const users = await this.userRepository.find({
        where: { id_employee: In(employeeIds) },
        select: ['id', 'id_employee'],
      });
      allowedUserIds = new Set(
        users
          .map((u) => Number(u.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      );
    }

    return filterUserRolesForRequester(all, {
      global,
      allowedUserIds,
      filters,
    }) as UserRole[];
  }

  async getUserRoleById(id: number): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({ where: { id } });
    if (!userRole) {
      throw new NotFoundException(
        `Asocierea utilizator-rol cu ID ${id} nu a fost găsită`,
      );
    }
    return userRole;
  }

  async updateUserRole(
    id: number,
    updateUserRoleDto: { userId?: number; roleId?: number },
  ): Promise<UserRole> {
    const userRole = await this.getUserRoleById(id);
    Object.assign(userRole, updateUserRoleDto);
    return await this.userRoleRepository.save(userRole);
  }

  async deleteUserRole(id: number): Promise<void> {
    const userRole = await this.getUserRoleById(id);
    await this.userRoleRepository.remove(userRole);
  }

  async deleteUserRolesByUserId(userId: number): Promise<void> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
    });

    if (userRoles.length === 0) {
      throw new NotFoundException(
        `Nu s-au găsit roluri pentru utilizatorul cu ID-ul ${userId}`,
      );
    }

    await this.userRoleRepository.remove(userRoles);
  }
}
