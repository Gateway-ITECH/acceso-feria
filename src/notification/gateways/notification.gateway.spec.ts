import { Test, TestingModule } from '@nestjs/testing';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from '../services/notification.service';
import { Socket } from 'socket.io';
import {
  WebSocketConnectionException,
  WebSocketNotificationException,
  WebSocketBroadcastException,
  WebSocketClientManagementException,
} from '../exceptions/websocket.exceptions';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let notificationService: NotificationService;
  let mockSocket: any;

  beforeEach(async () => {
    const mockNotificationService = {
      addClient: jest.fn(),
      removeClient: jest.fn(),
      getConnectedClientsCount: jest.fn().mockReturnValue(0),
      broadcastNotification: jest.fn(),
      sendToUsers: jest.fn(),
      getConnectedUsers: jest.fn().mockReturnValue([]),
      getConnectedClients: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    notificationService = module.get<NotificationService>(NotificationService);

    // Mock socket object
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
      handshake: {
        query: {},
        auth: {},
        headers: {},
        time: new Date().toISOString(),
        address: '127.0.0.1',
        xdomain: false,
        secure: false,
        issued: Date.now(),
        url: '/notifications',
      },
    };
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should register client with user ID from query parameters', () => {
      mockSocket.handshake.query = { userId: 'test-user-123' };

      gateway.handleConnection(mockSocket as Socket);

      expect(notificationService.addClient).toHaveBeenCalledWith(
        'test-user-123',
        'test-socket-id',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to notification service',
        socketId: 'test-socket-id',
        userId: 'test-user-123',
        timestamp: expect.any(String),
        authenticated: true,
      });
    });

    it('should register client with user ID from auth object', () => {
      mockSocket.handshake.auth = { userId: 'auth-user-456' };

      gateway.handleConnection(mockSocket as Socket);

      expect(notificationService.addClient).toHaveBeenCalledWith(
        'auth-user-456',
        'test-socket-id',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to notification service',
        socketId: 'test-socket-id',
        userId: 'auth-user-456',
        timestamp: expect.any(String),
        authenticated: true,
      });
    });

    it('should register anonymous client when no user ID is provided', () => {
      gateway.handleConnection(mockSocket as Socket);

      expect(notificationService.addClient).toHaveBeenCalledWith(
        'anonymous',
        'test-socket-id',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to notification service (anonymous)',
        socketId: 'test-socket-id',
        userId: null,
        timestamp: expect.any(String),
        authenticated: false,
      });
    });

    it('should prioritize query parameter over auth object for user ID', () => {
      mockSocket.handshake.query = { userId: 'query-user' };
      mockSocket.handshake.auth = { userId: 'auth-user' };

      gateway.handleConnection(mockSocket as Socket);

      expect(notificationService.addClient).toHaveBeenCalledWith(
        'query-user',
        'test-socket-id',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to notification service',
        socketId: 'test-socket-id',
        userId: 'query-user',
        timestamp: expect.any(String),
        authenticated: true,
      });
    });

    it('should handle array values in query parameters', () => {
      mockSocket.handshake.query = { userId: ['user1', 'user2'] };

      gateway.handleConnection(mockSocket as Socket);

      expect(notificationService.addClient).toHaveBeenCalledWith(
        'anonymous',
        'test-socket-id',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to notification service (anonymous)',
        socketId: 'test-socket-id',
        userId: null,
        timestamp: expect.any(String),
        authenticated: false,
      });
    });

    it('should throw WebSocketClientManagementException for user registration errors', () => {
      mockSocket.handshake.query = { userId: 'test-user-123' };

      const mockNotificationServiceWithError = {
        addClient: jest.fn().mockImplementation(() => {
          throw new Error('Service error');
        }),
        removeClient: jest.fn(),
      };

      // Replace the service temporarily
      (gateway as any).notificationService = mockNotificationServiceWithError;

      expect(() => {
        gateway.handleConnection(mockSocket as Socket);
      }).toThrow(WebSocketClientManagementException);

      expect(mockNotificationServiceWithError.addClient).toHaveBeenCalledWith(
        'test-user-123',
        'test-socket-id',
      );
    });

    it('should throw WebSocketClientManagementException for anonymous registration errors', () => {
      const mockNotificationServiceWithError = {
        addClient: jest.fn().mockImplementation(() => {
          throw new Error('Anonymous registration error');
        }),
        removeClient: jest.fn(),
      };

      // Replace the service temporarily
      (gateway as any).notificationService = mockNotificationServiceWithError;

      expect(() => {
        gateway.handleConnection(mockSocket as Socket);
      }).toThrow(WebSocketClientManagementException);

      expect(mockNotificationServiceWithError.addClient).toHaveBeenCalledWith(
        'anonymous',
        'test-socket-id',
      );
    });

    it('should throw WebSocketConnectionException for unexpected connection errors', () => {
      // Mock extractUserIdFromClient to throw an error
      jest
        .spyOn(gateway as any, 'extractUserIdFromClient')
        .mockImplementation(() => {
          throw new Error('Unexpected connection error');
        });

      expect(() => {
        gateway.handleConnection(mockSocket as Socket);
      }).toThrow(WebSocketConnectionException);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client from service registry', () => {
      gateway.handleDisconnect(mockSocket as Socket);

      expect(notificationService.removeClient).toHaveBeenCalledWith(
        'test-socket-id',
      );
    });

    it('should handle disconnect errors gracefully', () => {
      const mockNotificationServiceWithError = {
        addClient: jest.fn(),
        removeClient: jest.fn().mockImplementation(() => {
          throw new Error('Disconnect error');
        }),
      };

      // Replace the service temporarily
      (gateway as any).notificationService = mockNotificationServiceWithError;

      // Should not throw error
      expect(() => {
        gateway.handleDisconnect(mockSocket as Socket);
      }).not.toThrow();

      expect(
        mockNotificationServiceWithError.removeClient,
      ).toHaveBeenCalledWith('test-socket-id');
    });

    it('should complete cleanup process even with service errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockNotificationServiceWithError = {
        addClient: jest.fn(),
        removeClient: jest.fn().mockImplementation(() => {
          throw new Error('Service cleanup error');
        }),
      };

      (gateway as any).notificationService = mockNotificationServiceWithError;

      gateway.handleDisconnect(mockSocket as Socket);

      expect(
        mockNotificationServiceWithError.removeClient,
      ).toHaveBeenCalledWith('test-socket-id');

      consoleSpy.mockRestore();
    });
  });

  describe('broadcastNotification', () => {
    it('should broadcast notification to all connected clients', () => {
      const mockNotification = {
        id: 'test-notification-123',
        type: 'info',
        message: 'Test broadcast message',
      };

      const mockBroadcastService = {
        ...notificationService,
        getConnectedClientsCount: jest.fn().mockReturnValue(2),
        broadcastNotification: jest
          .fn()
          .mockReturnValue(['socket1', 'socket2']),
      };

      (gateway as any).notificationService = mockBroadcastService;
      (gateway as any).emitToSocket = jest.fn();

      gateway.broadcastNotification(mockNotification);

      expect(mockBroadcastService.broadcastNotification).toHaveBeenCalledWith(
        mockNotification,
        expect.any(Function),
      );
    });

    it('should throw WebSocketBroadcastException when no clients are connected', () => {
      const mockNotification = {
        id: 'test-notification-456',
        type: 'error',
        message: 'Test error broadcast',
      };

      const mockBroadcastService = {
        ...notificationService,
        getConnectedClientsCount: jest.fn().mockReturnValue(0),
        broadcastNotification: jest.fn(),
      };

      (gateway as any).notificationService = mockBroadcastService;

      expect(() => {
        gateway.broadcastNotification(mockNotification);
      }).toThrow(WebSocketBroadcastException);

      expect(mockBroadcastService.getConnectedClientsCount).toHaveBeenCalled();
    });

    it('should throw WebSocketBroadcastException for broadcast service errors', () => {
      const mockNotification = {
        id: 'test-notification-error',
        type: 'error',
        message: 'Test service error broadcast',
      };

      const mockBroadcastService = {
        ...notificationService,
        getConnectedClientsCount: jest.fn().mockReturnValue(2),
        broadcastNotification: jest.fn().mockImplementation(() => {
          throw new Error('Broadcast service error');
        }),
      };

      (gateway as any).notificationService = mockBroadcastService;

      expect(() => {
        gateway.broadcastNotification(mockNotification);
      }).toThrow(WebSocketBroadcastException);

      expect(mockBroadcastService.broadcastNotification).toHaveBeenCalledWith(
        mockNotification,
        expect.any(Function),
      );
    });
  });

  describe('sendNotificationToUsers', () => {
    it('should send notification to specific users', () => {
      const mockNotification = {
        id: 'test-notification-789',
        type: 'alert',
        message: 'Test targeted message',
      };
      const targetUsers = ['user1', 'user2'];

      const mockTargetedService = {
        ...notificationService,
        sendToUsers: jest.fn().mockReturnValue(['socket1', 'socket3']),
      };

      (gateway as any).notificationService = mockTargetedService;
      (gateway as any).emitToSocket = jest.fn();

      gateway.sendNotificationToUsers(mockNotification, targetUsers);

      expect(mockTargetedService.sendToUsers).toHaveBeenCalledWith(
        mockNotification,
        targetUsers,
        expect.any(Function),
      );
    });

    it('should throw WebSocketNotificationException for empty user list', () => {
      const mockNotification = {
        id: 'test-notification-error',
        type: 'warning',
        message: 'Test error targeted message',
      };
      const targetUsers: string[] = [];

      expect(() => {
        gateway.sendNotificationToUsers(mockNotification, targetUsers);
      }).toThrow(WebSocketNotificationException);
    });

    it('should throw WebSocketNotificationException for targeted send errors', () => {
      const mockNotification = {
        id: 'test-notification-service-error',
        type: 'warning',
        message: 'Test service error targeted message',
      };
      const targetUsers = ['user1'];

      const mockTargetedService = {
        ...notificationService,
        sendToUsers: jest.fn().mockImplementation(() => {
          throw new Error('Targeted send error');
        }),
      };

      (gateway as any).notificationService = mockTargetedService;

      expect(() => {
        gateway.sendNotificationToUsers(mockNotification, targetUsers);
      }).toThrow(WebSocketNotificationException);

      expect(mockTargetedService.sendToUsers).toHaveBeenCalledWith(
        mockNotification,
        targetUsers,
        expect.any(Function),
      );
    });
  });

  describe('emitToSocket', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        sockets: {
          sockets: new Map([['test-socket', { id: 'test-socket' }]]),
        },
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };

      gateway.server = mockServer;
    });

    it('should emit message to existing socket', () => {
      (gateway as any).emitToSocket('test-socket', 'notification', {
        message: 'test',
      });

      expect(mockServer.to).toHaveBeenCalledWith('test-socket');
      expect(mockServer.emit).toHaveBeenCalledWith('notification', {
        message: 'test',
      });
    });

    it('should throw WebSocketNotificationException for missing socket', () => {
      expect(() => {
        (gateway as any).emitToSocket('missing-socket', 'notification', {
          message: 'test',
        });
      }).toThrow(WebSocketNotificationException);

      expect(notificationService.removeClient).toHaveBeenCalledWith(
        'missing-socket',
      );
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should throw WebSocketNotificationException for emit errors', () => {
      mockServer.to.mockImplementation(() => {
        throw new Error('Emit error');
      });

      expect(() => {
        (gateway as any).emitToSocket('error-socket', 'notification', {
          message: 'test',
        });
      }).toThrow(WebSocketNotificationException);

      expect(notificationService.removeClient).toHaveBeenCalledWith(
        'error-socket',
      );
    });

    it('should throw WebSocketNotificationException for non-existent socket', () => {
      const mockSocketsMap = new Map();
      mockServer.sockets.sockets = mockSocketsMap;

      expect(() => {
        (gateway as any).emitToSocket('non-existent', 'notification', {
          message: 'test',
        });
      }).toThrow(WebSocketNotificationException);

      expect(mockServer.to).not.toHaveBeenCalled();
      expect(notificationService.removeClient).toHaveBeenCalledWith(
        'non-existent',
      );
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', () => {
      const mockStatsService = {
        ...notificationService,
        getConnectedUsers: jest
          .fn()
          .mockReturnValue(['user1', 'user2', 'anonymous']),
        getConnectedClientsCount: jest.fn().mockReturnValue(5),
        getConnectedClients: jest.fn().mockReturnValue([
          { userId: 'user1', socketId: 'socket1' },
          { userId: 'user2', socketId: 'socket2' },
          { userId: 'anonymous', socketId: 'socket3' },
          { userId: 'anonymous', socketId: 'socket4' },
          { userId: 'user3', socketId: 'socket5' },
        ]),
      };

      (gateway as any).notificationService = mockStatsService;

      const stats = gateway.getConnectionStats();

      expect(stats).toEqual({
        totalConnections: 5,
        connectedUsers: ['user1', 'user2'],
        anonymousConnections: 2,
      });
    });
  });

  describe('Gateway Configuration', () => {
    it('should be properly decorated as WebSocket gateway', () => {
      // Verify that the gateway class is properly instantiated
      expect(gateway).toBeInstanceOf(NotificationGateway);
      // Server is injected at runtime, so it's null in tests
      expect(gateway.server).toBeNull();
    });
  });

  describe('WebSocket Error Handling', () => {
    describe('Connection Error Scenarios', () => {
      it('should handle connection timeout errors', () => {
        const mockSocketWithTimeout = {
          ...mockSocket,
          id: 'timeout-socket',
          handshake: {
            ...mockSocket.handshake,
            query: { userId: 'timeout-user' },
          },
        };

        const mockServiceWithTimeout = {
          addClient: jest.fn().mockImplementation(() => {
            const error = new Error('Connection timeout');
            error.name = 'TimeoutError';
            throw error;
          }),
          removeClient: jest.fn(),
        };

        (gateway as any).notificationService = mockServiceWithTimeout;

        expect(() => {
          gateway.handleConnection(mockSocketWithTimeout as Socket);
        }).toThrow(WebSocketClientManagementException);

        expect(mockServiceWithTimeout.addClient).toHaveBeenCalledWith(
          'timeout-user',
          'timeout-socket',
        );
      });

      it('should handle network connection failures', () => {
        const mockSocketWithNetworkError = {
          ...mockSocket,
          id: 'network-error-socket',
          emit: jest.fn().mockImplementation(() => {
            throw new Error('Network unreachable');
          }),
          handshake: {
            ...mockSocket.handshake,
            query: { userId: 'network-user' },
          },
        };

        expect(() => {
          gateway.handleConnection(mockSocketWithNetworkError as Socket);
        }).toThrow(WebSocketClientManagementException);
      });

      it('should handle malformed handshake data', () => {
        const mockSocketWithMalformedData = {
          ...mockSocket,
          id: 'malformed-socket',
          handshake: null, // Malformed handshake
        };

        expect(() => {
          gateway.handleConnection(mockSocketWithMalformedData as Socket);
        }).toThrow(WebSocketConnectionException);
      });

      it('should handle concurrent connection attempts gracefully', () => {
        const mockConcurrentSocket1 = {
          ...mockSocket,
          id: 'concurrent-1',
          handshake: {
            ...mockSocket.handshake,
            query: { userId: 'concurrent-user' },
          },
        };

        const mockConcurrentSocket2 = {
          ...mockSocket,
          id: 'concurrent-2',
          handshake: {
            ...mockSocket.handshake,
            query: { userId: 'concurrent-user' },
          },
        };

        // First connection should succeed
        gateway.handleConnection(mockConcurrentSocket1 as Socket);
        expect(notificationService.addClient).toHaveBeenCalledWith(
          'concurrent-user',
          'concurrent-1',
        );

        // Second connection with same user should also succeed (multiple sessions)
        gateway.handleConnection(mockConcurrentSocket2 as Socket);
        expect(notificationService.addClient).toHaveBeenCalledWith(
          'concurrent-user',
          'concurrent-2',
        );
      });
    });

    describe('Disconnection Error Scenarios', () => {
      it('should handle service unavailable during disconnect', () => {
        const mockServiceUnavailable = {
          addClient: jest.fn(),
          removeClient: jest.fn().mockImplementation(() => {
            throw new Error('Service unavailable');
          }),
        };

        (gateway as any).notificationService = mockServiceUnavailable;

        // Should not throw error, but should log it
        expect(() => {
          gateway.handleDisconnect(mockSocket as Socket);
        }).not.toThrow();

        expect(mockServiceUnavailable.removeClient).toHaveBeenCalledWith(
          'test-socket-id',
        );
      });

      it('should handle database connection errors during cleanup', () => {
        const mockServiceWithDbError = {
          addClient: jest.fn(),
          removeClient: jest.fn().mockImplementation(() => {
            const dbError = new Error('Database connection lost');
            dbError.name = 'DatabaseError';
            throw dbError;
          }),
        };

        (gateway as any).notificationService = mockServiceWithDbError;

        expect(() => {
          gateway.handleDisconnect(mockSocket as Socket);
        }).not.toThrow();

        expect(mockServiceWithDbError.removeClient).toHaveBeenCalledWith(
          'test-socket-id',
        );
      });

      it('should handle multiple rapid disconnections', () => {
        const mockSockets = [
          { ...mockSocket, id: 'rapid-1' },
          { ...mockSocket, id: 'rapid-2' },
          { ...mockSocket, id: 'rapid-3' },
        ];

        mockSockets.forEach((socket) => {
          gateway.handleDisconnect(socket as Socket);
        });

        expect(notificationService.removeClient).toHaveBeenCalledTimes(3);
        expect(notificationService.removeClient).toHaveBeenCalledWith(
          'rapid-1',
        );
        expect(notificationService.removeClient).toHaveBeenCalledWith(
          'rapid-2',
        );
        expect(notificationService.removeClient).toHaveBeenCalledWith(
          'rapid-3',
        );
      });
    });

    describe('Message Send Error Scenarios', () => {
      let mockServer: any;

      beforeEach(() => {
        mockServer = {
          sockets: {
            sockets: new Map([
              ['active-socket', { id: 'active-socket' }],
              ['failing-socket', { id: 'failing-socket' }],
            ]),
          },
          to: jest.fn().mockReturnThis(),
          emit: jest.fn(),
        };

        (gateway as any).server = mockServer;
      });

      it('should handle socket send timeout errors', () => {
        mockServer.to.mockImplementation(() => {
          const timeoutError = new Error('Send timeout');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        });

        expect(() => {
          (gateway as any).emitToSocket('failing-socket', 'notification', {
            message: 'test',
          });
        }).toThrow(WebSocketNotificationException);

        expect(notificationService.removeClient).toHaveBeenCalledWith(
          'failing-socket',
        );
      });

      it('should handle socket buffer overflow errors', () => {
        mockServer.emit.mockImplementation(() => {
          throw new Error('Socket buffer overflow');
        });

        expect(() => {
          (gateway as any).emitToSocket('active-socket', 'notification', {
            message: 'large-payload',
          });
        }).toThrow(WebSocketNotificationException);
      });

      it('should handle partial message delivery failures in broadcast', () => {
        const mockNotification = {
          id: 'partial-fail-notification',
          type: 'info',
          message: 'Test partial failure',
        };

        const mockBroadcastService = {
          ...notificationService,
          getConnectedClientsCount: jest.fn().mockReturnValue(3),
          broadcastNotification: jest
            .fn()
            .mockImplementation((notification, callback) => {
              // Simulate partial failure - some sockets succeed, some fail
              callback('socket1', notification); // Success
              callback('socket2', notification); // Success
              callback('socket3', notification); // Will fail in emitToSocket
              return ['socket1', 'socket2', 'socket3'];
            }),
        };

        (gateway as any).notificationService = mockBroadcastService;
        (gateway as any).emitToSocket = jest
          .fn()
          .mockImplementation((socketId) => {
            if (socketId === 'socket3') {
              throw new Error('Socket3 send failed');
            }
          });

        expect(() => {
          gateway.broadcastNotification(mockNotification);
        }).toThrow(WebSocketBroadcastException);

        expect(mockBroadcastService.broadcastNotification).toHaveBeenCalledWith(
          mockNotification,
          expect.any(Function),
        );
      });

      it('should handle complete broadcast failure', () => {
        const mockNotification = {
          id: 'complete-fail-notification',
          type: 'error',
          message: 'Test complete failure',
        };

        const mockBroadcastService = {
          ...notificationService,
          getConnectedClientsCount: jest.fn().mockReturnValue(2),
          broadcastNotification: jest
            .fn()
            .mockImplementation((notification, callback) => {
              callback('socket1', notification);
              callback('socket2', notification);
              return ['socket1', 'socket2'];
            }),
        };

        (gateway as any).notificationService = mockBroadcastService;
        (gateway as any).emitToSocket = jest.fn().mockImplementation(() => {
          throw new Error('All sockets failed');
        });

        expect(() => {
          gateway.broadcastNotification(mockNotification);
        }).toThrow(WebSocketBroadcastException);
      });

      it('should handle targeted notification send failures', () => {
        const mockNotification = {
          id: 'targeted-fail-notification',
          type: 'alert',
          message: 'Test targeted failure',
        };
        const targetUsers = ['user1', 'user2'];

        const mockTargetedService = {
          ...notificationService,
          sendToUsers: jest
            .fn()
            .mockImplementation((notification, users, callback) => {
              callback('socket1', notification);
              callback('socket2', notification);
              return ['socket1', 'socket2'];
            }),
        };

        (gateway as any).notificationService = mockTargetedService;
        (gateway as any).emitToSocket = jest
          .fn()
          .mockImplementation((socketId) => {
            if (socketId === 'socket2') {
              throw new Error('Socket2 targeted send failed');
            }
          });

        // Should not throw since at least one delivery succeeded
        expect(() => {
          gateway.sendNotificationToUsers(mockNotification, targetUsers);
        }).not.toThrow();

        expect(mockTargetedService.sendToUsers).toHaveBeenCalledWith(
          mockNotification,
          targetUsers,
          expect.any(Function),
        );
      });
    });

    describe('Resource Cleanup Error Scenarios', () => {
      it('should handle cleanup failures during socket removal', () => {
        const mockServiceWithCleanupError = {
          addClient: jest.fn(),
          removeClient: jest.fn().mockImplementation(() => {
            throw new Error('Cleanup resource lock failed');
          }),
        };

        (gateway as any).notificationService = mockServiceWithCleanupError;

        // Test cleanup during emitToSocket error
        const mockServer = {
          sockets: {
            sockets: new Map(), // Empty map to simulate missing socket
          },
          to: jest.fn(),
          emit: jest.fn(),
        };

        (gateway as any).server = mockServer;

        expect(() => {
          (gateway as any).emitToSocket('missing-socket', 'notification', {
            message: 'test',
          });
        }).toThrow(WebSocketNotificationException);

        expect(mockServiceWithCleanupError.removeClient).toHaveBeenCalledWith(
          'missing-socket',
        );
      });

      it('should handle memory cleanup errors', () => {
        const mockServiceWithMemoryError = {
          addClient: jest.fn(),
          removeClient: jest.fn().mockImplementation(() => {
            const memoryError = new Error('Out of memory during cleanup');
            memoryError.name = 'MemoryError';
            throw memoryError;
          }),
        };

        (gateway as any).notificationService = mockServiceWithMemoryError;

        expect(() => {
          gateway.handleDisconnect(mockSocket as Socket);
        }).not.toThrow();

        expect(mockServiceWithMemoryError.removeClient).toHaveBeenCalledWith(
          'test-socket-id',
        );
      });
    });

    describe('Error Recovery Scenarios', () => {
      it('should continue operating after individual client errors', () => {
        const mockNotification = {
          id: 'recovery-test-notification',
          type: 'info',
          message: 'Test error recovery',
        };

        const mockRecoveryService = {
          ...notificationService,
          getConnectedClientsCount: jest.fn().mockReturnValue(3),
          broadcastNotification: jest
            .fn()
            .mockImplementation((notification, callback) => {
              callback('good-socket', notification);
              callback('bad-socket', notification);
              callback('another-good-socket', notification);
              return ['good-socket', 'bad-socket', 'another-good-socket'];
            }),
        };

        (gateway as any).notificationService = mockRecoveryService;
        (gateway as any).emitToSocket = jest
          .fn()
          .mockImplementation((socketId) => {
            if (socketId === 'bad-socket') {
              throw new Error('Bad socket error');
            }
            // Other sockets succeed
          });

        expect(() => {
          gateway.broadcastNotification(mockNotification);
        }).toThrow(WebSocketBroadcastException);

        // Verify that the service was still called and other operations can continue
        expect(mockRecoveryService.broadcastNotification).toHaveBeenCalled();
      });

      it('should handle service restart scenarios', () => {
        const mockRestartSocket = {
          ...mockSocket,
          id: 'restart-socket',
          handshake: {
            ...mockSocket.handshake,
            query: { userId: 'restart-user' },
          },
        };

        const mockServiceRestart = {
          addClient: jest
            .fn()
            .mockImplementationOnce(() => {
              throw new Error('Service restarting');
            })
            .mockImplementationOnce(() => {
              // Second attempt succeeds
              return true;
            }),
          removeClient: jest.fn(),
        };

        (gateway as any).notificationService = mockServiceRestart;

        // First attempt should fail
        expect(() => {
          gateway.handleConnection(mockRestartSocket as Socket);
        }).toThrow(WebSocketClientManagementException);

        // Reset the service mock for second attempt
        (gateway as any).notificationService = {
          addClient: jest.fn(),
          removeClient: jest.fn(),
        };

        // Second attempt should succeed
        expect(() => {
          gateway.handleConnection(mockRestartSocket as Socket);
        }).not.toThrow();
      });
    });

    describe('Edge Case Error Scenarios', () => {
      it('should handle null or undefined notification data', () => {
        expect(() => {
          gateway.broadcastNotification(null);
        }).toThrow();

        expect(() => {
          gateway.broadcastNotification(undefined);
        }).toThrow();
      });

      it('should handle invalid user ID arrays in targeted notifications', () => {
        const mockNotification = {
          id: 'invalid-users-notification',
          type: 'warning',
          message: 'Test invalid users',
        };

        expect(() => {
          gateway.sendNotificationToUsers(mockNotification, null as any);
        }).toThrow(WebSocketNotificationException);

        expect(() => {
          gateway.sendNotificationToUsers(mockNotification, undefined as any);
        }).toThrow(WebSocketNotificationException);
      });

      it('should handle extremely large notification payloads', () => {
        const largeNotification = {
          id: 'large-notification',
          type: 'info',
          message: 'Large payload test',
          data: 'x'.repeat(1000000), // 1MB string
        };

        const mockLargePayloadService = {
          ...notificationService,
          getConnectedClientsCount: jest.fn().mockReturnValue(1),
          broadcastNotification: jest
            .fn()
            .mockImplementation((notification, callback) => {
              callback('test-socket', notification);
              return ['test-socket'];
            }),
        };

        (gateway as any).notificationService = mockLargePayloadService;
        (gateway as any).emitToSocket = jest.fn().mockImplementation(() => {
          throw new Error('Payload too large');
        });

        expect(() => {
          gateway.broadcastNotification(largeNotification);
        }).toThrow(WebSocketBroadcastException);
      });
    });
  });
});
