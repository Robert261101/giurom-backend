import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { firstValueFrom } from 'rxjs';

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

  /**
   * Creează un utilizator nou
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Verifică dacă există deja un utilizator cu acest id_employee
    const existingUser = await this.userRepository.findOne({
      where: { id_employee: createUserDto.id_employee }
    });

    if (existingUser) {
      throw new ConflictException(`Utilizatorul cu id_employee ${createUserDto.id_employee} există deja`);
    }

    // Hash-uiește parola
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // Creează utilizatorul
    const user = this.userRepository.create({
      id_employee: createUserDto.id_employee,
      password: hashedPassword,
      profile_image: createUserDto.profile_image || null,
      is_active: createUserDto.is_active ?? true,
      is_2fa: createUserDto.is_2fa ?? false,
    });

    return await this.userRepository.save(user);
  }

  /**
   * Găsește un utilizator după id_employee
   */
  async findByEmployeeId(id_employee: number): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { id_employee }
    });
  }

  /**
   * Găsește un utilizator după id_employee cu parola inclusă
   */
  async findByEmployeeIdWithPassword(id_employee: number): Promise<User | null> {
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
      where: { id }
    });
  }

  /**
   * Găsește toți utilizatorii activi
   */
  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      where: { is_active: true }
    });
  }

  /**
   * Actualizează parola unui utilizator
   */
  async updatePassword(id_employee: number, newPassword: string): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.userRepository.update(
      { id_employee },
      { password: hashedPassword }
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return updatedUser;
  }

  /**
   * Actualizează imaginea de profil a unui utilizator
   */
  async updateProfileImage(id_employee: number, profileImageUrl: string): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    // If this is a direct file path, convert it to an API proxy URL
    let apiProxyUrl = profileImageUrl;
    if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
      // This is a direct file path, we need to convert it to an API proxy URL
      // For now, we'll store empty string to use default avatar
      // In a real implementation, we would need to find the file ID and create the proper URL
      apiProxyUrl = '';
    }

    await this.userRepository.update(
      { id_employee },
      { profile_image: apiProxyUrl }
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return updatedUser;
  }

  /**
   * Actualizează statusul activ al unui utilizator
   */
  async updateActiveStatus(id_employee: number, is_active: boolean): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    await this.userRepository.update(
      { id_employee },
      { is_active }
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return updatedUser;
  }

  /**
   * Actualizează statusul 2FA al unui utilizator
   */
  async update2FAStatus(id_employee: number, is_2fa: boolean): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    await this.userRepository.update(
      { id_employee },
      { is_2fa }
    );

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return updatedUser;
  }

  /**
   * Verifică parola unui utilizator
   */
  async validatePassword(id_employee: number, password: string): Promise<boolean> {
    const user = await this.findByEmployeeIdWithPassword(id_employee);
    if (!user) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  /**
   * Actualizează profilul complet al unui utilizator
   */
  async updateProfile(id_employee: number, updateData: UpdateUserDto): Promise<User> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    // Pregătește datele pentru actualizare
    const updateFields: any = {};
    
    if (updateData.password) {
      const saltRounds = 10;
      updateFields.password = await bcrypt.hash(updateData.password, saltRounds);
    }
    
    // Handle profile image URL conversion if needed
    if (updateData.profile_image !== undefined) {
      let profileImageUrl = updateData.profile_image;
      if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
        // This is a direct file path, we need to convert it to an API proxy URL
        // For now, we'll store empty string to use default avatar
        // In a real implementation, we would need to find the file ID and create the proper URL
        profileImageUrl = '';
      }
      updateFields.profile_image = profileImageUrl;
    }
    
    if (updateData.is_active !== undefined) updateFields.is_active = updateData.is_active;
    if (updateData.is_2fa !== undefined) updateFields.is_2fa = updateData.is_2fa;

    await this.userRepository.update({ id_employee }, updateFields);

    const updatedUser = await this.findByEmployeeId(id_employee);
    if (!updatedUser) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return updatedUser;
  }

  /**
   * Get user roles by user id
   */
  async getUserRoles(userId: number): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role']
    });

    return userRoles.map(userRole => userRole.role);
  }

  /**
   * Get user permissions by user id
   */
  async getUserPermissions(userId: number): Promise<Permission[]> {
    // First get user roles
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role']
    });

    // Then get role permissions
    const roleIds = userRoles.map(userRole => userRole.roleId);
    if (roleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: In(roleIds) },
      relations: ['permission']
    });

    // Extract unique permissions
    const permissions = rolePermissions.map(rp => rp.permission);
    const uniquePermissions = permissions.filter((permission, index, self) => 
      index === self.findIndex(p => p.id === permission.id)
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
  async getUserPermissionsByEmployeeId(employeeId: number): Promise<Permission[]> {
    const user = await this.findByEmployeeId(employeeId);
    if (!user) {
      return [];
    }
    return this.getUserPermissions(user.id);
  }

  /**
   * Obține roles și permissions pentru un utilizator
   */
  async getUserRolesAndPermissions(userId: number): Promise<{ roles: string[]; permissions: string[] }> {
    try {
      // Obține toate role-urile utilizatorului
      const userRoles = await this.userRoleRepository
        .createQueryBuilder('ur')
        .leftJoinAndSelect('ur.role', 'role')
        .where('ur.userId = :userId', { userId })
        .getMany();

      const roles = userRoles.map(ur => ur.role.name);

      // Obține toate permisiunile pentru role-urile utilizatorului
      const roleIds = userRoles.map(ur => ur.roleId);
      
      let permissions: string[] = [];
      if (roleIds.length > 0) {
        const rolePermissions = await this.rolePermissionRepository
          .createQueryBuilder('rp')
          .leftJoinAndSelect('rp.permission', 'permission')
          .where('rp.roleId IN (:...roleIds)', { roleIds })
          .getMany();

        permissions = rolePermissions.map(rp => rp.permission.name);
      }

      return { roles, permissions };
    } catch (error) {
      console.error('Eroare la obținerea roles și permissions:', error);
      return { roles: [], permissions: [] };
    }
  }

  /**
   * Șterge un utilizator
   */
  async remove(id_employee: number): Promise<void> {
    const user = await this.findByEmployeeId(id_employee);
    if (!user) {
      throw new NotFoundException(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }

    await this.userRepository.delete({ id_employee });
  }

  /**
   * Găsește un angajat după email din microserviciul employees
   */
  async findEmployeeByEmail(email: string): Promise<{ id: number; email: string; first_name: string; last_name: string; phone: string; profile_image: string | null; birth_date: string | null; department_default_id: number | null; work_location_default_id: number | null } | null> {
    try {
      // Add internal service authentication header
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/email/${encodeURIComponent(email)}`, {
          headers: {
            'X-Internal-Service': 'auth-service',
            'X-Service-Secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
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
  async findEmployeeById(employeeId: number): Promise<{ id: number; email: string; first_name: string; last_name: string; phone: string; profile_image: string | null; birth_date: string | null; department_default_id: number | null; work_location_default_id: number | null } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/${employeeId}`, {
          headers: {
            'X-Internal-Service': 'auth-service',
            'X-Service-Secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
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
        department_default_id: employee.department_default_id || employee.departmentDefaultId || null,
        work_location_default_id: employee.work_location_default_id || employee.workLocationDefaultId || null
      };
    } catch (error) {
      console.error(`Eroare la găsirea employee-ului cu ID ${employeeId}:`, error);
      return null;
    }
  }

  async findEmployeeByPhone(phone: string): Promise<{ id: number; email: string; first_name: string; last_name: string; phone: string; profile_image: string | null; birth_date: string | null; department_default_id: number | null; work_location_default_id: number | null } | null> {
    try {
      // Add internal service authentication header
      const response = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/phone/${encodeURIComponent(phone)}`, {
          headers: {
            'X-Internal-Service': 'auth-service',
            'X-Service-Secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
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

  // ===== PERMISSIONS METHODS =====
  async createPermission(createPermissionDto: { name: string; group?: string; description?: string }): Promise<Permission> {
    const permission = this.permissionRepository.create(createPermissionDto);
    return await this.permissionRepository.save(permission);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await this.permissionRepository.find();
  }

  // ===== ROLES CRUD METHODS =====
  async createRole(createRoleDto: { name: string; description?: string }): Promise<Role> {
    const role = this.roleRepository.create(createRoleDto);
    return await this.roleRepository.save(role);
  }

  async getAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find();
  }

  async getRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException(`Rolul cu ID ${id} nu a fost găsit`);
    }
    return role;
  }

  async updateRole(id: number, updateRoleDto: { name?: string; description?: string }): Promise<Role> {
    const role = await this.getRoleById(id);
    Object.assign(role, updateRoleDto);
    return await this.roleRepository.save(role);
  }

  async deleteRole(id: number): Promise<void> {
    const role = await this.getRoleById(id);
    await this.roleRepository.remove(role);
  }

  // ===== ROLE_PERMISSIONS CRUD METHODS =====
  async createRolePermission(createRolePermissionDto: { roleId: number; permissionId: number }): Promise<RolePermission> {
    const rolePermission = this.rolePermissionRepository.create(createRolePermissionDto);
    return await this.rolePermissionRepository.save(rolePermission);
  }

  async getAllRolePermissions(): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find();
  }

  async getRolePermissionsByRoleId(roleId: number): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find({ 
      where: { roleId } 
    });
  }

  async getRolePermissionById(id: number): Promise<RolePermission> {
    const rolePermission = await this.rolePermissionRepository.findOne({ where: { id } });
    if (!rolePermission) {
      throw new NotFoundException(`Asocierea rol-permisiune cu ID ${id} nu a fost găsită`);
    }
    return rolePermission;
  }

  async updateRolePermission(id: number, updateRolePermissionDto: { roleId?: number; permissionId?: number }): Promise<RolePermission> {
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
  async deleteRolePermissionsBulk(roleId: number): Promise<{ deleted: number }> {
    const result = await this.rolePermissionRepository.delete({ roleId });
    return { deleted: result.affected || 0 };
  }

  /**
   * Creează multiple asocieri rol-permisiune într-un singur request (bulk insert)
   * Optimizare pentru a evita N+1 queries
   */
  async createRolePermissionsBulk(roleId: number, permissionIds: number[]): Promise<{ created: number; rolePermissions: RolePermission[] }> {
    if (!permissionIds || permissionIds.length === 0) {
      return { created: 0, rolePermissions: [] };
    }

    // Verifică dacă permisiunile există deja pentru acest rol
    const existingRolePermissions = await this.rolePermissionRepository.find({
      where: { 
        roleId,
        permissionId: In(permissionIds)
      }
    });

    const existingPermissionIds = new Set(existingRolePermissions.map(rp => rp.permissionId));
    
    // Filtrează doar permisiunile care nu există deja
    const newPermissionIds = permissionIds.filter(permissionId => !existingPermissionIds.has(permissionId));

    if (newPermissionIds.length === 0) {
      return { created: 0, rolePermissions: existingRolePermissions };
    }

    // Creează toate asocierile într-un singur bulk insert
    const rolePermissionsToCreate = newPermissionIds.map(permissionId => 
      this.rolePermissionRepository.create({ roleId, permissionId })
    );

    const savedRolePermissions = await this.rolePermissionRepository.save(rolePermissionsToCreate);

    return { 
      created: savedRolePermissions.length, 
      rolePermissions: [...existingRolePermissions, ...savedRolePermissions]
    };
  }

  // ===== USER_ROLES CRUD METHODS =====
  async createUserRole(createUserRoleDto: { userId: number; roleId: number }): Promise<UserRole> {
    const userRole = this.userRoleRepository.create(createUserRoleDto);
    return await this.userRoleRepository.save(userRole);
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return await this.userRoleRepository.find();
  }

  async getUserRoleById(id: number): Promise<UserRole> {
    const userRole = await this.userRoleRepository.findOne({ where: { id } });
    if (!userRole) {
      throw new NotFoundException(`Asocierea utilizator-rol cu ID ${id} nu a fost găsită`);
    }
    return userRole;
  }

  async updateUserRole(id: number, updateUserRoleDto: { userId?: number; roleId?: number }): Promise<UserRole> {
    const userRole = await this.getUserRoleById(id);
    Object.assign(userRole, updateUserRoleDto);
    return await this.userRoleRepository.save(userRole);
  }

  async deleteUserRole(id: number): Promise<void> {
    const userRole = await this.getUserRoleById(id);
    await this.userRoleRepository.remove(userRole);
  }
} 
