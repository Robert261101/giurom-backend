import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WasteRecord } from './waste-records/entities/waste-record.entity';
import { WasteRecordsService } from './waste-records/waste-records.service';
import { WasteRecordsMicroController } from './waste-records.micro.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [WasteRecord],
      synchronize: process.env.DB_SYNCHRONIZE === 'true',
      logging: process.env.DB_LOGGING === 'true',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          'SET CHARACTER SET utf8mb4',
          'SET character_set_connection=utf8mb4',
        ],
      },
    }),
    TypeOrmModule.forFeature([WasteRecord]),
  ],
  controllers: [WasteRecordsMicroController],
  providers: [WasteRecordsService],
})
export class AppModule {}


