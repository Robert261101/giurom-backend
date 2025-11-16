import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
	imports: [
		ClientsModule.registerAsync([
			{
				name: 'NOTIFICATIONS_RMQ',
				useFactory: () => ({
					transport: Transport.RMQ,
					options: {
						urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
						queue: process.env.NOTIFICATIONS_QUEUE || 'notifications',
						queueOptions: { durable: false },
					},
				}),
			},
		]),
	],
	exports: [ClientsModule],
})
export class NotificationsModule {}

