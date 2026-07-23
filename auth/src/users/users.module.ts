import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersMicroController } from './users.micro.controller';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { GuardsModule } from '../guards/guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Permission, UserRole, RolePermission]),
    HttpModule,
    GuardsModule,
  ],
  controllers: [UsersController, UsersMicroController],
  providers: [UsersService],
  exports: [UsersService], // Exportăm serviciul pentru a fi folosit în alte module
})
export class UsersModule {}