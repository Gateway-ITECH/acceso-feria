import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';

// Module under test
import { NotificationModule } from './notification.module';

// Components
import { WebhookController } from './controllers/webhook.controller';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationService } from './services/notification.service';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';

describe('NotificationModule', () => {
  let module: TestingModule;
  let configService: ConfigService;
  let jwtService: JwtService;
  let notificationService: NotificationService;
  let notificationGateway: NotificationGateway;
  let webhookController: WebhookController;
  let webhookAuthGuard: WebhookAuthGuard;

  beforeEach(async () => {
    // Set up environment variables for testing
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.WEBHOOK_API_TOKEN = 'test-webhook-token';

    module = await Test.createTestingModule({
      imports: [NotificationModule],
    }).compile();

    // Get services and components
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
    notificationService = module.get<NotificationService>(NotificationService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
    webhookController = module.get<WebhookController>(WebhookController);
    webhookAuthGuard = module.get<WebhookAuthGuard>(WebhookAuthGuard);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }

    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.WEBHOOK_API_TOKEN;
  });

  describe('Module Configuration', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should have ConfigModule imported', () => {
      expect(configService).toBeDefined();
      expect(configService).toBeInstanceOf(ConfigService);
    });

    it('should have JwtModule configured', () => {
      expect(jwtService).toBeDefined();
      expect(jwtService).toBeInstanceOf(JwtService);
    });

    it('should configure JWT with environment variables', () => {
      // Test that JWT service can sign tokens (indicating proper configuration)
      const testPayload = { sub: 'test-user', iat: Date.now() };
      const token = jwtService.sign(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwtService.decode(token);
      expect(decoded).toBeDefined();
      expect(decoded['sub']).toBe('test-user');
    });
  });

  describe('Controllers', () => {
    it('should provide WebhookController', () => {
      expect(webhookController).toBeDefined();
      expect(webhookController).toBeInstanceOf(WebhookController);
    });
  });

  describe('Providers', () => {
    it('should provide NotificationService', () => {
      expect(notificationService).toBeDefined();
      expect(notificationService).toBeInstanceOf(NotificationService);
    });

    it('should provide NotificationGateway', () => {
      expect(notificationGateway).toBeDefined();
      expect(notificationGateway).toBeInstanceOf(NotificationGateway);
    });

    it('should provide WebhookAuthGuard', () => {
      expect(webhookAuthGuard).toBeDefined();
      expect(webhookAuthGuard).toBeInstanceOf(WebhookAuthGuard);
    });
  });

  describe('Exports', () => {
    it('should export NotificationService', () => {
      const exportedService =
        module.get<NotificationService>(NotificationService);
      expect(exportedService).toBeDefined();
      expect(exportedService).toBe(notificationService);
    });

    it('should export NotificationGateway', () => {
      const exportedGateway =
        module.get<NotificationGateway>(NotificationGateway);
      expect(exportedGateway).toBeDefined();
      expect(exportedGateway).toBe(notificationGateway);
    });
  });

  describe('Dependencies Integration', () => {
    it('should inject NotificationService into WebhookController', () => {
      expect(webhookController['notificationService']).toBeDefined();
      expect(webhookController['notificationService']).toBe(
        notificationService,
      );
    });

    it('should inject NotificationGateway into WebhookController', () => {
      expect(webhookController['notificationGateway']).toBeDefined();
      expect(webhookController['notificationGateway']).toBe(
        notificationGateway,
      );
    });

    it('should inject NotificationService into NotificationGateway', () => {
      expect(notificationGateway['notificationService']).toBeDefined();
      expect(notificationGateway['notificationService']).toBe(
        notificationService,
      );
    });

    it('should inject ConfigService into WebhookAuthGuard', () => {
      expect(webhookAuthGuard['configService']).toBeDefined();
      expect(webhookAuthGuard['configService']).toBe(configService);
    });
  });

  describe('Environment Configuration', () => {
    it('should access JWT configuration from environment', () => {
      const jwtSecret = configService.get<string>('JWT_SECRET');
      const jwtExpiresIn = configService.get<string>('JWT_EXPIRES_IN');

      expect(jwtSecret).toBe('test-jwt-secret');
      expect(jwtExpiresIn).toBe('1h');
    });

    it('should access webhook token from environment', () => {
      const webhookToken = configService.get<string>('WEBHOOK_API_TOKEN');
      expect(webhookToken).toBe('test-webhook-token');
    });

    it('should handle missing JWT_SECRET with default', async () => {
      delete process.env.JWT_SECRET;

      const testModule = await Test.createTestingModule({
        imports: [NotificationModule],
      }).compile();

      const testJwtService = testModule.get<JwtService>(JwtService);

      // Should still work with default secret
      const token = testJwtService.sign({ test: 'data' });
      expect(token).toBeDefined();

      await testModule.close();
    });

    it('should handle missing JWT_EXPIRES_IN with default', async () => {
      delete process.env.JWT_EXPIRES_IN;

      const testModule = await Test.createTestingModule({
        imports: [NotificationModule],
      }).compile();

      const testJwtService = testModule.get<JwtService>(JwtService);

      // Should still work with default expiration
      const token = testJwtService.sign({ test: 'data' });
      expect(token).toBeDefined();

      await testModule.close();
    });
  });

  describe('Module Functionality', () => {
    it('should allow NotificationService to manage clients', () => {
      const userId = 'test-user';
      const socketId = 'test-socket';

      notificationService.addClient(userId, socketId);

      expect(notificationService.isUserConnected(userId)).toBe(true);
      expect(notificationService.getConnectedClientsCount()).toBe(1);

      notificationService.removeClient(socketId);

      expect(notificationService.isUserConnected(userId)).toBe(false);
      expect(notificationService.getConnectedClientsCount()).toBe(0);
    });

    it('should allow WebhookAuthGuard to validate tokens', () => {
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: 'Bearer test-webhook-token',
            },
          }),
        }),
      } as any;

      const result = webhookAuthGuard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
