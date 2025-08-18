import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEntity } from './notification.entity';

@Module({
  imports: [
    // Database connection for persistent notifications storage
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || 'eric',
      database: process.env.DB_DATABASE || 'giurom_db',
      entities: [NotificationEntity],
      synchronize: false,
      logging: false,
    }),
    TypeOrmModule.forFeature([NotificationEntity]),
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
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
})
export class AppModule {}


