import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';

@Entity('company_subscriptions')
@Unique('UQ_company_subscriptions_company', ['company_id'])
export class CompanySubscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  company_id: number;

  @Column({ type: 'varchar', length: 32 })
  plan_code: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @Column({ type: 'datetime', precision: 3 })
  starts_at: Date;

  @Column({ type: 'datetime', precision: 3, nullable: true })
  ends_at: Date | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @ManyToOne(() => SubscriptionPlan, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_code', referencedColumnName: 'code' })
  plan?: SubscriptionPlan;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;
}
