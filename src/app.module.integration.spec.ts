import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationModule } from './notification/notification.module';
import { NotificationService } from './notification/services/notification.service';
import { NotificationGateway } from './notification/gateways/notification.gateway';
import { WebhookController } from './notification/controllers/webhook.controller';

describe('AppModule Integration', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    // Set up required environment variables for testing
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USERNAME = 'test';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_NAME = 'test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.WEBHOOK_API_TOKEN = 'test-token';
    process.env.STAGE = 'test';
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        NotificationModule,
      ],
    }).compile();

    app = module.createNestApplication();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (module) {
      await module.close();
    }
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.WEBHOOK_API_TOKEN;
    delete process.env.STAGE;
  });

  describe('Module Integration', () => {
    it('should compile the application module successfully', () => {
      expect(app).toBeDefined();
      expect(module).toBeDefined();
    });

    it('should have NotificationModule integrated', () => {
      const notificationService =
        module.get<NotificationService>(NotificationService);
      const notificationGateway =
        module.get<NotificationGateway>(NotificationGateway);
      const webhookController =
        module.get<WebhookController>(WebhookController);

      expect(notificationService).toBeDefined();
      expect(notificationGateway).toBeDefined();
      expect(webhookController).toBeDefined();
    });

    it('should initialize the application without errors', async () => {
      // This test verifies that the app can initialize without throwing errors
      // We don't actually start listening to avoid port conflicts in tests
      await expect(app.init()).resolves.not.toThrow();
    });

    it('should have notification services properly injected', () => {
      const notificationService =
        module.get<NotificationService>(NotificationService);
      const notificationGateway =
        module.get<NotificationGateway>(NotificationGateway);
      const webhookController =
        module.get<WebhookController>(WebhookController);

      // Verify dependency injection worked correctly
      expect(notificationGateway['notificationService']).toBe(
        notificationService,
      );
      expect(webhookController['notificationService']).toBe(
        notificationService,
      );
      expect(webhookController['notificationGateway']).toBe(
        notificationGateway,
      );
    });

    it('should have WebSocket gateway configured', () => {
      const notificationGateway =
        module.get<NotificationGateway>(NotificationGateway);

      // Verify the gateway is properly configured
      expect(notificationGateway).toBeDefined();
      expect(typeof notificationGateway.handleConnection).toBe('function');
      expect(typeof notificationGateway.handleDisconnect).toBe('function');
      expect(typeof notificationGateway.broadcastNotification).toBe('function');
    });

    it('should have webhook controller with proper endpoints', () => {
      const webhookController =
        module.get<WebhookController>(WebhookController);

      // Verify the controller is properly configured
      expect(webhookController).toBeDefined();
      expect(typeof webhookController.receiveNotification).toBe('function');
    });
  });

  describe('Environment Configuration', () => {
    it('should load environment variables correctly', () => {
      const configService = module.get<ConfigService>(ConfigService);

      expect(configService.get('JWT_SECRET')).toBe('test-secret');
      expect(configService.get('JWT_EXPIRES_IN')).toBe('1h');
      expect(configService.get('WEBHOOK_API_TOKEN')).toBe('test-token');
    });
  });

  describe('Service Functionality', () => {
    it('should allow notification service to function correctly', () => {
      const notificationService =
        module.get<NotificationService>(NotificationService);

      // Test basic functionality
      expect(notificationService.getConnectedClientsCount()).toBe(0);

      notificationService.addClient('test-user', 'test-socket');
      expect(notificationService.getConnectedClientsCount()).toBe(1);
      expect(notificationService.isUserConnected('test-user')).toBe(true);

      notificationService.removeClient('test-socket');
      expect(notificationService.getConnectedClientsCount()).toBe(0);
      expect(notificationService.isUserConnected('test-user')).toBe(false);
    });
  });
});
