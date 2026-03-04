import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from '../push-subscription.entity';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscriptionEntity]),
  ],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
