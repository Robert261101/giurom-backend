import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from '../push-subscription.entity';
import { PushDeliveryLogEntity } from '../push-delivery-log.entity';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscriptionEntity, PushDeliveryLogEntity]),
  ],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
