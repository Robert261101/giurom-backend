import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { TaskTemplate } from './entity/task-template.entity';
import { TaskElement } from './entity/task-element.entity';
import { TemplateLocation } from './entity/template-location.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskTemplate, TaskElement, TemplateLocation]),
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
    JwtModule.register({
      secret: 'your-secret-key',
      signOptions: { expiresIn: '59m'},
    })
  ],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
