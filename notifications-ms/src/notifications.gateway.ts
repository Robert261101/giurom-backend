import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: ['http://localhost:3000', 'http://localhost:3001'] } })
@Injectable()
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  emitUnreadCount(unread: number) {
    this.server.emit('notifications:unread', { unread });
  }
}




