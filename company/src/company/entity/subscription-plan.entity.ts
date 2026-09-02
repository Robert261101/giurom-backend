import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PlanLimit } from './plan-limit.entity';

@Entity('subscription_plans')
export class SubscriptionPlan {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'RON' })
  currency: string | null;

  /** none | monthly | yearly */
  @Column({ type: 'varchar', length: 16, nullable: true })
  billing_period: string | null;

  @Column({ type: 'int', nullable: true })
  billing_period_days: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @OneToMany(() => PlanLimit, (limit) => limit.plan)
  limits?: PlanLimit[];

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;
}
