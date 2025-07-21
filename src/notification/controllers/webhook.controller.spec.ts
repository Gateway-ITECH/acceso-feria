import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookController } from './webhook.controller';
import { NotificationService } from '../services/notification.service';
import { NotificationGateway } from '../gateways/notification.gateway';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';
import { WebhookNotificationDto } from '../dto/webhook-notification.dto';
import {
  WebhookProcessingException,
  WebhookValidationException,
  WebhookDeliveryException,
  WebhookAuthenticationException,
} from '../exceptions/webhook.exceptions';

describe('WebhookController', () => {
  let controller: WebhookController;
  let notificationService: NotificationService;
  let notificationGateway: NotificationGateway;
  let webhookAuthGuard: WebhookAuthGuard;

  const mockNotificationService = {
    processWebhookNotification: jest.fn(),
    getConnectedClientsCount: jest.fn(),
    getConnectedUsers: jest.fn(),
    isUserConnected: jest.fn(),
    getClientsByUserId: jest.fn(),
  };

  const mockNotificationGateway = {
    broadcastNotification: jest.fn(),
    sendNotificationToUsers: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        WebhookAuthGuard,
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    notificationService = module.get<NotificationService>(NotificationService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
    webhookAuthGuard = module.get<WebhookAuthGuard>(WebhookAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveNotification', () => {
    const validNotification: WebhookNotificationDto = {
      type: 'test',
      message: 'Test notification',
      priority: 'normal',
    };

    const processedNotification = {
      id: 'test-id',
      type: 'test',
      message: 'Test notification',
      priority: 'normal',
      timestamp: new Date(),
      source: 'webhook' as const,
    };

    beforeEach(() => {
      mockNotificationService.processWebhookNotification.mockReturnValue(
        processedNotification,
      );
      mockNotificationService.getConnectedClientsCount.mockReturnValue(5);
      mockNotificationService.getConnectedUsers.mockReturnValue([
        'user1',
        'user2',
      ]);
      mockNotificationService.isUserConnected.mockReturnValue(true);
      mockNotificationService.getClientsByUserId.mockReturnValue([
        { socketId: 'socket1', userId: 'user1', connectedAt: new Date() },
      ]);
    });

    it('should successfully process and broadcast a valid notification', async () => {
      const result = await controller.receiveNotification(validNotification);

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationService.getConnectedClientsCount,
      ).toHaveBeenCalled();
      expect(mockNotificationService.getConnectedUsers).toHaveBeenCalled();
      expect(
        mockNotificationGateway.broadcastNotification,
      ).toHaveBeenCalledWith(processedNotification);
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 5,
          targetType: 'broadcast',
        },
      });
    });

    it('should send targeted notification when targetUsers are specified', async () => {
      const targetedNotification: WebhookNotificationDto = {
        type: 'test',
        message: 'Test notification',
        targetUsers: ['user1', 'user2'],
        priority: 'high',
      };

      const result = await controller.receiveNotification(targetedNotification);

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(targetedNotification);
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'user1',
      );
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'user2',
      );
      expect(mockNotificationService.getClientsByUserId).toHaveBeenCalledWith(
        'user1',
      );
      expect(mockNotificationService.getClientsByUserId).toHaveBeenCalledWith(
        'user2',
      );
      expect(
        mockNotificationGateway.sendNotificationToUsers,
      ).toHaveBeenCalledWith(processedNotification, ['user1', 'user2']);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 2, // 2 users * 1 client each
          targetType: 'targeted',
          targetUsers: ['user1', 'user2'],
        },
      });
    });

    it('should broadcast when targetUsers is empty array', async () => {
      const notificationWithEmptyTargets: WebhookNotificationDto = {
        type: 'test',
        message: 'Test notification',
        targetUsers: [],
        priority: 'normal',
      };

      const result = await controller.receiveNotification(
        notificationWithEmptyTargets,
      );

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(notificationWithEmptyTargets);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).toHaveBeenCalledWith(processedNotification);
      expect(
        mockNotificationGateway.sendNotificationToUsers,
      ).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 5,
          targetType: 'broadcast',
        },
      });
    });

    it('should process notification with all optional fields', async () => {
      const notificationWithOptionalFields: WebhookNotificationDto = {
        type: 'test',
        message: 'Test notification',
        targetUsers: ['user1', 'user2'],
        data: { key: 'value', nested: { prop: 'test' } },
        priority: 'high',
      };

      const result = await controller.receiveNotification(
        notificationWithOptionalFields,
      );

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(notificationWithOptionalFields);
      expect(
        mockNotificationGateway.sendNotificationToUsers,
      ).toHaveBeenCalledWith(processedNotification, ['user1', 'user2']);
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 2, // 2 users * 1 client each
          targetType: 'targeted',
          targetUsers: ['user1', 'user2'],
        },
      });
    });

    it('should throw WebhookValidationException for validation errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      mockNotificationService.processWebhookNotification.mockImplementation(
        () => {
          throw validationError;
        },
      );

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookValidationException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow('Invalid notification data: Validation failed');

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).not.toHaveBeenCalled();
    });

    it('should throw WebhookValidationException for HTTP 400 errors', async () => {
      const badRequestError = new Error('Bad request');
      (badRequestError as any).status = 400;
      mockNotificationService.processWebhookNotification.mockImplementation(
        () => {
          throw badRequestError;
        },
      );

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookValidationException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow('Invalid notification data: Bad request');
    });

    it('should throw WebhookProcessingException for notification processing errors', async () => {
      const processingError = new Error('notification processing failed');
      mockNotificationService.processWebhookNotification.mockImplementation(
        () => {
          throw processingError;
        },
      );

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookProcessingException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(
        'Failed to process notification: notification processing failed',
      );

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).not.toHaveBeenCalled();
    });

    it('should throw WebhookDeliveryException for delivery errors', async () => {
      const deliveryError = new Error('delivery failed');
      mockNotificationGateway.broadcastNotification.mockImplementation(() => {
        throw deliveryError;
      });

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookDeliveryException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow('Failed to deliver notification: delivery failed');

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).toHaveBeenCalledWith(processedNotification);
    });

    it('should throw WebhookProcessingException for unexpected errors', async () => {
      const unexpectedError = new Error('Something unexpected happened');
      mockNotificationService.processWebhookNotification.mockImplementation(
        () => {
          throw unexpectedError;
        },
      );

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookProcessingException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(
        'An unexpected error occurred while processing the webhook',
      );

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).not.toHaveBeenCalled();
    });

    it('should handle gateway errors gracefully', async () => {
      mockNotificationGateway.broadcastNotification.mockImplementation(() => {
        throw new Error('Gateway error');
      });

      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(WebhookProcessingException);
      await expect(
        controller.receiveNotification(validNotification),
      ).rejects.toThrow(
        'An unexpected error occurred while processing the webhook',
      );

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).toHaveBeenCalledWith(processedNotification);
    });

    it('should handle case when no clients are connected for broadcast', async () => {
      mockNotificationService.getConnectedClientsCount.mockReturnValue(0);
      mockNotificationService.getConnectedUsers.mockReturnValue([]);
      // Reset the gateway mock to not throw error for this test
      mockNotificationGateway.broadcastNotification.mockImplementation(
        () => {},
      );

      const result = await controller.receiveNotification(validNotification);

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(validNotification);
      expect(
        mockNotificationGateway.broadcastNotification,
      ).toHaveBeenCalledWith(processedNotification);
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 0,
          deliveredTo: 0,
          targetType: 'broadcast',
        },
      });
    });

    it('should handle case when target users are not connected', async () => {
      const targetedNotification: WebhookNotificationDto = {
        type: 'test',
        message: 'Test notification',
        targetUsers: ['offline-user1', 'offline-user2'],
        priority: 'high',
      };

      mockNotificationService.isUserConnected.mockReturnValue(false);
      mockNotificationService.getClientsByUserId.mockReturnValue([]);

      const result = await controller.receiveNotification(targetedNotification);

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(targetedNotification);
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'offline-user1',
      );
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'offline-user2',
      );
      expect(
        mockNotificationGateway.sendNotificationToUsers,
      ).toHaveBeenCalledWith(processedNotification, [
        'offline-user1',
        'offline-user2',
      ]);
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 0, // No connected target users
          targetType: 'targeted',
          targetUsers: ['offline-user1', 'offline-user2'],
        },
      });
    });

    it('should handle mixed connected and disconnected target users', async () => {
      const targetedNotification: WebhookNotificationDto = {
        type: 'test',
        message: 'Test notification',
        targetUsers: ['connected-user', 'offline-user'],
        priority: 'high',
      };

      mockNotificationService.isUserConnected
        .mockReturnValueOnce(true) // connected-user
        .mockReturnValueOnce(false); // offline-user

      mockNotificationService.getClientsByUserId
        .mockReturnValueOnce([
          {
            socketId: 'socket1',
            userId: 'connected-user',
            connectedAt: new Date(),
          },
          {
            socketId: 'socket2',
            userId: 'connected-user',
            connectedAt: new Date(),
          },
        ]) // connected-user has 2 connections
        .mockReturnValueOnce([]); // offline-user has no connections

      const result = await controller.receiveNotification(targetedNotification);

      expect(
        mockNotificationService.processWebhookNotification,
      ).toHaveBeenCalledWith(targetedNotification);
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'connected-user',
      );
      expect(mockNotificationService.isUserConnected).toHaveBeenCalledWith(
        'offline-user',
      );
      expect(mockNotificationService.getClientsByUserId).toHaveBeenCalledWith(
        'connected-user',
      );
      expect(
        mockNotificationGateway.sendNotificationToUsers,
      ).toHaveBeenCalledWith(processedNotification, [
        'connected-user',
        'offline-user',
      ]);
      expect(result).toEqual({
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: 'test-id',
        deliveryInfo: {
          totalClients: 5,
          deliveredTo: 2, // Only connected-user's 2 connections
          targetType: 'targeted',
          targetUsers: ['connected-user', 'offline-user'],
        },
      });
    });

    it('should include proper logging information in response', async () => {
      // Reset the gateway mock to not throw error for this test
      mockNotificationGateway.broadcastNotification.mockImplementation(
        () => {},
      );

      const result = await controller.receiveNotification(validNotification);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('status', 'success');
      expect(result).toHaveProperty('notificationId', 'test-id');
      expect(result).toHaveProperty('deliveryInfo');
      expect(result.deliveryInfo).toHaveProperty('totalClients');
      expect(result.deliveryInfo).toHaveProperty('deliveredTo');
      expect(result.deliveryInfo).toHaveProperty('targetType');
    });
  });

  describe('WebhookAuthGuard Integration', () => {
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          connection: {},
        }),
      }),
    } as any;

    beforeEach(() => {
      mockConfigService.get.mockReturnValue('valid-token');
    });

    it('should allow access with valid authorization header', () => {
      const contextWithValidAuth = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer valid-token',
            },
          }),
        }),
      } as any;

      const result = webhookAuthGuard.canActivate(contextWithValidAuth);
      expect(result).toBe(true);
    });

    it('should throw WebhookAuthenticationException when authorization header is missing', () => {
      expect(() => webhookAuthGuard.canActivate(mockExecutionContext)).toThrow(
        WebhookAuthenticationException,
      );
    });

    it('should throw WebhookAuthenticationException with invalid token', () => {
      const contextWithInvalidAuth = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer invalid-token',
            },
            connection: {},
          }),
        }),
      } as any;

      expect(() =>
        webhookAuthGuard.canActivate(contextWithInvalidAuth),
      ).toThrow(WebhookAuthenticationException);
    });

    it('should throw WebhookAuthenticationException with malformed authorization header', () => {
      const contextWithMalformedAuth = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'InvalidFormat',
            },
            connection: {},
          }),
        }),
      } as any;

      expect(() =>
        webhookAuthGuard.canActivate(contextWithMalformedAuth),
      ).toThrow(WebhookAuthenticationException);
    });

    it('should throw WebhookAuthenticationException when webhook token is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);

      const contextWithValidAuth = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer some-token',
            },
            connection: {},
          }),
        }),
      } as any;

      expect(() => webhookAuthGuard.canActivate(contextWithValidAuth)).toThrow(
        WebhookAuthenticationException,
      );
    });
  });
});
