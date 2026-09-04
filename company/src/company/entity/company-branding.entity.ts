import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Logo-ul și paleta de culori ale unei firme.
 *
 * `company_id = 0` e rândul implicit al platformei: ce vede o firmă care n-a configurat
 * nimic și ce editează un cont fără companie (super-admin). Zero în loc de `NULL` fiindcă
 * pe MySQL un index unic acceptă oricâte `NULL`-uri — s-ar putea strecura două rânduri
 * „implicite" fără ca baza să se plângă.
 *
 * Culorile sunt `#rrggbb`, validate la scriere. `NULL` pe o coloană = „nu s-a atins,
 * folosește implicitul" — nu „transparent"; așa un plan de culori parțial completat nu
 * lasă găuri în interfață.
 */
@Entity('company_branding')
export class CompanyBranding {
  /** Firma căreia îi aparține brandingul; `0` = implicitul platformei. */
  @PrimaryColumn({ type: 'int' })
  company_id: number;

  /**
   * Calea relativă a logo-ului, sub `files/branding/<company_id>/`. Doar numele
   * fișierului, nu calea absolută: rădăcina se schimbă între dev și server.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  logo_file: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  logo_mime: string | null;

  /**
   * Se incrementează la fiecare logo nou. Intră în URL-ul imaginii ca să spargă cache-ul
   * browserului — altfel un logo înlocuit rămâne cel vechi până la un hard refresh.
   */
  @Column({ type: 'int', default: 0 })
  logo_version: number;

  /** Culoarea de brand: butoane, linkuri, accente active. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_primary: string | null;

  /** Textul așezat peste culoarea de brand. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_primary_foreground: string | null;

  /** Fundalul suav derivat din brand: rânduri selectate, badge-uri, hover. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_accent: string | null;

  /** Fundalul paginii, în spatele cardurilor. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_page_bg: string | null;

  /** Fundalul cardurilor și al panourilor. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_surface: string | null;

  /** Fundalul meniului din stânga. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_sidebar: string | null;

  /** Textul principal. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_text: string | null;

  /** Textul secundar: etichete, descrieri, placeholder-e. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_text_muted: string | null;

  /** Liniile de separare și conturul câmpurilor. */
  @Column({ type: 'varchar', length: 9, nullable: true })
  color_border: string | null;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn({ type: 'datetime', precision: 3 })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 3 })
  updated_at: Date;
}
