import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WebhookAuthGuard } from './webhook-auth.guard';
import { WebhookAuthenticationException } from '../exceptions/webhook.exceptions';

describe('WebhookAuthGuard', () => {
  let guard: WebhookAuthGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const createMockExecutionContext = (
    authHeader?: string,
    ip?: string,
    userAgent?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {
            authorization: authHeader,
            'user-agent': userAgent || 'Test-Agent/1.0',
          },
          ip: ip || '127.0.0.1',
          connection: {
            remoteAddress: ip || '127.0.0.1',
          },
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookAuthGuard,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<WebhookAuthGuard>(WebhookAuthGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when valid Bearer token is provided', () => {
      const validToken = 'valid-webhook-token';
      mockConfigService.get.mockReturnValue(validToken);

      const context = createMockExecutionContext(`Bearer ${validToken}`);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(configService.get).toHaveBeenCalledWith('WEBHOOK_API_TOKEN');
    });

    it('should throw WebhookAuthenticationException when authorization header is missing', () => {
      const context = createMockExecutionContext();

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Authorization header is required',
      );
    });

    it('should throw WebhookAuthenticationException when authorization header format is invalid', () => {
      mockConfigService.get.mockReturnValue('valid-token');
      const context = createMockExecutionContext('InvalidFormat');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authorization header format',
      );
    });

    it('should throw WebhookAuthenticationException when Bearer prefix is missing', () => {
      mockConfigService.get.mockReturnValue('valid-token');
      const context = createMockExecutionContext('Token some-token');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authorization header format',
      );
    });

    it('should throw WebhookAuthenticationException when token part is missing', () => {
      mockConfigService.get.mockReturnValue('valid-token');
      const context = createMockExecutionContext('Bearer');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authorization header format',
      );
    });

    it('should throw WebhookAuthenticationException when webhook token is not configured', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const context = createMockExecutionContext('Bearer some-token');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Webhook token not configured',
      );
    });

    it('should throw WebhookAuthenticationException when provided token does not match configured token', () => {
      const configuredToken = 'configured-token';
      const providedToken = 'wrong-token';

      mockConfigService.get.mockReturnValue(configuredToken);
      const context = createMockExecutionContext(`Bearer ${providedToken}`);

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow('Invalid webhook token');
    });

    it('should handle empty string token', () => {
      mockConfigService.get.mockReturnValue('valid-token');
      const context = createMockExecutionContext('Bearer ');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow(
        'Invalid authorization header format',
      );
    });

    it('should handle case-sensitive token comparison', () => {
      const configuredToken = 'CaseSensitiveToken';
      const providedToken = 'casesensitivetoken';

      mockConfigService.get.mockReturnValue(configuredToken);
      const context = createMockExecutionContext(`Bearer ${providedToken}`);

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );
      expect(() => guard.canActivate(context)).toThrow('Invalid webhook token');
    });
  });

  describe('Logging', () => {
    it('should log authentication attempt with client details', () => {
      const validToken = 'valid-webhook-token';
      mockConfigService.get.mockReturnValue(validToken);
      const loggerSpy = jest.spyOn(guard['logger'], 'log').mockImplementation();

      const context = createMockExecutionContext(
        `Bearer ${validToken}`,
        '192.168.1.100',
        'MyApp/2.0',
      );

      guard.canActivate(context);

      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Authentication attempt from 192.168.1.100 - User-Agent: MyApp/2.0',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Authentication successful from 192.168.1.100',
      );

      loggerSpy.mockRestore();
    });

    it('should log warning for missing authorization header', () => {
      const loggerSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation();

      const context = createMockExecutionContext(undefined, '10.0.0.1');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Missing authorization header from 10.0.0.1',
      );

      loggerSpy.mockRestore();
    });

    it('should log warning for invalid header format', () => {
      mockConfigService.get.mockReturnValue('valid-token');
      const loggerSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation();

      const context = createMockExecutionContext('InvalidFormat', '172.16.0.1');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Invalid authorization header format from 172.16.0.1',
      );

      loggerSpy.mockRestore();
    });

    it('should log warning for invalid token', () => {
      mockConfigService.get.mockReturnValue('correct-token');
      const loggerSpy = jest
        .spyOn(guard['logger'], 'warn')
        .mockImplementation();

      const context = createMockExecutionContext(
        'Bearer wrong-token',
        '203.0.113.1',
      );

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Invalid webhook token provided from 203.0.113.1',
      );

      loggerSpy.mockRestore();
    });

    it('should log error for server configuration issues', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const loggerSpy = jest
        .spyOn(guard['logger'], 'error')
        .mockImplementation();

      const context = createMockExecutionContext('Bearer some-token');

      expect(() => guard.canActivate(context)).toThrow(
        WebhookAuthenticationException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        '[WEBHOOK_AUTH] Webhook token not configured in environment variables',
      );

      loggerSpy.mockRestore();
    });

    it('should handle missing IP address gracefully', () => {
      const validToken = 'valid-webhook-token';
      mockConfigService.get.mockReturnValue(validToken);
      const loggerSpy = jest.spyOn(guard['logger'], 'log').mockImplementation();

      const contextWithoutIp = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: `Bearer ${validToken}`,
              'user-agent': 'Test-Agent/1.0',
            },
            connection: {},
          }),
        }),
      } as ExecutionContext;

      guard.canActivate(contextWithoutIp);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[WEBHOOK_AUTH] Authentication attempt from unknown',
        ),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'test-token-123';
      const authHeader = `Bearer ${token}`;

      // Access private method for testing
      const extractedToken = (guard as any).extractTokenFromHeader(authHeader);

      expect(extractedToken).toBe(token);
    });

    it('should return null for invalid header format', () => {
      const authHeader = 'InvalidFormat';

      const extractedToken = (guard as any).extractTokenFromHeader(authHeader);

      expect(extractedToken).toBeNull();
    });

    it('should return null when token is missing', () => {
      const authHeader = 'Bearer';

      const extractedToken = (guard as any).extractTokenFromHeader(authHeader);

      expect(extractedToken).toBeNull();
    });

    it('should return null for non-Bearer type', () => {
      const authHeader = 'Basic dGVzdDp0ZXN0';

      const extractedToken = (guard as any).extractTokenFromHeader(authHeader);

      expect(extractedToken).toBeNull();
    });
  });
});
