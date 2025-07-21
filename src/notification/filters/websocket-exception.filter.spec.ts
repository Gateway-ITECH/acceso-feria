import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WebSocketExceptionFilter } from './websocket-exception.filter';
import {
  WebSocketConnectionException,
  WebSocketAuthenticationException,
  WebSocketNotificationException,
  WebSocketBroadcastException,
  WebSocketClientManagementException,
} from '../exceptions/websocket.exceptions';

describe('WebSocketExceptionFilter', () => {
  let filter: WebSocketExceptionFilter;
  let mockSocket: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketExceptionFilter],
    }).compile();

    filter = module.get<WebSocketExceptionFilter>(WebSocketExceptionFilter);

    mockSocket = {
      id: 'test-socket-123',
      connected: true,
      emit: jest.fn(),
      handshake: {
        query: { userId: 'test-user' },
        auth: {},
      },
    };

    mockArgumentsHost = {
      switchToWs: jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockSocket),
        getData: jest.fn().mockReturnValue({ event: 'test-event' }),
      }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket Exception Handling', () => {
    it('should handle WebSocketConnectionException', () => {
      const exception = new WebSocketConnectionException('Connection failed', {
        socketId: 'test-socket-123',
        reason: 'Network timeout',
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Connection Error',
        message: 'Failed to establish WebSocket connection. Please try again.',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: {
          socketId: 'test-socket-123',
          reason: 'Network timeout',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle WebSocketAuthenticationException', () => {
      const exception = new WebSocketAuthenticationException(
        'Authentication failed',
        {
          socketId: 'test-socket-123',
          reason: 'invalid_token',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Authentication Error',
        message:
          'WebSocket authentication failed. Please provide valid credentials.',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: {
          socketId: 'test-socket-123',
          reason: 'invalid_token',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle WebSocketNotificationException', () => {
      const exception = new WebSocketNotificationException(
        'Notification send failed',
        {
          notificationId: 'notif-123',
          socketId: 'test-socket-123',
          reason: 'Client disconnected',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Notification Error',
        message:
          'Failed to send notification. The message could not be delivered.',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: {
          notificationId: 'notif-123',
          socketId: 'test-socket-123',
          reason: 'Client disconnected',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle WebSocketBroadcastException', () => {
      const exception = new WebSocketBroadcastException('Broadcast failed', {
        notificationId: 'notif-456',
        totalClients: 10,
        failedClients: 3,
        errors: ['Socket timeout', 'Connection lost'],
        timestamp: '2023-01-01T00:00:00.000Z',
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Broadcast Error',
        message: 'Failed to broadcast message to all clients.',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: {
          notificationId: 'notif-456',
          totalClients: 10,
          failedClients: 3,
          errors: ['Socket timeout', 'Connection lost'],
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle WebSocketClientManagementException', () => {
      const exception = new WebSocketClientManagementException(
        'Client registration failed',
        {
          socketId: 'test-socket-123',
          userId: 'test-user',
          operation: 'add',
          reason: 'Database error',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Client Management Error',
        message: 'Failed to register client connection.',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: {
          socketId: 'test-socket-123',
          userId: 'test-user',
          operation: 'add',
          reason: 'Database error',
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      });
    });

    it('should handle generic WsException with string error', () => {
      const exception = new WsException('Generic WebSocket error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'WebSocket Error',
        message: 'Generic WebSocket error',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
      });
    });

    it('should handle generic WsException with object error', () => {
      const exception = new WsException({
        error: 'Custom Error',
        message: 'Custom error message',
        details: { customField: 'value' },
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Custom Error',
        message: 'Custom error message',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
        details: { customField: 'value' },
      });
    });
  });

  describe('Generic Exception Handling', () => {
    it('should handle non-WebSocket exceptions', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Internal WebSocket Error',
        message: 'An unexpected error occurred in the WebSocket connection',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
      });
    });

    it('should handle TypeError exceptions', () => {
      const exception = new TypeError('Cannot read property of undefined');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        error: 'Internal WebSocket Error',
        message: 'An unexpected error occurred in the WebSocket connection',
        timestamp: expect.any(String),
        socketId: 'test-socket-123',
        requestId: expect.any(String),
      });
    });
  });

  describe('Error Message Mapping', () => {
    it('should map connection error messages correctly', () => {
      const exception = new WebSocketConnectionException('Connection timeout');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message:
            'WebSocket connection timed out. Please check your network connection.',
        }),
      );
    });

    it('should map authentication error messages correctly', () => {
      const exception = new WebSocketAuthenticationException('Token expired');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message:
            'Your authentication token has expired. Please reconnect with a new token.',
        }),
      );
    });

    it('should map notification error messages correctly', () => {
      const exception = new WebSocketNotificationException('Client not found');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'The target client is no longer connected.',
        }),
      );
    });

    it('should map broadcast error messages correctly', () => {
      const exception = new WebSocketBroadcastException('No clients connected');

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message:
            'No clients are currently connected to receive the broadcast.',
        }),
      );
    });

    it('should map client management error messages correctly', () => {
      const exception = new WebSocketClientManagementException(
        'Duplicate client',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Client is already registered.',
        }),
      );
    });

    it('should use default message for unknown error types', () => {
      const exception = new WebSocketConnectionException(
        'Unknown connection error',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({
          message: 'Connection error: Unknown connection error',
        }),
      );
    });
  });

  describe('Socket Handling', () => {
    it('should handle disconnected socket gracefully', () => {
      mockSocket.connected = false;

      const exception = new WebSocketNotificationException('Test error');

      expect(() => {
        filter.catch(exception, mockArgumentsHost);
      }).not.toThrow();

      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle socket emit errors gracefully', () => {
      mockSocket.emit.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      const exception = new WebSocketNotificationException('Test error');

      expect(() => {
        filter.catch(exception, mockArgumentsHost);
      }).not.toThrow();
    });

    it('should handle missing socket gracefully', () => {
      mockArgumentsHost.switchToWs = jest.fn().mockReturnValue({
        getClient: jest.fn().mockReturnValue(null),
        getData: jest.fn().mockReturnValue({}),
      });

      const exception = new WebSocketNotificationException('Test error');

      expect(() => {
        filter.catch(exception, mockArgumentsHost);
      }).not.toThrow();
    });
  });

  describe('User ID Extraction', () => {
    it('should extract user ID from query parameters', () => {
      mockSocket.handshake.query = { userId: 'query-user' };
      mockSocket.handshake.auth = {};

      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR]'),
        expect.objectContaining({
          userId: 'query-user',
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should extract user ID from auth object', () => {
      mockSocket.handshake.query = {};
      mockSocket.handshake.auth = { userId: 'auth-user' };

      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR]'),
        expect.objectContaining({
          userId: 'auth-user',
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should handle missing user ID gracefully', () => {
      mockSocket.handshake.query = {};
      mockSocket.handshake.auth = {};

      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR]'),
        expect.objectContaining({
          userId: null,
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should handle extraction errors gracefully', () => {
      mockSocket.handshake = null;

      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR]'),
        expect.objectContaining({
          userId: null,
        }),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const exception1 = new WebSocketNotificationException('Error 1');
      const exception2 = new WebSocketNotificationException('Error 2');

      filter.catch(exception1, mockArgumentsHost);
      const firstCall = mockSocket.emit.mock.calls[0][1];

      jest.clearAllMocks();

      filter.catch(exception2, mockArgumentsHost);
      const secondCall = mockSocket.emit.mock.calls[0][1];

      expect(firstCall.requestId).toBeDefined();
      expect(secondCall.requestId).toBeDefined();
      expect(firstCall.requestId).not.toBe(secondCall.requestId);
      expect(firstCall.requestId).toMatch(/^ws_req_\d+_[a-z0-9]+$/);
      expect(secondCall.requestId).toMatch(/^ws_req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Logging', () => {
    it('should log error details with context', () => {
      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR] Socket: test-socket-123'),
        expect.objectContaining({
          error: 'Test error',
          stack: expect.any(String),
          socketId: 'test-socket-123',
          userId: 'test-user',
          event: 'test-event',
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should log final error response', () => {
      const exception = new WebSocketNotificationException('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'warn')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[WS_ERROR] Sending error response to socket: test-socket-123',
        ),
        expect.objectContaining({
          requestId: expect.any(String),
          error: 'Notification Error',
          message: expect.any(String),
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should log unhandled exceptions with additional details', () => {
      const exception = new TypeError('Unexpected type error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WS_ERROR] Unhandled exception: TypeError'),
        expect.objectContaining({
          message: 'Unexpected type error',
          stack: expect.any(String),
          requestId: expect.any(String),
          socketId: 'test-socket-123',
        }),
      );

      loggerSpy.mockRestore();
    });
  });
});
