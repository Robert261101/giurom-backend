import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { TwoFactorAuthModule } from './otp-auth/otp-auth.module';
import { TwoFactorAuthModule as TwoFactorAuthModule2 } from './2fa-auth/2fa-auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { Role } from './users/entities/role.entity';
import { Permission } from './users/entities/permission.entity';
import { UserRole } from './users/entities/user-role.entity';
import { RolePermission } from './users/entities/role-permission.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '.env')]
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'veziv_auth2',
      entities: [User, Role, Permission, UserRole, RolePermission],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      connectorPackage: 'mysql2',
      extra: {
        connectionLimit: 10,
        charset: 'utf8mb4_unicode_ci',
      },
    }),
    AuthModule,
    TwoFactorAuthModule,
    TwoFactorAuthModule2,
    UsersModule
  ],
})
export class AppModule {}