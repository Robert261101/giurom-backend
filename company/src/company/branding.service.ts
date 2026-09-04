import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { CompanyBranding } from './entity/company-branding.entity';
import { CompanyAccessRequester } from './company.service';
import {
  BRANDING_COLOR_KEYS,
  BrandingColorKey,
  BrandingPalette,
  LOGO_EXTENSION_BY_MIME,
  LOGO_MAX_BYTES,
  normalizeHexColor,
  resolvePalette,
} from './branding.constants';

/** Rândul implicit al platformei — vezi comentariul din entitate. */
export const PLATFORM_BRANDING_ID = 0;

export type BrandingView = {
  /** Firma la care se aplică; `0` = implicitul platformei. */
  company_id: number;
  /** `true` când rândul editat e cel al platformei (cont fără companie). */
  is_platform_default: boolean;
  /** Culorile efective, cu implicitele deja aplicate — gata de pus în pagină. */
  palette: BrandingPalette;
  /**
   * Ce a ales explicit firma, fără moșteniri. Ecranul are nevoie de asta ca să arate
   * care câmpuri sunt „pe implicit" și ca butonul de resetare să aibă ce reseta.
   */
  overrides: Partial<Record<BrandingColorKey, string>>;
  /** URL-ul logo-ului, sau `null` dacă nu există. Poartă versiunea, pentru cache. */
  logo_url: string | null;
  has_logo: boolean;
  updated_at: string | null;
};

/**
 * Logo-ul și paleta de culori, per firmă.
 *
 * Rezolvarea e pe trei niveluri — firma, implicitul platformei (`company_id = 0`),
 * implicitul din cod — și se face **culoare cu culoare**, nu rând cu rând: o firmă care
 * și-a schimbat doar culoarea principală moștenește restul, nu sare peste platformă.
 *
 * Logo-ul se scrie pe disc, nu în baza de date: e un fișier binar servit la fiecare
 * încărcare de pagină, iar un BLOB l-ar face să treacă prin ORM și prin JSON la fiecare
 * cerere. Calea urmează tiparul documentelor de firmă (`getRepoRoot()` + `files/`).
 */
