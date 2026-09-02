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
  NotFoundException,
  UseGuards,
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
import { AuthGuard, RolesGuard, Permissions, InternalServiceGuard } from '../guards';

type AuthedRequest = Request & {
  user?: Record<string, unknown>;
  bypassAuth?: boolean;
};

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
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('users.create')
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
  async create(
    @Req() req: AuthedRequest,
    @Body() createUserDto: CreateUserDto,
  ): Promise<User> {
    return this.usersService.createForRequester(req.user || {}, createUserDto);
  }

  @Get()
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('users.read')
  @ApiOperation({ summary: 'Returnează utilizatorii (opțional inclusiv dezactivați)' })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Dacă este "true", returnează toți utilizatorii, inclusiv cei dezactivați' })
  @ApiResponse({ status: 200, description: 'Lista utilizatorilor', type: [User] })
  async findAll(
    @Req() req: AuthedRequest,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<User[]> {
    return this.usersService.findAllForRequester(
      req.user || {},
      includeInactive === 'true',
    );
  }

  @Get('employee/:id_employee')
  @UseGuards(InternalServiceGuard, AuthGuard)
  @ApiOperation({ summary: 'Găsește un utilizator după id_employee' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 200, description: 'Utilizatorul găsit', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async findByEmployeeId(
    @Req() req: AuthedRequest,
    @Param('id_employee', ParseIntPipe) id_employee: number,
  ): Promise<User> {
    return this.usersService.findByEmployeeIdForRequester(
      req.user,
      id_employee,
      this.usersService.isInternalRequest(req),
    );
  }

  @Patch('employee/:id_employee')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('users.create')
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
    @Req() req: AuthedRequest,
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfileForRequester(
      req.user,
      id_employee,
      updateData,
      this.usersService.isInternalRequest(req),
    );
  }

  @Patch('employee/:id_employee/profile')
  @UseGuards(InternalServiceGuard, AuthGuard)
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
    @Req() req: AuthedRequest,
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateProfileForRequester(
      req.user,
      id_employee,
      updateData,
      this.usersService.isInternalRequest(req),
      true,
    );
  }

  @Patch('employee/:id_employee/profile-image')
  @UseGuards(InternalServiceGuard, AuthGuard)
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
    @Req() req: AuthedRequest,
    @Param('id_employee', ParseIntPipe) id_employee: number,
    @Body() updateData: { profile_image: string },
  ): Promise<User> {
    return this.usersService.updateProfileForRequester(
      req.user,
      id_employee,
      updateData,
      this.usersService.isInternalRequest(req),
      true,
    );
  }

  @Delete('employee/:id_employee')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('users.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge un utilizator după id_employee' })
  @ApiParam({ name: 'id_employee', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 204, description: 'Utilizatorul a fost șters cu succes' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async remove(
    @Req() req: AuthedRequest,
    @Param('id_employee', ParseIntPipe) id_employee: number,
  ): Promise<void> {
    return this.usersService.removeForRequester(
      req.user,
      id_employee,
      this.usersService.isInternalRequest(req),
    );
  }

  @Delete(':id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('users.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge un utilizator după user id (users.id)' })
  @ApiParam({ name: 'id', description: 'ID-ul utilizatorului (users.id)' })
  @ApiResponse({ status: 204, description: 'Utilizatorul a fost șters cu succes' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async removeByUserId(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.usersService.removeByUserIdForRequester(
      req.user,
      id,
      this.usersService.isInternalRequest(req),
    );
  }

  // ===== PERMISSIONS ENDPOINTS =====
  @Post('permissions')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
  async createPermission(
    @Req() req: AuthedRequest,
    @Body() createPermissionDto: { name: string; group?: string; description?: string },
  ): Promise<Permission> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.createPermission(createPermissionDto);
  }

  @Get('permissions')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Returnează toate permisiunile' })
  @ApiResponse({ status: 200, description: 'Lista permisiunilor', type: [Permission] })
  async getAllPermissions(
    @Req() req: AuthedRequest,
  ): Promise<Permission[]> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.getAllPermissions();
  }

  // ===== ROLES CRUD ENDPOINTS =====
  @Post('roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
  async createRole(
    @Req() req: AuthedRequest,
    @Body() createRoleDto: { name: string; description?: string },
  ): Promise<Role> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.createRole(createRoleDto);
  }

  @Get('roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Returnează toate rolurile' })
  @ApiResponse({ status: 200, description: 'Lista rolurilor', type: [Role] })
  async getAllRoles(@Req() req: AuthedRequest): Promise<Role[]> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.getAllRoles();
  }

  @Get('assignable-roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
  @ApiOperation({
    summary:
      'Returnează rolurile pe care requester-ul le poate atribui (global pentru platform; allowlist pentru client-admin)',
  })
  @ApiResponse({ status: 200, description: 'Lista rolurilor atribuibile', type: [Role] })
  async getAssignableRoles(@Req() req: AuthedRequest): Promise<Role[]> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    return this.usersService.getAssignableRolesForRequester(
      req.user,
      isInternal,
    );
  }

  @Get('roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Găsește un rol după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul rolului' })
  @ApiResponse({ status: 200, description: 'Rolul găsit', type: Role })
  @ApiResponse({ status: 404, description: 'Rolul nu a fost găsit' })
  async getRoleById(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Role> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.getRoleById(id);
  }

  @Patch('roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: { name?: string; description?: string },
  ): Promise<Role> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.updateRole(id, updateRoleDto);
  }

  @Delete('roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge un rol' })
  @ApiParam({ name: 'id', description: 'ID-ul rolului' })
  @ApiResponse({ status: 204, description: 'Rolul a fost șters cu succes' })
  @ApiResponse({ status: 404, description: 'Rolul nu a fost găsit' })
  async deleteRole(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.deleteRole(id);
  }

  // ===== ROLE_PERMISSIONS CRUD ENDPOINTS =====
  @Post('role-permissions')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
  async createRolePermission(
    @Req() req: AuthedRequest,
    @Body() createRolePermissionDto: { roleId: number; permissionId: number },
  ): Promise<RolePermission> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.createRolePermission(createRolePermissionDto);
  }

  @Get('role-permissions')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Returnează toate asocierile rol-permisiune sau filtrate după roleId' })
  @ApiQuery({ name: 'roleId', required: false, type: Number, description: 'ID-ul rolului pentru filtrare' })
  @ApiResponse({ status: 200, description: 'Lista asocierilor', type: [RolePermission] })
  async getAllRolePermissions(
    @Req() req: AuthedRequest,
    @Query('roleId') roleId?: string,
  ): Promise<RolePermission[]> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    if (roleId) {
      const roleIdNum = parseInt(roleId, 10);
      if (!isNaN(roleIdNum)) {
        return this.usersService.getRolePermissionsByRoleId(roleIdNum);
      }
    }
    return this.usersService.getAllRolePermissions();
  }

  @Get('role-permissions/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Găsește o asociere rol-permisiune după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 200, description: 'Asocierea găsită', type: RolePermission })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async getRolePermissionById(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RolePermission> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.getRolePermissionById(id);
  }

  @Patch('role-permissions/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRolePermissionDto: { roleId?: number; permissionId?: number },
  ): Promise<RolePermission> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.updateRolePermission(id, updateRolePermissionDto);
  }

  @Delete('role-permissions/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge o asociere rol-permisiune' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 204, description: 'Asocierea a fost ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async deleteRolePermission(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.deleteRolePermission(id);
  }

  @Post('role-permissions/bulk')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
  async createRolePermissionsBulk(
    @Req() req: AuthedRequest,
    @Body() bulkDto: { roleId: number; permissionIds: number[] },
  ): Promise<{ created: number; rolePermissions: RolePermission[] }> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.createRolePermissionsBulk(
      bulkDto.roleId,
      bulkDto.permissionIds,
    );
  }

  @Delete('role-permissions/bulk/:roleId')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read')
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
  async deleteRolePermissionsBulk(
    @Req() req: AuthedRequest,
    @Param('roleId', ParseIntPipe) roleId: number,
  ): Promise<{ deleted: number }> {
    await this.usersService.assertCanManageRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.deleteRolePermissionsBulk(roleId);
  }

  // ===== USER_ROLES CRUD ENDPOINTS =====
  @Post('user-roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
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
  async createUserRole(
    @Req() req: AuthedRequest,
    @Body() createUserRoleDto: { userId: number; roleId: number },
  ): Promise<UserRole> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    if (!isInternal) {
      await this.usersService.assertCanManageUserAccount(
        req.user,
        createUserRoleDto.userId,
        false,
      );
      await this.usersService.assertClientAdminRoleAssignmentAllowed(req.user, {
        targetUserId: createUserRoleDto.userId,
        roleId: createUserRoleDto.roleId,
        action: 'assign',
      });
    }
    return this.usersService.createUserRole(createUserRoleDto);
  }

  @Get('user-roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
  @ApiOperation({
    summary:
      'Returnează asocierile utilizator-rol (global pentru platform; doar propria companie pentru client-admin)',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: Number,
    description: 'Filtru opțional după userId (aplicat după scope tenant)',
  })
  @ApiQuery({
    name: 'roleId',
    required: false,
    type: Number,
    description: 'Filtru opțional după roleId (aplicat după scope tenant)',
  })
  @ApiResponse({ status: 200, description: 'Lista asocierilor', type: [UserRole] })
  async getAllUserRoles(
    @Req() req: AuthedRequest,
    @Query('userId') userId?: string,
    @Query('roleId') roleId?: string,
  ): Promise<UserRole[]> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    const parsedUserId = userId != null ? parseInt(userId, 10) : undefined;
    const parsedRoleId = roleId != null ? parseInt(roleId, 10) : undefined;
    return this.usersService.getAllUserRolesForRequester(req.user, isInternal, {
      userId:
        parsedUserId != null && Number.isFinite(parsedUserId)
          ? parsedUserId
          : undefined,
      roleId:
        parsedRoleId != null && Number.isFinite(parsedRoleId)
          ? parsedRoleId
          : undefined,
    });
  }

  @Get('user-roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
  @ApiOperation({ summary: 'Găsește o asociere utilizator-rol după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 200, description: 'Asocierea găsită', type: UserRole })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async getUserRoleById(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserRole> {
    await this.usersService.assertCanAssignUserRoles(
      req.user,
      this.usersService.isInternalRequest(req),
    );
    return this.usersService.getUserRoleById(id);
  }

  @Patch('user-roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
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
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRoleDto: { userId?: number; roleId?: number },
  ): Promise<UserRole> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    if (!isInternal) {
      const existing = await this.usersService.getUserRoleById(id);
      const targetUserId = updateUserRoleDto.userId ?? existing.userId;
      await this.usersService.assertCanManageUserAccount(
        req.user,
        targetUserId,
        false,
      );
      // Changing away from / onto roles: treat as replace (cannot strip own client-admin)
      await this.usersService.assertClientAdminRoleAssignmentAllowed(req.user, {
        targetUserId: existing.userId,
        existingUserRoleId: id,
        action: 'remove',
      });
      if (updateUserRoleDto.roleId != null) {
        await this.usersService.assertClientAdminRoleAssignmentAllowed(
          req.user,
          {
            targetUserId,
            roleId: updateUserRoleDto.roleId,
            action: 'assign',
          },
        );
      }
    }
    return this.usersService.updateUserRole(id, updateUserRoleDto);
  }

  @Delete('user-roles')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge toate rolurile pentru un utilizator' })
  @ApiQuery({ name: 'userId', description: 'ID-ul utilizatorului', required: true, type: Number })
  @ApiResponse({ status: 204, description: 'Rolurile au fost șterse cu succes' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit sau nu are roluri' })
  async deleteUserRolesByUserId(
    @Req() req: AuthedRequest,
    @Query('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    if (!isInternal) {
      await this.usersService.assertCanManageUserAccount(req.user, userId, false);
      await this.usersService.assertClientAdminRoleAssignmentAllowed(req.user, {
        targetUserId: userId,
        action: 'remove',
      });
    }
    return this.usersService.deleteUserRolesByUserId(userId);
  }

  @Delete('user-roles/:id')
  @UseGuards(InternalServiceGuard, AuthGuard, RolesGuard)
  @Permissions('permissions.read', 'users.assign_role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Șterge o asociere utilizator-rol' })
  @ApiParam({ name: 'id', description: 'ID-ul asocierii' })
  @ApiResponse({ status: 204, description: 'Asocierea a fost ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Asocierea nu a fost găsită' })
  async deleteUserRole(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    const isInternal = this.usersService.isInternalRequest(req);
    await this.usersService.assertCanAssignUserRoles(req.user, isInternal);
    if (!isInternal) {
      const userRole = await this.usersService.getUserRoleById(id);
      await this.usersService.assertCanManageUserAccount(
        req.user,
        userRole.userId,
        false,
      );
      await this.usersService.assertClientAdminRoleAssignmentAllowed(req.user, {
        targetUserId: userRole.userId,
        existingUserRoleId: id,
        action: 'remove',
      });
    }
    return this.usersService.deleteUserRole(id);
  }

  @Get('batch')
  @UseGuards(InternalServiceGuard, AuthGuard)
  @ApiOperation({ summary: 'Obține informații de bază pentru o listă de utilizatori' })
  @ApiQuery({
    name: 'ids',
    required: true,
    description: 'Lista de ID-uri de utilizatori, separate prin virgulă (ex: 1,2,3)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista utilizatorilor a fost returnată cu succes',
    type: [User],
  })
  async findUsersBatch(
    @Req() req: AuthedRequest,
    @Query('ids') ids: string,
  ): Promise<Array<Pick<User, 'id' | 'id_employee'>>> {
    if (!ids) {
      return [];
    }

    const idList = ids
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (idList.length === 0) {
      return [];
    }

    return this.usersService.findUsersByIdsBasicForRequester(
      req.user,
      idList,
      this.usersService.isInternalRequest(req),
    );
  }

  @Get(':id')
  @UseGuards(InternalServiceGuard, AuthGuard)
  @ApiOperation({ summary: 'Găsește un utilizator după ID' })
  @ApiParam({ name: 'id', description: 'ID-ul utilizatorului' })
  @ApiResponse({ status: 200, description: 'Utilizatorul găsit', type: User })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async findOne(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<any> {
    const user = await this.usersService.findOneForRequester(
      req.user,
      id,
      this.usersService.isInternalRequest(req),
    );
    // Handle profile image URL properly
    let profileImageUrl = user.profile_image;
    if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
      // This is a direct file path, we need to convert it to an API proxy URL
      // For now, we'll return empty string to use default avatar
      // In a real implementation, we would need to find the file ID and create the proper URL
      profileImageUrl = '';
    }
    // If this is already an API proxy URL, keep it as is
    else if (profileImageUrl && profileImageUrl.startsWith('/api/')) {
      profileImageUrl = profileImageUrl;
    }
    
    // Fetch employee email
    try {
      const employeeResponse = await firstValueFrom(
        this.httpService.get(`http://localhost:3012/employees/${user.id_employee}`, {
          headers: {
            'x-internal-service': 'auth',
            'x-service-secret': process.env.SERVICE_SECRET || ''
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
  @UseGuards(InternalServiceGuard, AuthGuard)
  @ApiOperation({ summary: 'Obține imaginea de profil pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({ status: 200, description: 'Imaginea de profil a utilizatorului' })
  @ApiResponse({ status: 404, description: 'Utilizatorul nu a fost găsit' })
  async getProfileImage(
    @Req() req: AuthedRequest,
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<any> {
    console.log(`📥 Request for profile image for employee ${employeeId}`);

    try {
      const user = await this.usersService.findByEmployeeIdForRequester(
        req.user,
        employeeId,
        this.usersService.isInternalRequest(req),
      );
      console.log(`✅ Found user ${user.id} for employee ${employeeId}`);
      
      // Handle profile image URL properly
      let profileImageUrl = user.profile_image;
      if (profileImageUrl && profileImageUrl.startsWith('/files/')) {
        // This is a direct file path, we need to convert it to an API proxy URL
        // For now, we'll return empty string to use default avatar
        // In a real implementation, we would need to find the file ID and create the proper URL
        profileImageUrl = '';
      }
      // If this is already an API proxy URL, keep it as is
      else if (profileImageUrl && profileImageUrl.startsWith('/api/')) {
        profileImageUrl = profileImageUrl;
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
