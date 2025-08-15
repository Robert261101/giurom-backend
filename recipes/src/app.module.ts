import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from './recipes/entities/recipe.entity';
import { RecipeCategory } from './recipes/entities/recipe-category.entity';
import { RecipeProduct } from './recipes/entities/recipe-product.entity';
import { RecipePreparation } from './recipes/entities/recipe-preparation.entity';
import { RecipeLabel } from './recipes/entities/recipe-label.entity';
import { RecipesService } from './recipes/recipes.service';
import { RecipesMicroController } from './recipes.micro.controller';
import { RecipePreparationsService } from './recipes/recipes-preparations.service';
import { RecipesLabelsService } from './recipes/recipes-labels.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['recipes/.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'eric',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [Recipe, RecipeCategory, RecipeProduct, RecipePreparation, RecipeLabel],
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
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
  controllers: [RecipesMicroController],
  providers: [RecipesService, RecipePreparationsService, RecipesLabelsService],
})
export class AppModule {}


