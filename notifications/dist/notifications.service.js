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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notifications_gateway_1 = require("./notifications.gateway");
const notification_entity_1 = require("./notification.entity");
let NotificationsService = class NotificationsService {
    constructor(gateway, repo) {
        this.gateway = gateway;
        this.repo = repo;
        this.notifications = [];
        this.nextId = 1;
    }
    async getUnreadCount() {
        const count = await this.repo.count({ where: { status: 'unread' } });
        return { count };
    }
    async onExpiringLabel(event) {
        const existing = await this.repo.findOne({ where: { entity_id: event.labelId, entity_type: 'recipe_label', type: 'label_expiring' } });
        if (existing) {
            return existing;
        }
        const saved = await this.create({
            type: 'label_expiring',
            title: 'Etichetă aproape de expirare',
            description: `Eticheta ${event.labelCode} va expira la ${new Date(event.expiresAt).toLocaleString('ro-RO')}`,
            entity_id: event.labelId,
            entity_type: 'recipe_label',
            target_url: '/retetar/istoric-etichete',
            metadata: { preparationId: event.preparationId, labelCode: event.labelCode, expiresAt: event.expiresAt },
            priority: 'high',
            status: 'unread',
            expires_at: event.expiresAt,
        });
        return saved;
    }
    async findAll() {
        return this.repo.find({ order: { created_at: 'DESC' } });
    }
    async create(notification) {
        const entity = this.repo.create({
            type: notification.type || 'general',
            title: notification.title || 'Notificare',
            description: notification.description || null,
            user_id: notification.user_id ?? null,
            status: notification.status || 'unread',
            entity_id: notification.entity_id ?? null,
            entity_type: notification.entity_type ?? null,
            target_url: notification.target_url ?? null,
            metadata: notification.metadata ?? null,
            expires_at: notification.expires_at ?? null,
            priority: notification.priority || 'low',
        });
        const saved = await this.repo.save(entity);
        const count = await this.repo.count({ where: { status: 'unread' } });
        this.gateway.emitUnreadCount(count);
        return saved;
    }
    async markAsRead(id) {
        await this.repo.update({ id }, { status: 'read' });
        const count = await this.repo.count({ where: { status: 'unread' } });
        this.gateway.emitUnreadCount(count);
        return { id };
    }
    async markAllAsRead() {
        await this.repo.createQueryBuilder().update(notification_entity_1.NotificationEntity).set({ status: 'read' }).where("status = 'unread'").execute();
        const count = await this.repo.count({ where: { status: 'unread' } });
        this.gateway.emitUnreadCount(count);
        return { message: 'All notifications marked as read' };
    }
    seedExpiringLabel() {
        return this.create({
            type: 'label_expiring',
            title: 'Label va expira',
            description: 'Label-ul este aproape de expirare',
            priority: 'high',
            target_url: '/retetar/istoric-etichete',
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.NotificationEntity)),
    __metadata("design:paramtypes", [notifications_gateway_1.NotificationsGateway,
        typeorm_2.Repository])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map