import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import {
  ConnectedClient,
  BaseNotification,
} from '../interfaces/notification.interface';
import { WebhookNotificationDto } from '../dto/webhook-notification.dto';
import { WebSocketNotificationDto } from '../dto/websocket-notification.dto';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Client Management', () => {
    describe('addClient', () => {
      it('should add a client to the connected clients registry', () => {
        const userId = 'user1';
        const socketId = 'socket1';

        service.addClient(userId, socketId);

        const clients = service.getConnectedClients();
        expect(clients).toHaveLength(1);
        expect(clients[0]).toEqual({
          socketId,
          userId,
          connectedAt: expect.any(Date),
        });
      });

      it('should add multiple clients for the same user', () => {
        const userId = 'user1';
        const socketId1 = 'socket1';
        const socketId2 = 'socket2';

        service.addClient(userId, socketId1);
        service.addClient(userId, socketId2);

        const clients = service.getConnectedClients();
        expect(clients).toHaveLength(2);
        expect(clients.map((c) => c.socketId)).toContain(socketId1);
        expect(clients.map((c) => c.socketId)).toContain(socketId2);
      });

      it('should add clients for different users', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');

        const clients = service.getConnectedClients();
        expect(clients).toHaveLength(2);
        expect(clients.map((c) => c.userId)).toContain('user1');
        expect(clients.map((c) => c.userId)).toContain('user2');
      });
    });

    describe('removeClient', () => {
      it('should remove a client from the connected clients registry', () => {
        const userId = 'user1';
        const socketId = 'socket1';

        service.addClient(userId, socketId);
        expect(service.getConnectedClients()).toHaveLength(1);

        service.removeClient(socketId);
        expect(service.getConnectedClients()).toHaveLength(0);
      });

      it('should handle removing non-existent client gracefully', () => {
        service.removeClient('non-existent-socket');
        expect(service.getConnectedClients()).toHaveLength(0);
      });

      it('should only remove the specified client', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');

        service.removeClient('socket1');

        const clients = service.getConnectedClients();
        expect(clients).toHaveLength(1);
        expect(clients[0].socketId).toBe('socket2');
      });
    });

    describe('getConnectedUsers', () => {
      it('should return empty array when no clients are connected', () => {
        const users = service.getConnectedUsers();
        expect(users).toEqual([]);
      });

      it('should return unique user IDs', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user1', 'socket2'); // Same user, different socket
        service.addClient('user2', 'socket3');

        const users = service.getConnectedUsers();
        expect(users).toHaveLength(2);
        expect(users).toContain('user1');
        expect(users).toContain('user2');
      });

      it('should return all connected users', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');
        service.addClient('user3', 'socket3');

        const users = service.getConnectedUsers();
        expect(users).toHaveLength(3);
        expect(users).toEqual(
          expect.arrayContaining(['user1', 'user2', 'user3']),
        );
      });
    });

    describe('getClientsByUserId', () => {
      it('should return empty array for non-existent user', () => {
        const clients = service.getClientsByUserId('non-existent-user');
        expect(clients).toEqual([]);
      });

      it('should return all clients for a specific user', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user1', 'socket2');
        service.addClient('user2', 'socket3');

        const user1Clients = service.getClientsByUserId('user1');
        expect(user1Clients).toHaveLength(2);
        expect(user1Clients.map((c) => c.socketId)).toEqual([
          'socket1',
          'socket2',
        ]);

        const user2Clients = service.getClientsByUserId('user2');
        expect(user2Clients).toHaveLength(1);
        expect(user2Clients[0].socketId).toBe('socket3');
      });
    });

    describe('isUserConnected', () => {
      it('should return false for non-connected user', () => {
        expect(service.isUserConnected('user1')).toBe(false);
      });

      it('should return true for connected user', () => {
        service.addClient('user1', 'socket1');
        expect(service.isUserConnected('user1')).toBe(true);
      });

      it('should return false after user disconnects', () => {
        service.addClient('user1', 'socket1');
        expect(service.isUserConnected('user1')).toBe(true);

        service.removeClient('socket1');
        expect(service.isUserConnected('user1')).toBe(false);
      });

      it('should return true if user has multiple connections and one disconnects', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user1', 'socket2');
        expect(service.isUserConnected('user1')).toBe(true);

        service.removeClient('socket1');
        expect(service.isUserConnected('user1')).toBe(true);
      });
    });

    describe('getConnectedClientsCount', () => {
      it('should return 0 when no clients are connected', () => {
        expect(service.getConnectedClientsCount()).toBe(0);
      });

      it('should return correct count of connected clients', () => {
        service.addClient('user1', 'socket1');
        expect(service.getConnectedClientsCount()).toBe(1);

        service.addClient('user2', 'socket2');
        expect(service.getConnectedClientsCount()).toBe(2);

        service.removeClient('socket1');
        expect(service.getConnectedClientsCount()).toBe(1);
      });
    });
  });

  describe('Notification Processing', () => {
    describe('processWebhookNotification', () => {
      it('should process webhook notification with all fields', () => {
        const webhookNotification: WebhookNotificationDto = {
          type: 'alert',
          message: 'Test message',
          data: { key: 'value' },
          priority: 'high',
          targetUsers: ['user1', 'user2'],
        };

        const result = service.processWebhookNotification(webhookNotification);

        expect(result).toEqual({
          id: expect.any(String),
          type: 'alert',
          message: 'Test message',
          data: { key: 'value' },
          priority: 'high',
          timestamp: expect.any(Date),
          source: 'webhook',
        });
      });

      it('should process webhook notification with default priority', () => {
        const webhookNotification: WebhookNotificationDto = {
          type: 'info',
          message: 'Test message',
        };

        const result = service.processWebhookNotification(webhookNotification);

        expect(result.priority).toBe('normal');
        expect(result.source).toBe('webhook');
        expect(result.id).toBeDefined();
        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it('should generate unique IDs for different notifications', () => {
        const webhookNotification: WebhookNotificationDto = {
          type: 'test',
          message: 'Test message',
        };

        const result1 = service.processWebhookNotification(webhookNotification);
        const result2 = service.processWebhookNotification(webhookNotification);

        expect(result1.id).not.toBe(result2.id);
      });
    });

    describe('broadcastNotification', () => {
      let mockEmitFunction: jest.Mock;

      beforeEach(() => {
        mockEmitFunction = jest.fn();
      });

      it('should broadcast notification to all connected clients', () => {
        // Add some clients
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');
        service.addClient('user3', 'socket3');

        const notification: BaseNotification = {
          id: 'test-id',
          type: 'broadcast',
          message: 'Broadcast message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.broadcastNotification(
          notification,
          mockEmitFunction,
        );

        expect(result).toHaveLength(3);
        expect(result).toEqual(['socket1', 'socket2', 'socket3']);
        expect(mockEmitFunction).toHaveBeenCalledTimes(3);

        // Verify the notification format sent to clients
        expect(mockEmitFunction).toHaveBeenCalledWith('socket1', {
          id: 'test-id',
          type: 'broadcast',
          message: 'Broadcast message',
          priority: 'normal',
          timestamp: notification.timestamp.toISOString(),
          source: 'webhook',
          data: undefined,
        });
      });

      it('should return empty array when no clients are connected', () => {
        const notification: BaseNotification = {
          id: 'test-id',
          type: 'broadcast',
          message: 'Broadcast message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.broadcastNotification(
          notification,
          mockEmitFunction,
        );

        expect(result).toEqual([]);
        expect(mockEmitFunction).not.toHaveBeenCalled();
      });

      it('should handle emit function errors gracefully', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');

        mockEmitFunction.mockImplementation((socketId) => {
          if (socketId === 'socket1') {
            throw new Error('Emit failed');
          }
        });

        const notification: BaseNotification = {
          id: 'test-id',
          type: 'broadcast',
          message: 'Broadcast message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.broadcastNotification(
          notification,
          mockEmitFunction,
        );

        expect(result).toEqual(['socket2']); // Only socket2 should succeed
        expect(mockEmitFunction).toHaveBeenCalledTimes(2);
      });
    });

    describe('sendToUsers', () => {
      let mockEmitFunction: jest.Mock;

      beforeEach(() => {
        mockEmitFunction = jest.fn();
      });

      it('should send notification to specific users', () => {
        // Add clients for different users
        service.addClient('user1', 'socket1');
        service.addClient('user1', 'socket2'); // Same user, multiple connections
        service.addClient('user2', 'socket3');
        service.addClient('user3', 'socket4'); // This user won't receive the notification

        const notification: BaseNotification = {
          id: 'test-id',
          type: 'targeted',
          message: 'Targeted message',
          priority: 'high',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.sendToUsers(
          notification,
          ['user1', 'user2'],
          mockEmitFunction,
        );

        expect(result).toHaveLength(3); // user1 has 2 connections, user2 has 1
        expect(result).toEqual(['socket1', 'socket2', 'socket3']);
        expect(mockEmitFunction).toHaveBeenCalledTimes(3);
      });

      it('should handle non-existent users gracefully', () => {
        service.addClient('user1', 'socket1');

        const notification: BaseNotification = {
          id: 'test-id',
          type: 'targeted',
          message: 'Targeted message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.sendToUsers(
          notification,
          ['user1', 'non-existent-user'],
          mockEmitFunction,
        );

        expect(result).toEqual(['socket1']);
        expect(mockEmitFunction).toHaveBeenCalledTimes(1);
      });

      it('should return empty array when no target users are connected', () => {
        const notification: BaseNotification = {
          id: 'test-id',
          type: 'targeted',
          message: 'Targeted message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.sendToUsers(
          notification,
          ['non-existent-user'],
          mockEmitFunction,
        );

        expect(result).toEqual([]);
        expect(mockEmitFunction).not.toHaveBeenCalled();
      });

      it('should handle emit function errors gracefully', () => {
        service.addClient('user1', 'socket1');
        service.addClient('user2', 'socket2');

        mockEmitFunction.mockImplementation((socketId) => {
          if (socketId === 'socket1') {
            throw new Error('Emit failed');
          }
        });

        const notification: BaseNotification = {
          id: 'test-id',
          type: 'targeted',
          message: 'Targeted message',
          priority: 'normal',
          timestamp: new Date(),
          source: 'webhook',
        };

        const result = service.sendToUsers(
          notification,
          ['user1', 'user2'],
          mockEmitFunction,
        );

        expect(result).toEqual(['socket2']); // Only socket2 should succeed
        expect(mockEmitFunction).toHaveBeenCalledTimes(2);
      });
    });
  });
});
