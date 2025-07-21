import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { NotificationService } from '../services/notification.service';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import {
  WebSocketConnectionException,
  WebSocketNotificationException,
  WebSocketBroadcastException,
  WebSocketClientManagementException,
} from '../exceptions/websocket.exceptions';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.WS_CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: process.env.WS_NAMESPACE || '/notifications',
})
@UseFilters(WebSocketExceptionFilter)
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly notificationService: NotificationService, private readonly jwtService: JwtService) {}

  /**
   * Handle client connection
   * Accepts all connections without authentication but allows optional user identification
   * @param client - The connected socket client
   */
  handleConnection(client: Socket): void {
    this.logger.log(`Client attempting connection: ${client.id}`);
    const token = this.extractToken(client);

    if (!token) {
      client.emit('error', {
        message: 'Connection failed',
        socketId: client.id,
        timestamp: new Date().toISOString(),
        code: 'AUTHENTICATION_REQUIRED'
      });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token);
      if (!payload || !payload.id) throw new Error('Invalid token payload')
      client.data.userId = payload.id
      this.notificationService.addClient(payload.id, client.id);

      client.emit('connected', {
        message: 'Successfully connected to notification service',
        socketId: client.id,
        userId: payload.id,
        timestamp: new Date().toISOString(),
        authenticated: true,
      });

      client.join(`user-${payload.id}`)

      this.logger.log(
        `Client registered with userId: ${payload.id}, socketId: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Error during client connection: ${client.id}`, error);

      client.emit('error', {
        message: 'Connection failed',
        socketId: client.id,
        timestamp: new Date().toISOString(),
        code: 'AUTHENTICATION_REQUIRED'
      });

      client.disconnect(true);

    }
  }

  /**
   * Handle client disconnection with proper cleanup
   * @param client - The disconnected socket client
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnecting: ${client.id}`);

    try {
      // Remove client from the service registry
      this.notificationService.removeClient(client.id);

      // Log successful cleanup
      this.logger.log(`Client cleanup completed for: ${client.id}`);
    } catch (error) {
      this.logger.error(
        `Error during client disconnection cleanup: ${client.id}`,
        error,
      );

      // Create a client management exception for disconnect errors
      // Note: We don't throw this since the client is already disconnecting
      // but we log it for monitoring purposes
      const disconnectException = new WebSocketClientManagementException(
        'Client removal failed',
        {
          socketId: client.id,
          operation: 'remove',
          reason: error.message,
          timestamp: new Date().toISOString(),
        },
      );

      this.logger.error(
        `WebSocket client management error during disconnect: ${client.id}`,
        disconnectException,
      );
    }
  }

  /**
   * Enviar notificación a todos los clientes conectados
   * @param notification - Objeto de notificación
   */
  sendToAll(notification: any): void {
    this.logger.log(`Enviando notificación a todos los clientes`);
    this.notificationService.broadcastNotification(
      notification,
      (socketId, notificationDto) => this.emitToSocket(socketId, 'notification', notificationDto)
    );
  }

  /**
   * Enviar notificación solo a los clientes con userId especificado
   * @param notification - Objeto de notificación
   * @param userIds - Array de userIds destino
   */
  sendToUsers(notification: any, userIds: string[]): void {
    this.logger.log(`Enviando notificación a usuarios: ${userIds.join(', ')}`);
    this.notificationService.sendToUsers(
      notification,
      userIds,
      (socketId, notificationDto) => this.emitToSocket(socketId, 'notification', notificationDto)
    );
  }

  /**
   * Emit message to a specific socket with error handling
   * @param socketId - The socket ID to emit to
   * @param event - The event name
   * @param data - The data to send
   */
  private emitToSocket(socketId: string, event: string, data: any): void {
    try {
      const socket = (this.server.sockets as unknown as Map<string, Socket>).get(socketId);
      if (socket) {
        socket.emit(event, data);
        this.logger.debug(`Mensaje enviado al socket ${socketId}: ${event}`);
      } else {
        this.logger.warn(
          `Socket ${socketId} no encontrado, eliminando del registro`,
        );
        // Limpieza del socket desconectado
        try {
          this.notificationService.removeClient(socketId);
        } catch (cleanupError) {
          this.logger.error(
            `Error al limpiar el socket desconectado ${socketId}:`,
            cleanupError,
          );
        }
        // Lanzar excepción para socket no encontrado
        throw new WebSocketNotificationException('Cliente no encontrado', {
          socketId: socketId,
          reason: 'El socket ya no existe en el registro del servidor',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error enviando mensaje al socket ${socketId}:`, error);
      // Limpieza del socket problemático
      try {
        this.notificationService.removeClient(socketId);
      } catch (cleanupError) {
        this.logger.error(
          `Error al limpiar el socket problemático ${socketId}:`,
          cleanupError,
        );
      }
      // Si ya es una excepción de WebSocket, relanzar
      if (error instanceof WebSocketNotificationException) {
        throw error;
      }
      // Para otros errores, envolver en una excepción de notificación
      throw new WebSocketNotificationException('Timeout de notificación', {
        socketId: socketId,
        reason: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get connection statistics
   * @returns Object with connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectedUsers: string[];
    anonymousConnections: number;
  } {
    const connectedUsers = this.notificationService.getConnectedUsers();
    const totalConnections =
      this.notificationService.getConnectedClientsCount();
    const anonymousConnections = this.notificationService
      .getConnectedClients()
      .filter((client) => client.userId === 'anonymous').length;

    return {
      totalConnections,
      connectedUsers: connectedUsers.filter((userId) => userId !== 'anonymous'),
      anonymousConnections,
    };
  }

  /** 
   * Extract user ID from client connection
   * @param client - The socket client
   * @returns User ID if available, null otherwise
   */
  private extractUserIdFromClient(client: Socket): string | null {
    // Try to get user ID from query parameters
    const userIdFromQuery = client.handshake.query.userId as string;
    if (userIdFromQuery && typeof userIdFromQuery === 'string') {
      return userIdFromQuery;
    }

    // Try to get user ID from auth object (if set by authentication middleware)
    const userIdFromAuth = client.handshake.auth?.userId as string;
    if (userIdFromAuth && typeof userIdFromAuth === 'string') {
      return userIdFromAuth;
    }

    // No user ID found
    return null;
  }

  // --- MÉTODOS AUXILIARES ---

  private extractToken(client: Socket): string | null {
    let token = client.handshake.headers?.authorization
    if (!token && client.handshake.auth?.token) {
      token = client.handshake.auth.token
    }
    if (token && token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '')
    }
    return token || null
  }
}
