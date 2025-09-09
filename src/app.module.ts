import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from './recipes/entities/recipe.entity';
import { RecipeCategory } from './recipes/entities/recipe-category.entity';
import { RecipeProduct } from './recipes/entities/recipe-product.entity';
import { RecipePreparation } from './recipes/entities/recipe-preparation.entity';
import { RecipeLabel } from './recipes/entities/recipe-label.entity';
import { RecipesService } from './recipes/recipes.service';
import { RecipesMicroController } from './recipes.micro.controller';
import { RecipesHttpController } from './recipes.http.controller';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { RecipesLabelsService } from './recipes/recipes-labels.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env')] }),
    ScheduleModule.forRoot(),
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_RMQ',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
          queueOptions: { durable: false },
        },
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST as string,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME as string,
      password: process.env.DB_PASSWORD as string,
      database: process.env.DB_DATABASE as string,
      entities: [Recipe, RecipeCategory, RecipeProduct, RecipePreparation, RecipeLabel],
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
    TypeOrmModule.forFeature([Recipe, RecipeCategory, RecipeProduct, RecipePreparation, RecipeLabel]),
  ],
  controllers: [RecipesMicroController, RecipesHttpController],
  providers: [RecipesService, RecipePreparationsService, RecipesLabelsService],
})
export class AppModule {}


