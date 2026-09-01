import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { SupplierOrder, OrderStatus } from './entities/supplier-order.entity';
import { SupplierProductClientPrice } from './entities/supplier-product-client-price.entity';
import { SuppliersService } from './suppliers.service';
import { Giurom2ZonesService } from './giurom2-zones.service';
import { App2CreateOrderDto } from './dto/app2-create-order.dto';
import { CreateSupplierOrderDto } from './dto/create-supplier-order.dto';
import { convertToStandardUnit, getUnitFamily, normalizeUnitKey } from './units.util';

export interface App2CatalogProduct {
  supplier_product_id: number;
  product_id: number;
  name: string;
  unit: string;
  price_per_unit: number | null;
}

export interface App2CatalogSupplier {
  id: number;
  name: string;
  products: App2CatalogProduct[];
}

/**
 * Comenzile pregatite in giurom 2.0 si plasate aici.
 *
 * App2 stie doar produsul de stoc si cantitatea; nomenclatorul furnizorului, pretul
 * negociat si validarile de disponibilitate raman ale App1. Serviciul asta face exact
 * traducerea si deleaga la `SuppliersService.createOrder`, ca fluxul (magazioner, sofer,
 * receptie) sa fie acelasi ca pentru o comanda facuta aici.
 */
@Injectable()
export class App2OrdersService {
  private readonly logger = new Logger(App2OrdersService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepo: Repository<SupplierProduct>,
    @InjectRepository(SupplierOrder)
    private readonly orderRepo: Repository<SupplierOrder>,
    @InjectRepository(SupplierProductClientPrice)
    private readonly clientPriceRepo: Repository<SupplierProductClientPrice>,
    private readonly suppliersService: SuppliersService,
    private readonly giurom2ZonesService: Giurom2ZonesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Catalogul din care App2 compune comanda: furnizorii activi si produsele lor active.
   *
   * Pretul intors e cel pe care l-ar folosi si `createOrder` — preferential daca exista unul
   * negociat pentru compania locatiei, altfel cel din nomenclator. Altfel operatorul ar
   * vedea in App2 un pret si ar primi in App1 altul.
   */
  async getCatalog(companyId: number, locationId: number): Promise<App2CatalogSupplier[]> {
    const suppliers = await this.supplierRepo.find({
      where: { is_active: true },
      order: { supplier_name: 'ASC' },
    });
    if (suppliers.length === 0) return [];

    const products = await this.supplierProductRepo.find({
      where: { supplier_id: In(suppliers.map((s) => s.id)), is_active: true },
      order: { product_name: 'ASC' },
    });
    if (products.length === 0) {
      return suppliers.map((s) => ({ id: s.id, name: s.supplier_name, products: [] }));
    }

    const preferred = await this.clientPriceRepo.find({
      where: {
        client_company_id: companyId,
        supplier_product_id: In(products.map((p) => p.id)),
      },
    });
    const preferredById = new Map(
      preferred.map((row) => [Number(row.supplier_product_id), Number(row.preferred_price)]),
    );

    const bySupplier = new Map<number, App2CatalogProduct[]>();
    for (const product of products) {
      const list = bySupplier.get(product.supplier_id) ?? [];
      list.push({
        supplier_product_id: product.id,
        product_id: product.product_id,
        name: product.product_name,
        unit: product.unit_of_measure,
        price_per_unit:
          preferredById.get(product.id) ?? (Number(product.price_per_unit) || null),
      });
      bySupplier.set(product.supplier_id, list);
    }

    this.logger.log(
      `[App2Orders] Catalog pentru compania ${companyId} / locatia ${locationId}: ` +
        `${suppliers.length} furnizori, ${products.length} produse.`,
    );

    return suppliers.map((s) => ({
      id: s.id,
      name: s.supplier_name,
      products: bySupplier.get(s.id) ?? [],
    }));
  }

  /**
   * Plaseaza comanda venita din App2.
   *
   * Intra ca `draft`: cineva de aici verifica produsele, cantitatile si data de livrare
   * inainte sa porneasca fluxul. O comanda pregatita automat din alerte de stoc nu are voie
   * sa ajunga la furnizor fara ochi uman.
   */
  async createOrder(dto: App2CreateOrderDto): Promise<{ order_id: number; duplicate: boolean }> {
    // Idempotenta inainte de orice munca: App2 reincearca dupa timeout, iar comanda poate fi
    // deja creata. Un duplicat aici inseamna marfa comandata de doua ori.
    const existing = await this.orderRepo.findOne({ where: { app2_target: dto.target } });
    if (existing) {
      this.logger.log(
        `[App2Orders] ${dto.target} exista deja ca ordinul ${existing.id} — nu recreez.`,
      );
      return { order_id: existing.id, duplicate: true };
    }

    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplier_id } });
    if (!supplier) {
      throw new NotFoundException(`Furnizorul ${dto.supplier_id} nu exista in aplicatia 1`);
    }
    if (!supplier.is_active) {
      throw new BadRequestException(
        `Furnizorul „${supplier.supplier_name}" e inactiv — comanda nu poate fi plasata.`,
      );
    }

    const createdByUserId = this.resolveCreatedByUserId();
    const allowedZoneIds = await this.giurom2ZonesService.allowedZoneIds(
      dto.company_id,
      dto.location_id,
    );

    const items: CreateSupplierOrderDto['items'] = [];
    const problems: string[] = [];

    for (const item of dto.items) {
      const supplierProduct = await this.supplierProductRepo.findOne({
        where: {
          supplier_id: dto.supplier_id,
          product_id: item.product_id,
          is_active: true,
        },
      });
      if (!supplierProduct) {
        problems.push(
          `produsul #${item.product_id} nu e in nomenclatorul activ al furnizorului „${supplier.supplier_name}"`,
        );
        continue;
      }

      const quantity = this.convertQuantity(
        item.quantity,
        item.unit,
        supplierProduct.unit_of_measure,
      );
      if (quantity == null) {
        problems.push(
          `„${supplierProduct.product_name}": nu pot converti ${item.quantity} ${item.unit} ` +
            `in ${supplierProduct.unit_of_measure} — unitati din familii diferite`,
        );
        continue;
      }

      items.push({
        product_id: item.product_id,
        supplier_product_id: supplierProduct.id,
        quantity,
        // Ignorat de createOrder, care recalculeaza pretul din nomenclator sau din pretul
        // negociat. Trimis doar fiindca DTO-ul il cere ca numar pozitiv.
        price_per_unit: Number(supplierProduct.price_per_unit) || 1,
        ...(item.giurom2_zone_id != null && allowedZoneIds.has(item.giurom2_zone_id)
          ? { giurom2_zone_id: item.giurom2_zone_id }
          : {}),
      });
    }

    // Totul sau nimic: o comanda partiala ar parea completa in App2 si ar lasa exact
    // produsele critice pe dinafara, tacut.
    if (problems.length > 0) {
      throw new BadRequestException(
        `Comanda nu poate fi plasata — ${problems.join('; ')}.`,
      );
    }
    if (items.length === 0) {
      throw new BadRequestException('Comanda nu are nicio linie valida.');
    }

    const now = new Date();
    const order = await this.suppliersService.createOrder({
      supplier_id: dto.supplier_id,
      order_date: now.toISOString(),
      delivery_date: this.defaultDeliveryDate(now).toISOString(),
      status: OrderStatus.DRAFT,
      notes: dto.notes,
      created_by_user_id: createdByUserId,
      company_id: dto.company_id,
      location_id: dto.location_id,
      supplier_location_id: dto.location_id,
      items,
    });

    // Marcat dupa creare, nu prin DTO: `createOrder` e calea comuna cu interfata App1 si nu
    // trebuie sa afle despre integrare.
    await this.orderRepo.update({ id: order.id }, { app2_target: dto.target });

    this.logger.log(
      `[App2Orders] ${dto.target} → comanda ${order.id} (${items.length} linii, furnizor ${supplier.supplier_name}).`,
    );
    return { order_id: order.id, duplicate: false };
  }

  /**
   * Cantitatea in unitatea produsului furnizor.
   *
   * `null` = conversie imposibila (kg → buc, de exemplu). Nu ghicim: o comanda de 3 in loc
   * de 3 kg e o greseala scumpa si tacuta. Unitatile identice trec neatinse, chiar si cele
   * de tip „count" (bax, buc), unde nu exista factor de conversie.
   */
  private convertQuantity(
    quantity: number,
    fromUnit: string,
    toUnit: string,
  ): number | null {
    if (normalizeUnitKey(fromUnit) === normalizeUnitKey(toUnit)) return quantity;

    const fromFamily = getUnitFamily(fromUnit);
    const toFamily = getUnitFamily(toUnit);
    if (fromFamily !== toFamily || fromFamily === 'count') return null;

    const from = convertToStandardUnit(quantity, fromUnit);
    const to = convertToStandardUnit(1, toUnit);
    if (!Number.isFinite(to.converted) || to.converted === 0) return null;

    const result = from.converted / to.converted;
    return Number.isFinite(result) && result > 0 ? Number(result.toFixed(4)) : null;
  }

  /** Livrare a doua zi — valoarea implicita si in formularul App1. Se poate schimba aici. */
  private defaultDeliveryDate(from: Date): Date {
    const delivery = new Date(from);
    delivery.setDate(delivery.getDate() + 1);
    return delivery;
  }

  /**
   * Autorul comenzilor venite din App2: un cont tehnic din App1, configurat in mediu.
   *
   * Fara el nu plasam comanda: `created_by_user_id` e obligatoriu si apare in tot istoricul
   * comenzii, iar un id inventat ar lega comanda de un utilizator la intamplare.
   */
  private resolveCreatedByUserId(): number {
    const raw = this.configService.get<string>('GIUROM2_ORDER_USER_ID');
    const userId = Number.parseInt(String(raw ?? '').trim(), 10);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException(
        'GIUROM2_ORDER_USER_ID nu e configurat in suppliers-ms — comenzile din giurom 2.0 nu au autor.',
      );
    }
    return userId;
  }
}
