import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shift } from './entities/shift.entity';
import { Presence } from './entities/presence.entity';
import { PresenceInflexion } from './entities/presence-inflexion.entity';
import { Employee } from './entities/employee.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceMicroController } from './attendance.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true, 
      envFilePath: ['attendance-ms/.env', '.env'] 
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        Shift,
        Presence,
        PresenceInflexion,
        Employee,
      ],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
    }),
    TypeOrmModule.forFeature([
      Shift,
      Presence,
      PresenceInflexion,
      Employee,
    ]),
  ],
  controllers: [AttendanceController, AttendanceMicroController],
  providers: [AttendanceService],
  exports: [AttendanceService, TypeOrmModule],
})
export class AppModule {}


