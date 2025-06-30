import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './company/company.module';
import { LocationsModule } from './locations/locations.module';

// Entitățile pentru auto-import
import { Company } from './company/entity/company.entity';
import { CompanyDocument } from './company/entity/company-document.entity';
import { WorkLocation } from './locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from './locations/entity/work-location-task-template.entity';

@Module({
  imports: [
    // Configurarea variabilelor de mediu
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate Limiting pentru securitate
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 secundă
        limit: 3,  // 3 cereri per secundă
      },
      {
        name: 'medium',
        ttl: 10000, // 10 secunde
        limit: 20,  // 20 cereri per 10 secunde
      },
      {
        name: 'long',
        ttl: 60000, // 1 minut
        limit: 100, // 100 cereri per minut
      },
    ]),

    // Conexiunea cu MariaDB cu suport UTF-8 pentru caractere românești
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'root',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [
        Company,
        CompanyDocument,
        WorkLocation,
        WorkLocationTaskTemplate,
      ],
      synchronize: process.env.NODE_ENV !== 'production', // Doar în dezvoltare
      logging: process.env.NODE_ENV === 'development',
      charset: 'utf8mb4',
      timezone: '+00:00',
      extra: {
        connectionLimit: 10,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        // Force UTF-8 support for Romanian characters
        initStatements: [
          "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'",
          "SET CHARACTER SET utf8mb4",
          "SET character_set_connection=utf8mb4"
        ]
      },
    }),

    // Modulele aplicației
    CompanyModule,
    LocationsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 