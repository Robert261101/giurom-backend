import { Server } from 'socket.io';
export declare class NotificationsGateway {
    server: Server;
    emitUnreadCount(unread: number): void;
}
