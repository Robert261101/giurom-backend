import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Log pentru eșecuri (sau reușite parțiale) la trimiterea push FCM.
 * Permite vizualizarea în app când notificările nu au ajuns pe dispozitiv.
 */
@Entity("push_delivery_log")
@Index(["user_id", "created_at"])
export class PushDeliveryLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  user_id: number;

  /** ID notificare (din notifications) pentru care s-a încercat push-ul; poate fi null. */
  @Column({ type: "int", nullable: true })
  notification_id: number | null;

  @Column({ type: "int", default: 0 })
  sent: number;

  @Column({ type: "int", default: 0 })
  failed: number;

  /** Coduri FCM (ex: messaging/invalid-registration-token) sau mesaj eroare, JSON array. */
  @Column({ type: "json", nullable: true })
  failure_reasons: string[] | null;

  @CreateDateColumn({ type: "datetime" })
  created_at: Date;
}
