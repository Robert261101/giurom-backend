import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { RecipeLabel } from '../recipe-labels/entities/recipe-label.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(RecipeLabel)
    private readonly recipeLabelRepo: Repository<RecipeLabel>,
  ) {}

  // Create a new notification
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create({
      ...createNotificationDto,
      expires_at: createNotificationDto.expires_at ? new Date(createNotificationDto.expires_at) : null,
    });

    const savedNotification = await this.notificationRepo.save(notification);
    
    console.log(`✅ Notification created: ${savedNotification.title}`);
    
    // TODO: Emit WebSocket event when implemented
    // this.notificationGateway.emitToUser(savedNotification.user_id, 'new_notification', savedNotification);
    
    return savedNotification;
  }

  // Get all notifications for a user
  async findAllForUser(userId?: number): Promise<Notification[]> {
    const whereCondition = userId ? { user_id: userId } : {};
    
    return this.notificationRepo.find({
      where: whereCondition,
      order: { created_at: 'DESC' },
    });
  }

  // Get unread notifications count for a user
  async getUnreadCount(userId?: number): Promise<number> {
    const whereCondition = userId 
      ? { user_id: userId, status: NotificationStatus.UNREAD }
      : { status: NotificationStatus.UNREAD };
    
    return this.notificationRepo.count({
      where: whereCondition,
    });
  }

  // Mark notification as read
  async markAsRead(id: number): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    notification.status = NotificationStatus.READ;
    return this.notificationRepo.save(notification);
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId?: number): Promise<void> {
    const whereCondition = userId ? { user_id: userId } : {};
    
    await this.notificationRepo.update(
      { ...whereCondition, status: NotificationStatus.UNREAD },
      { status: NotificationStatus.READ }
    );
  }

  // Delete notification
  async remove(id: number): Promise<void> {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    await this.notificationRepo.remove(notification);
  }

  // Create label expiration notification
  async createLabelExpirationNotification(
    labelId: number,
    recipeName: string,
    expirationDate: Date,
    labelCode: string,
    userId?: number
  ): Promise<Notification> {
    const notification = await this.create({
      type: NotificationType.LABEL_EXPIRING,
      title: `Label va expira`,
      description: `Label-ul pentru "${recipeName}" (${labelCode}) va expira pe ${expirationDate.toLocaleDateString('ro-RO')}`,
      user_id: userId,
      entity_id: labelId,
      entity_type: 'recipe_label',
      target_url: `/retetar/istoric-etichete`,
      expires_at: expirationDate.toISOString(),
      priority: 'high',
      metadata: {
        recipe_name: recipeName,
        label_code: labelCode,
        expiration_date: expirationDate,
        notification_sent_at: new Date(),
      }
    });

    return notification;
  }

  // Cron job to check for expiring labels (runs every hour)
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiringLabels(): Promise<void> {
    console.log('🔍 Checking for expiring labels...');
    
    try {
      // Calculate the time window: 0-2 hours from now (temporarily for testing)
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Query recipe labels with their preparations and recipes
      const labels = await this.recipeLabelRepo.find({
        relations: ['preparation', 'preparation.recipe'],
      });

      console.log(`📋 Found ${labels.length} labels to check`);
      
      // Debug: log all labels found
      for (const label of labels) {
        console.log(`🔍 Label found: ID=${label.id}, Code=${label.label_code}, Generated=${label.generated_at}`);
        if (label.preparation) {
          console.log(`   Preparation: ID=${label.preparation.id}, Produced=${label.preparation.produced_at}`);
          if (label.preparation.recipe) {
            console.log(`   Recipe: ID=${label.preparation.recipe.id}, Name=${label.preparation.recipe.name}, ExpirationHours=${label.preparation.recipe.expiration_hours}`);
          } else {
            console.log(`   ❌ No recipe found for preparation ${label.preparation.id}`);
          }
        } else {
          console.log(`   ❌ No preparation found for label ${label.id}`);
        }
      }

      for (const label of labels) {
        if (!label.preparation || !label.preparation.recipe) {
          console.log(`⚠️ Skipping label ${label.label_code} - missing preparation or recipe data`);
          continue;
        }

        // Calculate expiration date based on production date + recipe expiration hours
        const productionDate = new Date(label.preparation.produced_at);
        const expirationDate = new Date(productionDate.getTime() + (label.preparation.recipe.expiration_hours * 60 * 60 * 1000));

        console.log(`🏷️ Label ${label.label_code} for "${label.preparation.recipe.name}"`);
        console.log(`   Production: ${productionDate.toLocaleString('ro-RO')}`);
        console.log(`   Expiration: ${expirationDate.toLocaleString('ro-RO')}`);
        console.log(`   Hours until expiration: ${Math.round((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60))}`);

        // Check if label expires in the next 0-2 hours (temporarily for testing)
        if (expirationDate >= now && expirationDate <= twoHoursFromNow) {
          // Check if we already sent a notification for this label expiration
          const existingNotification = await this.notificationRepo.findOne({
            where: {
              type: NotificationType.LABEL_EXPIRING,
              entity_id: label.id,
              entity_type: 'recipe_label',
              expires_at: MoreThan(now),
            }
          });

          if (!existingNotification) {
            await this.createLabelExpirationNotification(
              label.id,
              label.preparation.recipe.name,
              expirationDate,
              label.label_code
            );
            
            console.log(`📢 Created expiration notification for label: ${label.label_code} (${label.preparation.recipe.name})`);
          } else {
            console.log(`ℹ️ Notification already exists for label: ${label.label_code}`);
          }
        }
      }
      
      console.log('✅ Finished checking expiring labels');
    } catch (error) {
      console.error('❌ Error checking expiring labels:', error);
    }
  }

  // Clean up old notifications (runs daily at midnight)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<void> {
    console.log('🧹 Cleaning up old notifications...');
    
    try {
      // Delete notifications older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.notificationRepo.delete({
        created_at: LessThan(thirtyDaysAgo),
        status: NotificationStatus.READ,
      });

      console.log(`✅ Cleaned up ${result.affected} old notifications`);
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
    }
  }

  // Debug method to check labels and calculations
  async debugLabels(): Promise<any> {
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      // Query recipe labels with their preparations and recipes
      const labels = await this.recipeLabelRepo.find({
        relations: ['preparation', 'preparation.recipe'],
      });

      const debugInfo = {
        currentTime: now.toISOString(),
        twoHoursFromNow: twoHoursFromNow.toISOString(),
        threeHoursFromNow: threeHoursFromNow.toISOString(),
        totalLabels: labels.length,
        labels: []
      };

      for (const label of labels) {
        const labelInfo: any = {
          id: label.id,
          labelCode: label.label_code,
          generatedAt: label.generated_at,
          hasPreparation: !!label.preparation,
          hasRecipe: !!(label.preparation && label.preparation.recipe)
        };

        if (label.preparation && label.preparation.recipe) {
          const productionDate = new Date(label.preparation.produced_at);
          const expirationDate = new Date(productionDate.getTime() + (label.preparation.recipe.expiration_hours * 60 * 60 * 1000));
          const hoursUntilExpiration = Math.round((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60));

          labelInfo.preparation = {
            id: label.preparation.id,
            producedAt: label.preparation.produced_at,
            productionDate: productionDate.toISOString()
          };
          
          labelInfo.recipe = {
            id: label.preparation.recipe.id,
            name: label.preparation.recipe.name,
            expirationHours: label.preparation.recipe.expiration_hours
          };

          labelInfo.calculations = {
            expirationDate: expirationDate.toISOString(),
            hoursUntilExpiration,
            isExpiringSoon: expirationDate >= now && expirationDate <= twoHoursFromNow,
            willExpireInWindow: `${expirationDate >= now} && ${expirationDate <= twoHoursFromNow}`
          };
        }

        debugInfo.labels.push(labelInfo);
      }

      return debugInfo;
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack
      };
    }
  }
}