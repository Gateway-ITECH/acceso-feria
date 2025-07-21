import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedClient,
  BaseNotification,
} from '../interfaces/notification.interface';
import { WebhookNotificationDto } from '../dto/webhook-notification.dto';
import { WebSocketNotificationDto } from '../dto/websocket-notification.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly connectedClients = new Map<string, ConnectedClient>();

  /**
   * Add a client to the connected clients registry
   * @param userId - The user ID associated with the client
   * @param socketId - The socket ID of the connected client
   */
  addClient(userId: string, socketId: string): void {
    const client: ConnectedClient = {
      socketId,
      userId,
      connectedAt: new Date(),
    };

    this.connectedClients.set(socketId, client);
    this.logger.log(`Client added: userId=${userId}, socketId=${socketId}`);
  }

  /**
   * Remove a client from the connected clients registry
   * @param socketId - The socket ID of the client to remove
   */
  removeClient(socketId: string): void {
    const client = this.connectedClients.get(socketId);
    if (client) {
      this.connectedClients.delete(socketId);
      this.logger.log(
        `Client removed: userId=${client.userId}, socketId=${socketId}`,
      );
    }
  }

  /**
   * Get all connected users
   * @returns Array of user IDs that are currently connected
   */
  getConnectedUsers(): string[] {
    const userIds = Array.from(this.connectedClients.values()).map(
      (client) => client.userId,
    );
    return [...new Set(userIds)]; // Remove duplicates in case a user has multiple connections
  }

  /**
   * Get all connected clients
   * @returns Array of all connected clients
   */
  getConnectedClients(): ConnectedClient[] {
    return Array.from(this.connectedClients.values());
  }

  /**
   * Get clients by user ID
   * @param userId - The user ID to search for
   * @returns Array of clients for the specified user
   */
  getClientsByUserId(userId: string): ConnectedClient[] {
    return Array.from(this.connectedClients.values()).filter(
      (client) => client.userId === userId,
    );
  }

  /**
   * Check if a user is connected
   * @param userId - The user ID to check
   * @returns True if the user has at least one active connection
   */
  isUserConnected(userId: string): boolean {
    return this.getClientsByUserId(userId).length > 0;
  }

  /**
   * Get the total number of connected clients
   * @returns Number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Process a webhook notification and convert it to internal format
   * @param webhookNotification - The incoming webhook notification
   * @returns Processed notification ready for distribution
   */
  processWebhookNotification(
    webhookNotification: WebhookNotificationDto,
  ): BaseNotification {
    const processedNotification: BaseNotification = {
      id: uuidv4(),
      type: webhookNotification.type,
      message: webhookNotification.message,
      data: webhookNotification.data,
      priority: webhookNotification.priority || 'normal',
      timestamp: new Date(),
      source: 'webhook',
    };

    this.logger.log(
      `Processed webhook notification: id=${processedNotification.id}, type=${processedNotification.type}`,
    );

    return processedNotification;
  }

  /**
   * Broadcast a notification to all connected clients
   * @param notification - The notification to broadcast
   * @param emitFunction - Function to emit the notification to a socket
   * @returns Array of socket IDs that received the notification
   */
  broadcastNotification(
    notification: BaseNotification,
    emitFunction: (
      socketId: string,
      notification: WebSocketNotificationDto,
    ) => void,
  ): string[] {
    const allSocketIds = Array.from(this.connectedClients.keys());
    const successfulSocketIds: string[] = [];
    const websocketNotification = this.transformToWebSocketDto(notification);

    allSocketIds.forEach((socketId) => {
      try {
        emitFunction(socketId, websocketNotification);
        successfulSocketIds.push(socketId);
        this.logger.debug(`Notification sent to socket: ${socketId}`);
      } catch (error) {
        this.logger.error(
          `Failed to send notification to socket ${socketId}:`,
          error,
        );
      }
    });

    this.logger.log(
      `Broadcast notification sent to ${successfulSocketIds.length} clients: id=${notification.id}`,
    );

    return successfulSocketIds;
  }

  /**
   * Send a notification to specific users
   * @param notification - The notification to send
   * @param userIds - Array of user IDs to send the notification to
   * @param emitFunction - Function to emit the notification to a socket
   * @returns Array of socket IDs that received the notification
   */
  sendToUsers(
    notification: BaseNotification,
    userIds: string[],
    emitFunction: (
      socketId: string,
      notification: WebSocketNotificationDto,
    ) => void,
  ): string[] {
    const successfulSocketIds: string[] = [];
    const websocketNotification = this.transformToWebSocketDto(notification);

    userIds.forEach((userId) => {
      const userClients = this.getClientsByUserId(userId);
      userClients.forEach((client) => {
        try {
          emitFunction(client.socketId, websocketNotification);
          successfulSocketIds.push(client.socketId);
          this.logger.debug(
            `Notification sent to user ${userId}, socket: ${client.socketId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send notification to user ${userId}, socket ${client.socketId}:`,
            error,
          );
        }
      });
    });

    this.logger.log(
      `Targeted notification sent to ${successfulSocketIds.length} clients for ${userIds.length} users: id=${notification.id}`,
    );

    return successfulSocketIds;
  }

  /**
   * Transform a BaseNotification to WebSocketNotificationDto
   * @param notification - The base notification to transform
   * @returns WebSocket notification DTO
   */
  private transformToWebSocketDto(
    notification: BaseNotification,
  ): WebSocketNotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.timestamp.toISOString(),
      source: notification.source,
    };
  }
}
