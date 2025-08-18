import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './stock/entities/product.entity';
import { Stock } from './stock/entities/stock.entity';
import { StockTransaction } from './stock/entities/stock-transaction.entity';
import { StockService } from './stock/stock.service';
import { StockMicroController } from './stock/stock.micro.controller';
import { StockHttpController } from './stock/stock.http.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['stock/.env', '.env'] }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'eric',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [Product, Stock, StockTransaction],
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
    TypeOrmModule.forFeature([Product, Stock, StockTransaction]),
  ],
  controllers: [StockMicroController, StockHttpController],
  providers: [StockService],
})
export class AppModule {}
