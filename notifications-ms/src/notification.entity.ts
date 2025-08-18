import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('notifications')
export class NotificationEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 100 })
	type: string;

	@Column({ type: 'varchar', length: 255 })
	title: string;

	@Column({ type: 'text', nullable: true })
	description: string | null;

	@Column({ type: 'int', nullable: true })
	user_id: number | null;

	@Column({ type: 'enum', enum: ['unread', 'read', 'archived'], default: 'unread' })
	status: 'unread' | 'read' | 'archived';

	@Column({ type: 'int', nullable: true })
	entity_id: number | null;

	@Column({ type: 'varchar', length: 100, nullable: true })
	entity_type: string | null;

	@Column({ type: 'varchar', length: 255, nullable: true })
	target_url: string | null;

	@Column({ type: 'json', nullable: true })
	metadata: any | null;

	@Column({ type: 'datetime', nullable: true })
	expires_at: Date | null;

	@Column({ type: 'enum', enum: ['low', 'medium', 'high'], default: 'low' })
	priority: 'low' | 'medium' | 'high';

	@CreateDateColumn({ type: 'datetime' })
	created_at: Date;

	@UpdateDateColumn({ type: 'datetime' })
	updated_at: Date;
}



