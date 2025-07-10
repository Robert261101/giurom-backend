import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { CompanyModule } from './company/company.module';
import { LocationsModule } from './locations/locations.module';
import { EmployeeModule } from './employee/employee.module';

// Entitățile pentru auto-import
import { Company } from './company/entity/company.entity';
import { CompanyDocument } from './company/entity/company-document.entity';
import { WorkLocation } from './locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from './locations/entity/work-location-task-template.entity';
import { WorkLocationDepartments } from './locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from './locations/entity/work-location-department-positions.entity';

// Entități Pontaj
import { Shift } from './attendance/entities/shift.entity';
import { Presence } from './attendance/entities/presence.entity';
import { PresenceInflexion } from './attendance/entities/presence-inflexion.entity';
import { Employee } from './employee/entity/employee.entity';
import { EmployeeWorkLocationHistory } from './employee/entity/employee-work-location-history.entity';
import { EmployeeFiles } from './employee/entity/employee-files.entity';
import { GeneratedDocuments } from './employee/entity/generated-documents.entity';
import { AttendanceModule } from './attendance/attendance.module';
import { RecipesModule } from './recipes/recipes.module';

// Entități Rețetar
import { Recipe } from './recipes/entities/recipe.entity';
import { RecipeCategory } from './recipes/entities/recipe-category.entity';
import { Ingredient } from './recipes/entities/ingredient.entity';
import { RecipeIngredient } from './recipes/entities/recipe-ingredient.entity';

// Entități Recipe Preparations
import { RecipePreparationsModule } from './recipe-preparations/recipe-preparations.module';
import { RecipePreparation } from './recipe-preparations/entities/recipe-preparation.entity';
import { RecipeLabel } from './recipe-labels/entities/recipe-label.entity';
import { RecipeLabelsModule } from './recipe-labels/recipe-labels.module';

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
        // Entități companii
        Company,
        CompanyDocument,
        // Entități locații
        WorkLocation,
        WorkLocationTaskTemplate,
        WorkLocationDepartments,
        WorkLocationDepartmentPositions,
        // Entități angajați
        Employee,
        EmployeeWorkLocationHistory,
        EmployeeFiles,
        GeneratedDocuments,
        // Entități pontaj
        Shift,
        Presence,
        PresenceInflexion,
        // Entități rețetar
        Recipe,
        RecipeCategory,
        Ingredient,
        RecipeIngredient,
        // Entități recipe preparations
        RecipePreparation,
        RecipeLabel,
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
    EmployeeModule,
    AttendanceModule,
    RecipesModule,
    RecipePreparationsModule,
    RecipeLabelsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 