import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ 
  namespace: '/tasks',  // Namespace pentru Socket.IO - trebuie să corespundă cu ruta din API Gateway
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "https://giurom.bitap.ro", "http://giurom.bitap.ro"],
    methods: ["GET", "POST"],
    credentials: true
  }
})
export class TaskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(TaskGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`🔌 WebSocket Client conectat: ${client.id}`);
    this.logger.log(`🔌 Client IP: ${client.handshake.address}`);
    this.logger.log(`🔌 Client Origin: ${client.handshake.headers.origin}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 WebSocket Client deconectat: ${client.id}`);
  }

  // Emite task nou către toți utilizatorii
  notifyNewTask(task: any) {
    this.logger.log(`Emite task nou: ${task.id}`);
    this.server.emit('newTask', task);
  }

  // Emite task către un utilizator specific
  notifyTaskToUser(userId: number, task: any) {
    this.logger.log(`Emite task către utilizatorul ${userId}: ${task.id}`);
    this.server.to(`user_${userId}`).emit('newTask', task);
  }

  // Emite task către toți utilizatorii dintr-un departament
  notifyTaskToDepartment(departmentId: number, task: any) {
    this.logger.log(`Emite task către departamentul ${departmentId}: ${task.id}`);
    this.server.to(`department_${departmentId}`).emit('newTask', task);
  }

  // Emite actualizare task către toți utilizatorii
  notifyTaskUpdate(task: any) {
    this.logger.log(`Emite actualizare task: ${task.id}`);
    this.server.emit('taskUpdate', task);
  }

  // Emite task completat către toți utilizatorii
  notifyTaskCompleted(task: any) {
    this.logger.log(`Emite task completat: ${task.id}`);
    this.server.emit('taskCompleted', task);
  }
}