@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    @InjectRepository(CompanyBranding)
    private readonly brandingRepo: Repository<CompanyBranding>,
  ) {}

  // ---------------------------------------------------------------------------
  // Scope
  // ---------------------------------------------------------------------------

  /**
   * Ce rând editează/citește cel care cere.
   *
   * Un cont de firmă vede și schimbă brandingul firmei lui. Un cont fără companie
   * (operator de platformă) lucrează pe rândul implicit — de acolo moștenesc toate
   * firmele care n-au configurat nimic. Scope-ul vine din JWT, niciodată din body:
   * altfel un tenant ar putea rescrie brandingul altuia.
   */
  resolveScope(requester?: CompanyAccessRequester): number {
    const companyId = Number(requester?.companyId);
    if (Number.isFinite(companyId) && companyId > 0) return companyId;
    if (requester?.hasPlatformWideAccess || requester?.isSuperAdmin) {
      return PLATFORM_BRANDING_ID;
    }
    throw new ForbiddenException(
      'Contul nu are o firmă asociată și nici drepturi de platformă',
    );
  }

  // ---------------------------------------------------------------------------
  // Citire
  // ---------------------------------------------------------------------------

  /** Brandingul efectiv pentru cel autentificat. */
  async getForRequester(requester?: CompanyAccessRequester): Promise<BrandingView> {
    return this.getForCompany(this.resolveScope(requester));
  }

  async getForCompany(companyId: number): Promise<BrandingView> {
    const isPlatform = companyId === PLATFORM_BRANDING_ID;
    const [companyRow, platformRow] = await Promise.all([
      this.brandingRepo.findOne({ where: { company_id: companyId } }),
      isPlatform
        ? Promise.resolve(null)
        : this.brandingRepo.findOne({ where: { company_id: PLATFORM_BRANDING_ID } }),
    ]);

    const overrides: Partial<Record<BrandingColorKey, string>> = {};
    for (const key of BRANDING_COLOR_KEYS) {
      const own = normalizeHexColor(companyRow?.[key]);
      if (own) overrides[key] = own;
    }

    // Logo-ul nu se moștenește pe jumătate: dacă firma și-a pus unul, e al ei; altfel
    // cade pe cel al platformei, ca o firmă nouă să nu rămână cu bara goală.
    const logoRow = companyRow?.logo_file ? companyRow : (platformRow?.logo_file ? platformRow : null);

    return {
      company_id: companyId,
      is_platform_default: isPlatform,
      palette: resolvePalette(companyRow, platformRow),
      overrides,
      // Fara `company_id` in URL: ruta il deduce din JWT. Versiunea sparge cache-ul
      // browserului — altfel un logo inlocuit ramane cel vechi pana la un hard refresh.
      logo_url: logoRow ? `/api/branding/logo?v=${logoRow.logo_version}` : null,
      has_logo: Boolean(companyRow?.logo_file),
      updated_at: companyRow?.updated_at
        ? new Date(companyRow.updated_at).toISOString()
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Scriere culori
  // ---------------------------------------------------------------------------

  /**
   * Salvează culorile trimise. Câmpurile absente rămân neatinse; `null` explicit
   * readuce culoarea pe implicit.
   */
  async updateColors(
    requester: CompanyAccessRequester | undefined,
    body: Partial<Record<BrandingColorKey, string | null>>,
    updatedByUserId: number | null,
  ): Promise<BrandingView> {
    const companyId = this.resolveScope(requester);
    const row = await this.ensureRow(companyId);

    let touched = false;
    for (const key of BRANDING_COLOR_KEYS) {
      if (!(key in body)) continue;
      const raw = body[key];
      if (raw === null || raw === '') {
        row[key] = null;
        touched = true;
        continue;
      }
      const color = normalizeHexColor(raw);
      if (!color) {
        throw new BadRequestException(
          `Culoarea „${key}" trebuie să fie în format #rrggbb`,
        );
      }
      row[key] = color;
      touched = true;
    }

    if (!touched) {
      throw new BadRequestException('Nu s-a trimis nicio culoare de salvat');
    }

    row.updated_by_user_id = updatedByUserId;
    await this.brandingRepo.save(row);
    return this.getForCompany(companyId);
  }

  /** Readuce toate culorile pe implicit. Logo-ul rămâne — se șterge separat. */
  async resetColors(
    requester: CompanyAccessRequester | undefined,
    updatedByUserId: number | null,
  ): Promise<BrandingView> {
    const companyId = this.resolveScope(requester);
    const row = await this.ensureRow(companyId);
    for (const key of BRANDING_COLOR_KEYS) row[key] = null;
    row.updated_by_user_id = updatedByUserId;
    await this.brandingRepo.save(row);
    return this.getForCompany(companyId);
  }

  // ---------------------------------------------------------------------------
  // Logo
  // ---------------------------------------------------------------------------

  /**
   * Salvează logo-ul trimis ca data URL (`data:image/png;base64,...`).
   *
   * Data URL, nu multipart: proxy-ul Next.js prin care trec toate apelurile citește
   * body-ul ca text, deci un upload binar ar ajunge corupt la backend. Documentele de
   * firmă folosesc deja același tipar.
   */
  async saveLogo(
    requester: CompanyAccessRequester | undefined,
    dataUrl: string,
    updatedByUserId: number | null,
  ): Promise<BrandingView> {
    const companyId = this.resolveScope(requester);
    const { buffer, mime, extension } = this.parseLogoDataUrl(dataUrl);

    const dir = this.getBrandingDir(companyId);
    fs.mkdirSync(dir, { recursive: true });

    const row = await this.ensureRow(companyId);
    // Fișierul vechi poate avea altă extensie; se șterge înainte, altfel rămâne pe disc
    // la nesfârșit, nereferit de nimeni.
    this.removeLogoFile(companyId, row.logo_file);

    const fileName = `logo.${extension}`;
    fs.writeFileSync(path.join(dir, fileName), buffer);

    row.logo_file = fileName;
    row.logo_mime = mime;
    row.logo_version = (row.logo_version ?? 0) + 1;
    row.updated_by_user_id = updatedByUserId;
    await this.brandingRepo.save(row);

    return this.getForCompany(companyId);
  }

  async deleteLogo(
    requester: CompanyAccessRequester | undefined,
    updatedByUserId: number | null,
  ): Promise<BrandingView> {
    const companyId = this.resolveScope(requester);
    const row = await this.ensureRow(companyId);
    this.removeLogoFile(companyId, row.logo_file);
    row.logo_file = null;
    row.logo_mime = null;
    row.logo_version = (row.logo_version ?? 0) + 1;
    row.updated_by_user_id = updatedByUserId;
    await this.brandingRepo.save(row);
    return this.getForCompany(companyId);
  }

  /**
   * Fișierul logo-ului pentru cel autentificat: al firmei lui, sau al platformei când
   * firma n-a pus unul.
   *
   * Scope-ul vine din JWT, nu din URL — altfel o firmă ar putea cere logo-ul alteia
   * numărând id-uri. Ruta e apelată de un `<img>`, care nu trimite header de
   * autentificare, deci tokenul e atașat de ruta Next.js din cookie.
   */
  async readLogoForRequester(
    requester?: CompanyAccessRequester,
  ): Promise<{ buffer: Buffer; mime: string }> {
    const companyId = this.resolveScope(requester);
    const [companyRow, platformRow] = await Promise.all([
      this.brandingRepo.findOne({ where: { company_id: companyId } }),
      companyId === PLATFORM_BRANDING_ID
        ? Promise.resolve(null)
        : this.brandingRepo.findOne({ where: { company_id: PLATFORM_BRANDING_ID } }),
    ]);

    const row = companyRow?.logo_file
      ? companyRow
      : platformRow?.logo_file
        ? platformRow
        : null;
    if (!row?.logo_file) {
      throw new NotFoundException('Nu există logo configurat');
    }

    const full = path.join(this.getBrandingDir(row.company_id), row.logo_file);
    if (!fs.existsSync(full)) {
      this.logger.warn(
        `[Branding] Rândul firmei ${row.company_id} indică ${row.logo_file}, dar fișierul lipsește`,
      );
      throw new NotFoundException('Fișierul logo-ului nu a fost găsit');
    }
    return {
      buffer: fs.readFileSync(full),
      mime: row.logo_mime || 'application/octet-stream',
    };
  }

  // ---------------------------------------------------------------------------
  // Ajutătoare
  // ---------------------------------------------------------------------------

  private async ensureRow(companyId: number): Promise<CompanyBranding> {
    const existing = await this.brandingRepo.findOne({
      where: { company_id: companyId },
    });
    if (existing) return existing;
    return this.brandingRepo.create({
      company_id: companyId,
      logo_file: null,
      logo_mime: null,
      logo_version: 0,
    });
  }

  /**
   * `data:image/png;base64,...` → conținut verificat.
   *
   * Tipul se ia din prefixul declarat, dar e acceptat doar dacă e într-o listă scurtă:
   * altfel un `data:text/html` salvat cu extensia lui ar fi servit înapoi cu acel
   * Content-Type, din același origin ca aplicația.
   */
  private parseLogoDataUrl(dataUrl: string): {
    buffer: Buffer;
    mime: string;
    extension: string;
  } {
    const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec((dataUrl || '').trim());
    if (!match) {
      throw new BadRequestException(
        'Logo-ul trebuie trimis ca data URL base64 (data:image/png;base64,...)',
      );
    }
    const mime = match[1].toLowerCase();
    const extension = LOGO_EXTENSION_BY_MIME[mime];
    if (!extension) {
      throw new BadRequestException(
        'Format acceptat doar PNG, JPEG, WEBP sau SVG',
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(match[2], 'base64');
    } catch {
      throw new BadRequestException('Conținutul logo-ului nu e base64 valid');
    }
    if (buffer.length === 0) {
      throw new BadRequestException('Fișierul logo-ului e gol');
    }
    if (buffer.length > LOGO_MAX_BYTES) {
      throw new BadRequestException(
        `Logo-ul depășește ${Math.round(LOGO_MAX_BYTES / 1024)} KB`,
      );
    }
    return { buffer, mime, extension };
  }

  /**
   * Aceeași rădăcină ca documentele de firmă. Pe server se setează
   * `REPO_ROOT=/home/restosoft`, ca fișierele să stea în afara arborelui de cod.
   */
  private getRepoRoot(): string {
    const fromEnv = (process.env.REPO_ROOT || process.env.IMAGES_ROOT || '').trim();
    if (fromEnv) return path.resolve(fromEnv);
    let repoRoot = path.resolve(__dirname, '../../../..');
    if (path.basename(repoRoot) === 'giurom-backend') {
      repoRoot = path.dirname(repoRoot);
    }
    return repoRoot;
  }

  /** `companyId` vine din JWT sau dintr-un `ParseIntPipe`, deci nu poate purta `../`. */
  private getBrandingDir(companyId: number): string {
    return path.join(
      this.getRepoRoot(),
      'files',
      'branding',
      String(Math.trunc(companyId)),
    );
  }

  private removeLogoFile(companyId: number, fileName: string | null): void {
    if (!fileName) return;
    // Numele e generat de noi (`logo.<ext>`), dar rândul vine din baza de date — un
    // `basename` costă nimic și taie orice cale relativă strecurată acolo.
    const safe = path.basename(fileName);
    const full = path.join(this.getBrandingDir(companyId), safe);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (e) {
      this.logger.warn(
        `[Branding] Nu am putut șterge ${full}: ${(e as Error).message}`,
      );
    }
  }
}
