import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { Presence } from './entities/presence.entity';
import { PresenceInflexion } from './entities/presence-inflexion.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceMicroController } from './attendance.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [
        Shift,
        Presence,
        PresenceInflexion,
      ],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([
      Shift,
      Presence,
      PresenceInflexion,
    ]),
  ],
  controllers: [AttendanceController, AttendanceMicroController],
  providers: [AttendanceService],
  exports: [AttendanceService, TypeOrmModule],
})
export class AppModule {}


