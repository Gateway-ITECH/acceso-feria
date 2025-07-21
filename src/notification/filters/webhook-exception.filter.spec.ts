import { Test, TestingModule } from '@nestjs/testing';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { WebhookExceptionFilter } from './webhook-exception.filter';
import {
  WebhookProcessingException,
  WebhookValidationException,
  WebhookAuthenticationException,
  WebhookDeliveryException,
} from '../exceptions/webhook.exceptions';

describe('WebhookExceptionFilter', () => {
  let filter: WebhookExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookExceptionFilter],
    }).compile();

    filter = module.get<WebhookExceptionFilter>(WebhookExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/notifications/webhook',
      method: 'POST',
      body: { type: 'test', message: 'test message' },
      headers: {
        authorization: 'Bearer test-token',
        'user-agent': 'Test Agent',
      },
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Exception Handling', () => {
    it('should handle UnauthorizedException with custom authentication message', () => {
      const exception = new UnauthorizedException('Invalid webhook token');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Invalid webhook token. Please check your API credentials.',
          error: 'Authentication Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });

    it('should handle BadRequestException with validation message', () => {
      const exception = new BadRequestException('Validation failed');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid request data: Validation failed',
          error: 'Validation Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });

    it('should handle BadRequestException with class-validator errors', () => {
      const exception = new BadRequestException({
        message: ['type should not be empty', 'message should not be empty'],
        error: 'Bad Request',
        statusCode: 400,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message:
            'Validation failed: type should not be empty, message should not be empty',
          error: 'Validation Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });

    it('should handle generic HttpException', () => {
      const exception = new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Something went wrong',
          error: 'HttpException',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });
  });

  describe('Custom Webhook Exception Handling', () => {
    it('should handle WebhookAuthenticationException', () => {
      const exception = new WebhookAuthenticationException(
        'Authentication failed',
        'invalid_token',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.UNAUTHORIZED,
          message: 'Authentication failed',
          error: 'Webhook Authentication Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
          details: { reason: 'invalid_token' },
        }),
      );
    });

    it('should handle WebhookValidationException', () => {
      const exception = new WebhookValidationException('Invalid data', [
        'field1 is required',
        'field2 is invalid',
      ]);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid data',
          error: 'Webhook Validation Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
          details: ['field1 is required', 'field2 is invalid'],
        }),
      );
    });

    it('should handle WebhookProcessingException', () => {
      const exception = new WebhookProcessingException('Processing failed', {
        originalError: 'DatabaseError',
        processingTime: 1500,
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Processing failed',
          error: 'Webhook Processing Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
          details: {
            originalError: 'DatabaseError',
            processingTime: 1500,
          },
        }),
      );
    });

    it('should handle WebhookDeliveryException', () => {
      const exception = new WebhookDeliveryException('Delivery failed', {
        totalClients: 10,
        failedDeliveries: 3,
        errors: ['Connection timeout', 'Client disconnected'],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.PARTIAL_CONTENT,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.PARTIAL_CONTENT,
          message: 'Delivery failed',
          error: 'Webhook Delivery Failed',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
          details: {
            totalClients: 10,
            failedDeliveries: 3,
            errors: ['Connection timeout', 'Client disconnected'],
          },
        }),
      );
    });
  });

  describe('Non-HTTP Exception Handling', () => {
    it('should handle unexpected errors as internal server error', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred while processing the webhook',
          error: 'Internal Server Error',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });

    it('should handle TypeError as internal server error', () => {
      const exception = new TypeError('Cannot read property of undefined');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'An unexpected error occurred while processing the webhook',
          error: 'Internal Server Error',
          timestamp: expect.any(String),
          path: '/api/notifications/webhook',
          requestId: expect.any(String),
        }),
      );
    });
  });

  describe('Authentication Error Message Mapping', () => {
    it('should map "Authorization header is required" to user-friendly message', () => {
      const exception = new UnauthorizedException(
        'Authorization header is required',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Missing authorization header. Please provide a valid Bearer token.',
        }),
      );
    });

    it('should map "Invalid authorization header format" to user-friendly message', () => {
      const exception = new UnauthorizedException(
        'Invalid authorization header format',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Invalid authorization header format. Expected: "Bearer <token>"',
        }),
      );
    });

    it('should map "Webhook token not configured" to user-friendly message', () => {
      const exception = new UnauthorizedException(
        'Webhook token not configured',
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Webhook authentication is not properly configured on the server.',
        }),
      );
    });

    it('should use default message for unknown authentication errors', () => {
      const exception = new UnauthorizedException('Unknown auth error');

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication failed. Please check your credentials.',
        }),
      );
    });
  });

  describe('Header Sanitization', () => {
    it('should sanitize authorization header in logs', () => {
      const exception = new Error('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WEBHOOK_ERROR]'),
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
          }),
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should preserve other headers in logs', () => {
      const exception = new Error('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WEBHOOK_ERROR]'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'user-agent': 'Test Agent',
          }),
        }),
      );

      loggerSpy.mockRestore();
    });
  });

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const exception1 = new Error('Error 1');
      const exception2 = new Error('Error 2');

      filter.catch(exception1, mockArgumentsHost);
      const firstCall = mockResponse.json.mock.calls[0][0];

      jest.clearAllMocks();

      filter.catch(exception2, mockArgumentsHost);
      const secondCall = mockResponse.json.mock.calls[0][0];

      expect(firstCall.requestId).toBeDefined();
      expect(secondCall.requestId).toBeDefined();
      expect(firstCall.requestId).not.toBe(secondCall.requestId);
      expect(firstCall.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(secondCall.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('Logging', () => {
    it('should log error details with context', () => {
      const exception = new Error('Test error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'error')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[WEBHOOK_ERROR] POST /api/notifications/webhook',
        ),
        expect.objectContaining({
          error: 'Test error',
          stack: expect.any(String),
          body: { type: 'test', message: 'test message' },
          headers: expect.objectContaining({
            authorization: '[REDACTED]',
            'user-agent': 'Test Agent',
          }),
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should log final error response', () => {
      const exception = new BadRequestException('Validation error');
      const loggerSpy = jest
        .spyOn(filter['logger'], 'warn')
        .mockImplementation();

      filter.catch(exception, mockArgumentsHost);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WEBHOOK_ERROR] Sending error response: 400'),
        expect.objectContaining({
          requestId: expect.any(String),
          path: '/api/notifications/webhook',
          method: 'POST',
        }),
      );

      loggerSpy.mockRestore();
    });
  });
});
