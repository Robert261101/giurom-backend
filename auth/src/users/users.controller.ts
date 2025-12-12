import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  PipeTransform,
  ArgumentMetadata,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Pipe custom care nu validează nimic - doar returnează valoarea
@Injectable()
class NoValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    return value;
  }
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly httpService: HttpService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Creează un utilizator nou' })
  @ApiBody({
    description: 'Datele pentru crearea unui utilizator nou',
    examples: {
      'exemplu-utilizator': {
        summary: 'Exemplu utilizator complet',
        value: {
          id_employee: 123,
          password: 'parola123',
          profile_image: 'https://example.com/avatar.jpg',
          is_active: true,
          is_2fa: false
        }
      },
      'exemplu-minimal': {
        summary: 'Exemplu cu date minime',
        value: {
          id_employee: 456,
          password: 'parola456'
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Utilizatorul a fost creat cu succes', type: User })
  @ApiResponse({ status: 409, description: 'Utilizatorul cu acest id_employee există deja' })
  async create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Returnează toți utilizatorii activi' })
  @ApiResponse({ status: 200, description: 'Lista utilizatorilor', type: [User] })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get('employee/:id_employee')
  @ApiOperation({ summary: 'Găsește un utilizator după id_employee' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 200, description: 'Utilizatorul găsit', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async findByEmployeeId(@Param('id_employee', ParseIntPipe) id_employee: number): Promise<User> {
    const user = await this.usersService.findByEmployeeId(id_employee);
    if (!user) {
      throw new Error(`Utilizatorul cu id_employee ${id_employee} nu a fost găsit`);
    }
    return user;
  }

  @Patch('employee/:id_employee')
  @ApiOperation({ summary: 'Actualizează un utilizator' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiBody({
    description: 'Datele pentru actualizarea unui utilizator',
    examples: {
      'exemplu-actualizare': {
        summary: 'Exemplu actualizare completă',
        value: {
          profile_image: 'https://example.com/new-avatar.jpg',
          is_active: true,
          is_2fa: true
        }
      },
      'exemplu-parola': {
        summary: 'Exemplu actualizare parolă',
        value: {
          password: 'nouaParola123'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Utilizatorul a fost actualizat cu succes', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async update(
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfile(id_employee, updateData);
  }

  @Patch('employee/:id_employee/profile')
  @ApiOperation({ summary: 'Actualizează profilul unui utilizator' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiBody({
    description: 'Datele pentru actualizarea profilului',
    examples: {
      'exemplu-profil': {
        summary: 'Exemplu actualizare profil',
        value: {
          profile_image: 'https://example.com/profile.jpg',
          is_active: true
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Profilul a fost actualizat cu succes', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async updateProfile(
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfile(id_employee, updateData);
  }

  @Patch('employee/:id_employee/profile-image')
  @ApiOperation({ summary: 'Actualizează imaginea de profil a unui utilizator' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiBody({
    description: 'URL-ul noii imagini de profil',
    examples: {
      'exemplu-imagine': {
        summary: 'Exemplu actualizare imagine profil',
        value: {
          profile_image: 'https://example.com/new-avatar.png'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Imaginea de profil a fost actualizată cu succes', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async updateProfileImage(
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: { profile_image: string },
  ): Promise<User> {
    return this.usersService.updateProfile(id_employee, updateData);
  }

  @Delete('employee/:id_employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge un utilizator' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 204, description: 'Utilizatorul a fost șters cu succes' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async remove(@Param('id_employee', ParseIntPipe) id_employee: number): Promise<void> {
    return this.usersService.remove(id_employee);
  }

  // ===== PERMISSIONS ENDPOINTS =====
  @Post('permissions')
  @ApiOperation({ summary: 'Creează o permisiune nouă' })
  @ApiBody({
    description: 'Datele pentru crearea unei permisiuni noi',
    examples: {
      'exemplu-permisiune': {
        summary: 'Exemplu permisiune completă',
        value: {
          name: 'users.create',
          group: 'users',
          description: 'Permite crearea de utilizatori noi'
        }
      },
      'exemplu-minimal': {
        summary: 'Exemplu cu date minime',
        value: {
          name: 'dashboard.view'
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Permisiunea a fost creată cu succes', type: Permission })
  async createPermission(@Body() createPermissionDto: { name: string; group?: string; description?: string }): Promise<Permission> {
    return this.usersService.createPermission(createPermissionDto);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Returnează toate permisiunile' })
  @ApiResponse({ status: 200, description: 'Lista permisiunilor', type: [Permission] })
  async getAllPermissions(): Promise<Permission[]> {
    return this.usersService.getAllPermissions();
  }

  // ===== ROLES CRUD ENDPOINTS =====
  @Post('roles')
  @ApiOperation({ summary: 'Creează un rol nou' })
  @ApiBody({
    description: 'Datele pentru crearea unui rol nou',
    examples: {
      'exemplu-rol': {
        summary: 'Exemplu rol complet',
        value: {
          name: 'Administrator',
          description: 'Rol cu acces complet la toate funcționalitățile sistemului'
        }
      },
      'exemplu-minimal': {
        summary: 'Exemplu cu date minime',
        value: {
          name: 'User'
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Rolul a fost creat cu succes', type: Role })
  async createRole(@Body() createRoleDto: { name: string; description?: string }): Promise<Role> {
    return this.usersService.createRole(createRoleDto);
  }

  @Get('roles')
  @ApiOperation({ summary: 'Returnează toate rolurile' })
  @ApiResponse({ status: 200, description: 'Lista rolurilor', type: [Role] })
  async getAllRoles(): Promise<Role[]> {
    return this.usersService.getAllRoles();
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Găsește un rol după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul rolului' })
  @ApiResponse({ status: 200, description: 'Rolul găsit', type: Role })
  @ApiResponse({ status: 404, description: 'Rolul nu a fost găsit' })
  async getRoleById(@Param('id', ParseIntPipe) id: number): Promise<Role> {
    return this.usersService.getRoleById(id);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Actualizează un rol' })
  @ApiParam({ name: 'id', description: 'ID-ul rolului' })
  @ApiBody({
    description: 'Datele pentru actualizarea unui rol',
    examples: {
      'exemplu-actualizare': {
        summary: 'Exemplu actualizare completă',
        value: {
          name: 'Super Administrator',
          description: 'Rol cu acces extins la toate funcționalitățile'
        }
      },
      'exemplu-descriere': {
        summary: 'Exemplu actualizare doar descriere',
        value: {
          description: 'Descriere actualizată pentru rol'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Rolul a fost actualizat cu succes', type: Role })
  @ApiResponse({ status: 404, description: 'Rolul nu a fost găsit' })
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: { name?: string; description?: string }
  ): Promise<Role> {
    return this.usersService.updateRole(id, updateRoleDto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge un rol' })
  @ApiParam({ name: 'id', description: 'ID-ul rolului' })
  @ApiResponse({ status: 204, description: 'Rolul a fost șters cu succes' })
  @ApiResponse({ status: 404, description: 'Rolul nu a fost găsit' })
  async deleteRole(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.deleteRole(id);
  }

  // ===== ROLE_PERMISSIONS CRUD ENDPOINTS =====
  @Post('role-permissions')
  @ApiOperation({ summary: 'Creează o asociere rol-permisiune' })
  @ApiBody({
    description: 'Datele pentru crearea unei asocieri rol-permisiune',
    examples: {
      'exemplu-asociere': {
        summary: 'Exemplu asociere rol-permisiune',
        value: {
          roleId: 1,
          permissionId: 3
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Asocierea a fost creată cu succes', type: RolePermission })
  async createRolePermission(@Body() createRolePermissionDto: { roleId: number; permissionId: number }): Promise<RolePermission> {
    return this.usersService.createRolePermission(createRolePermissionDto);
  }

  @Get('role-permissions')
  @ApiOperation({ summary: 'Returnează toate asocierile rol-permisiune sau filtrate după roleId' })
  @ApiQuery({ name: 'roleId', required: false, type: Number, description: 'ID-ul rolului pentru filtrare' })
  @ApiResponse({ status: 200, description: 'Lista asocierilor', type: [RolePermission] })
  async getAllRolePermissions(@Query('roleId') roleId?: string): Promise<RolePermission[]> {
    if (roleId) {
      const roleIdNum = parseInt(roleId, 10);
      if (!isNaN(roleIdNum)) {
        return this.usersService.getRolePermissionsByRoleId(roleIdNum);
      }
    }
    return this.usersService.getAllRolePermissions();
  }

  @Get('role-permissions/:id')
  @ApiOperation({ summary: 'Găsește o asociere rol-permisiune după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 200, description: 'Asocierea găsită', type: RolePermission })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async getRolePermissionById(@Param('id', ParseIntPipe) id: number): Promise<RolePermission> {
    return this.usersService.getRolePermissionById(id);
  }

  @Patch('role-permissions/:id')
  @ApiOperation({ summary: 'Actualizează o asociere rol-permisiune' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiBody({
    description: 'Datele pentru actualizarea unei asocieri rol-permisiune',
    examples: {
      'exemplu-actualizare': {
        summary: 'Exemplu actualizare asociere',
        value: {
          roleId: 2,
          permissionId: 5
        }
      },
      'exemplu-rol': {
        summary: 'Exemplu actualizare doar rol',
        value: {
          roleId: 3
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Asocierea a fost actualizată cu succes', type: RolePermission })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async updateRolePermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRolePermissionDto: { roleId?: number; permissionId?: number }
  ): Promise<RolePermission> {
    return this.usersService.updateRolePermission(id, updateRolePermissionDto);
  }

  @Delete('role-permissions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge o asociere rol-permisiune' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 204, description: 'Asocierea a fost ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async deleteRolePermission(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.deleteRolePermission(id);
  }

  @Post('role-permissions/bulk')
  @ApiOperation({ summary: 'Creează multiple asocieri rol-permisiune într-un singur request (bulk insert)' })
  @ApiBody({
    description: 'Datele pentru crearea în bulk a asocierilor rol-permisiune',
    examples: {
      'exemplu-bulk': {
        summary: 'Exemplu bulk insert',
        value: {
          roleId: 1,
          permissionIds: [1, 2, 3, 4, 5]
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Asocierile au fost create cu succes',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number', description: 'Numărul de asocieri create' },
        rolePermissions: { type: 'array', items: { type: 'object' } }
      }
    }
  })
  async createRolePermissionsBulk(@Body() bulkDto: { roleId: number; permissionIds: number[] }): Promise<{ created: number; rolePermissions: RolePermission[] }> {
    return this.usersService.createRolePermissionsBulk(bulkDto.roleId, bulkDto.permissionIds);
  }

  @Delete('role-permissions/bulk/:roleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Șterge toate permisiunile pentru un rol într-un singur request (bulk delete)' })
  @ApiParam({ name: 'roleId', required: true, type: Number, description: 'ID-ul rolului pentru care se șterg permisiunile' })
  @ApiResponse({ 
    status: 200, 
    description: 'Permisiunile au fost șterse cu succes',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'number', description: 'Numărul de permisiuni șterse' }
      }
    }
  })
  async deleteRolePermissionsBulk(@Param('roleId', ParseIntPipe) roleId: number): Promise<{ deleted: number }> {
    return this.usersService.deleteRolePermissionsBulk(roleId);
  }

  // ===== USER_ROLES CRUD ENDPOINTS =====
  @Post('user-roles')
  @ApiOperation({ summary: 'Creează o asociere utilizator-rol' })
  @ApiBody({
    description: 'Datele pentru crearea unei asocieri utilizator-rol',
    examples: {
      'exemplu-asociere': {
        summary: 'Exemplu asociere utilizator-rol',
        value: {
          userId: 123,
          roleId: 2
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Asocierea a fost creată cu succes', type: UserRole })
  async createUserRole(@Body() createUserRoleDto: { userId: number; roleId: number }): Promise<UserRole> {
    return this.usersService.createUserRole(createUserRoleDto);
  }

  @Get('user-roles')
  @ApiOperation({ summary: 'Returnează toate asocierile utilizator-rol' })
  @ApiResponse({ status: 200, description: 'Lista asocierilor', type: [UserRole] })
  async getAllUserRoles(): Promise<UserRole[]> {
    return this.usersService.getAllUserRoles();
  }

  @Get('user-roles/:id')
  @ApiOperation({ summary: 'Găsește o asociere utilizator-rol după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 200, description: 'Asocierea găsită', type: UserRole })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async getUserRoleById(@Param('id', ParseIntPipe) id: number): Promise<UserRole> {
    return this.usersService.getUserRoleById(id);
  }

  @Patch('user-roles/:id')
  @ApiOperation({ summary: 'Actualizează o asociere utilizator-rol' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiBody({
    description: 'Datele pentru actualizarea unei asocieri utilizator-rol',
    examples: {
      'exemplu-actualizare': {
        summary: 'Exemplu actualizare asociere',
        value: {
          userId: 456,
          roleId: 3
        }
      },
      'exemplu-rol': {
        summary: 'Exemplu actualizare doar rol',
        value: {
          roleId: 1
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Asocierea a fost actualizată cu succes', type: UserRole })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRoleDto: { userId?: number; roleId?: number }
  ): Promise<UserRole> {
    return this.usersService.updateUserRole(id, updateUserRoleDto);
  }

  @Delete('user-roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge o asociere utilizator-rol' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 204, description: 'Asocierea a fost ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async deleteUserRole(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.usersService.deleteUserRole(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Găsește un utilizator după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul utilizatorului' })
  @ApiResponse({ status: 200, description: 'Utilizatorul găsit', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<any> {
    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new Error(`Utilizatorul cu ID ${id} nu a fost găsit`);
    }
    
    // Convert direct file path to API proxy URL if needed
    let profileImageUrl = user.profile_image;
    if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
      // This is a direct file path, we need to convert it to an API proxy URL
      // For now, we'll return empty string to use default avatar
      // In a real implementation, we would need to find the file ID and create the proper URL
      profileImageUrl = '';
    }
    
    // Fetch employee email
    try {
      const employeeResponse = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/${user.id_employee}`, {
          headers: {
            'x-internal-service': 'auth',
            'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret'
          }
        })
      );
      const employee = employeeResponse.data;
      
      return {
        ...user,
        profile_image: profileImageUrl || '',
        email: employee.email || null
      };
    } catch (error) {
      // Return user without email if employee fetch fails
      console.warn(`Could not fetch employee ${user.id_employee} for user ${id}:`, error);
      return {
        ...user,
        profile_image: profileImageUrl || '',
        email: null
      };
    }
  }

  @Get('employee/:employeeId/profile-image')
  @ApiOperation({ summary: 'Obține imaginea de profil pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 200, description: 'Imaginea de profil a utilizatorului' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async getProfileImage(@Param('employeeId', ParseIntPipe) employeeId: number): Promise<any> {
    console.log(`📥 Request for profile image for employee ${employeeId}`);
    
    try {
      // Get user by employee ID
      const user = await this.usersService.findByEmployeeId(employeeId);
      if (!user) {
        throw new Error(`Utilizatorul cu ID angajat ${employeeId} nu a fost găsit`);
      }
      
      console.log(`✅ Found user ${user.id} for employee ${employeeId}`);
      
      // Convert direct file path to API proxy URL if needed
      let profileImageUrl = user.profile_image;
      if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
        // This is a direct file path, we need to convert it to an API proxy URL
        // For now, we'll return empty string to use default avatar
        // In a real implementation, we would need to find the file ID and create the proper URL
        profileImageUrl = '';
      }
      
      // Return profile image URL
      return {
        data: {
          profile_image: profileImageUrl || ''
        }
      };
    } catch (error) {
      console.error(`❌ Error getting profile image for employee ${employeeId}:`, error);
      throw error;
    }
  }
}
