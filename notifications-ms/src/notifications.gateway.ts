import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { UserResolutionService } from "./user-resolution.service";

@WebSocketGateway({
  namespace: "/notifications",
  path: "/notifications/socket.io",
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://giurom.bitap.ro",
      "http://giurom.bitap.ro",
      "http://giurom.bitap.ro:3000",
      "http://giurom.bitap.ro:3001",
      "https://giurom.bitap.ro:3000",
      "https://giurom.bitap.ro:3001",
      "http://89.46.6.45:3000",
      "http://89.46.6.45",
      "https://89.46.6.45",
      "https://restosoft.eu",
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.vercel\.app\/.*$/,
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly userResolution: UserResolutionService) {}

  handleConnection(client: Socket) {
    // Connection logging disabled to reduce noise
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 WebSocket Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join")
  async handleJoin(client: Socket, payload: { userId: number | string }) {
    const fromPayload = Number(payload.userId);
    // JWT sub = id_employee; notificările sunt emise la room user:user_id
    const resolvedUserId = await this.userResolution.resolveToUserId(fromPayload);
    const room = `user:${resolvedUserId}`;
    client.join(room);
    client.emit("joined", { userId: resolvedUserId, room, socketId: client.id });
  }

  emitUnreadCount(unread: number) {
    this.server.emit("notifications:unread", { unread });
  }

  // Emit new notification to specific user
  async emitNewNotification(userId: number, notification: any) {
    if (!this.server) {
      this.logger.error("WebSocket server is not initialized");
      return;
    }

    const room = `user:${userId}`;

    try {
      this.server.to(room).emit("notifications:new", notification);
    } catch (error) {
      this.logger.error(`Failed to emit notification to room ${room}:`, error);
    }
  }

  // Emit unread count to specific user
  emitUnreadCountForUser(userId: number, count: number) {
    const room = `user:${userId}`;
    this.server.to(room).emit("notifications:unread-update", { userId, count });
  }
}
