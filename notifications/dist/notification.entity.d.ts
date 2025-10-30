export declare class NotificationEntity {
    id: number;
    type: string;
    title: string;
    description: string | null;
    user_id: number | null;
    status: 'unread' | 'read' | 'archived';
    entity_id: number | null;
    entity_type: string | null;
    target_url: string | null;
    metadata: any | null;
    expires_at: Date | null;
    priority: 'low' | 'medium' | 'high';
    created_at: Date;
    updated_at: Date;
}
