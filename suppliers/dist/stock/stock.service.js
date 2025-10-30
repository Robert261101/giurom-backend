"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const product_entity_1 = require("./entities/product.entity");
const stock_entity_1 = require("./entities/stock.entity");
const stock_transaction_entity_1 = require("./entities/stock-transaction.entity");
const waste_record_entity_1 = require("./entities/waste-record.entity");
let StockService = class StockService {
    constructor(productRepo, stockRepo, txRepo, wasteRecordRepo) {
        this.productRepo = productRepo;
        this.stockRepo = stockRepo;
        this.txRepo = txRepo;
        this.wasteRecordRepo = wasteRecordRepo;
    }
    async createProduct(dto) {
        const existing = await this.productRepo.findOne({ where: { name: dto.name } });
        if (existing)
            throw new common_1.ConflictException('Produsul există deja');
        const product = this.productRepo.create(dto);
        return await this.productRepo.save(product);
    }
    async findAllProducts() {
        return await this.productRepo.find();
    }
    async findProduct(id) {
        const product = await this.productRepo.findOne({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException('Produsul nu a fost găsit');
        return product;
    }
    async updateProduct(id, dto) {
        const product = await this.findProduct(id);
        Object.assign(product, dto);
        return await this.productRepo.save(product);
    }
    async deleteProduct(id) {
        const product = await this.findProduct(id);
        const stockCount = await this.stockRepo.count({ where: { product_id: id } });
        if (stockCount > 0)
            throw new common_1.BadRequestException('Produsul este folosit în stocuri');
        await this.productRepo.remove(product);
    }
    async createStock(dto) {
        const product = await this.findProduct(dto.product_id);
        const stock = this.stockRepo.create({ ...dto, product });
        return await this.stockRepo.save(stock);
    }
    async findAllStocks() {
        return await this.stockRepo.find({ relations: ['product'] });
    }
    async findStock(id) {
        const s = await this.stockRepo.findOne({ where: { id }, relations: ['product', 'transactions'] });
        if (!s)
            throw new common_1.NotFoundException('Stocul nu a fost găsit');
        return s;
    }
    async updateStock(id, dto) {
        const stock = await this.findStock(id);
        Object.assign(stock, dto);
        return await this.stockRepo.save(stock);
    }
    async deleteStock(id) {
        const stock = await this.findStock(id);
        await this.stockRepo.remove(stock);
    }
    async consumeProduct(productId, quantity, target = 'recipe-preparation') {
        let remaining = quantity;
        const stocks = await this.stockRepo.find({
            where: { product_id: productId, status: stock_entity_1.StockStatus.VALID, quantity: (0, typeorm_2.MoreThan)(0) },
            order: { expiration_date: 'ASC', entry_date: 'ASC' },
        });
        if (stocks.length === 0) {
            throw new common_1.BadRequestException(`Nu există stoc valid pentru produsul ${productId}`);
        }
        const totalAvailable = stocks.reduce((sum, stock) => sum + Number(stock.quantity), 0);
        if (totalAvailable < quantity) {
            throw new common_1.BadRequestException(`Cantitate insuficientă în stoc pentru produsul ${productId}. Disponibil: ${totalAvailable}, Necesar: ${quantity}, Lipsesc: ${quantity - totalAvailable}`);
        }
        for (const stock of stocks) {
            if (remaining <= 0)
                break;
            const availableInStock = Number(stock.quantity);
            const toConsume = Math.min(availableInStock, remaining);
            const tx = this.txRepo.create({ stock: stock, stock_id: stock.id, type: stock_transaction_entity_1.TransactionType.EXIT, quantity: toConsume, location: 'production', target });
            await this.txRepo.save(tx);
            stock.quantity = availableInStock - toConsume;
            stock.last_update = new Date();
            await this.stockRepo.save(stock);
            remaining -= toConsume;
        }
        if (remaining > 0) {
            throw new common_1.BadRequestException(`Eroare în logica de consum pentru produsul ${productId}. Cantitate rămasă neconsumat: ${remaining}`);
        }
    }
    async createTransaction(dto) {
        const stock = await this.findStock(dto.stock_id);
        if (dto.type === stock_transaction_entity_1.TransactionType.ENTRY) {
            stock.quantity += dto.quantity;
        }
        else {
            if (stock.quantity < dto.quantity)
                throw new common_1.BadRequestException('Cantitate insuficientă în stoc');
            stock.quantity -= dto.quantity;
        }
        stock.last_update = new Date();
        await this.stockRepo.save(stock);
        const tx = this.txRepo.create({ ...dto, stock });
        return await this.txRepo.save(tx);
    }
    async findAllTransactions() {
        return await this.txRepo.find({ relations: ['stock'] });
    }
    async createWasteRecord(dto) {
        const product = await this.findProduct(dto.product_id);
        const wasteRecord = this.wasteRecordRepo.create({ ...dto, product });
        return await this.wasteRecordRepo.save(wasteRecord);
    }
    async findAllWasteRecords() {
        return await this.wasteRecordRepo.find({ relations: ['product'], order: { created_at: 'DESC' } });
    }
    async findWasteRecord(id) {
        const wasteRecord = await this.wasteRecordRepo.findOne({ where: { id }, relations: ['product'] });
        if (!wasteRecord)
            throw new common_1.NotFoundException('Waste record not found');
        return wasteRecord;
    }
    async updateWasteRecord(id, dto) {
        const wasteRecord = await this.findWasteRecord(id);
        if (dto.product_id && dto.product_id !== wasteRecord.product_id) {
            await this.findProduct(dto.product_id);
        }
        Object.assign(wasteRecord, dto);
        return await this.wasteRecordRepo.save(wasteRecord);
    }
    async deleteWasteRecord(id) {
        const wasteRecord = await this.findWasteRecord(id);
        await this.wasteRecordRepo.remove(wasteRecord);
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(1, (0, typeorm_1.InjectRepository)(stock_entity_1.Stock)),
    __param(2, (0, typeorm_1.InjectRepository)(stock_transaction_entity_1.StockTransaction)),
    __param(3, (0, typeorm_1.InjectRepository)(waste_record_entity_1.WasteRecord)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StockService);
//# sourceMappingURL=stock.service.js.map