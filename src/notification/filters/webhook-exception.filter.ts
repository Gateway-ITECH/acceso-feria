import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response, Request } from 'express';

export interface WebhookErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
}

@Catch()
export class WebhookExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebhookExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;
    const requestId = this.generateRequestId();

    // Log the error with context
    this.logger.error(
      `[WEBHOOK_ERROR] ${method} ${path} - RequestId: ${requestId}`,
      {
        error: exception.message,
        stack: exception.stack,
        body: request.body,
        headers: this.sanitizeHeaders(request.headers),
      },
    );

    let status: number;
    let message: string;
    let error: string;
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || exception.name;
        details = (exceptionResponse as any).details;
      } else {
        message = exception.message;
        error = exception.name;
      }

      // Customize messages for specific webhook errors
      if (exception instanceof UnauthorizedException) {
        message = this.getAuthenticationErrorMessage(exception.message);
        error = 'Authentication Failed';
      } else if (exception instanceof BadRequestException) {
        message = this.getValidationErrorMessage(
          exception.message,
          exceptionResponse,
        );
        error = 'Validation Failed';
      }
    } else {
      // Handle non-HTTP exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred while processing the webhook';
      error = 'Internal Server Error';

      // Log additional details for debugging
      this.logger.error(
        `[WEBHOOK_ERROR] Unhandled exception: ${exception.constructor.name}`,
        {
          message: exception.message,
          stack: exception.stack,
          requestId,
        },
      );
    }

    const errorResponse: WebhookErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp,
      path,
      requestId,
      ...(details && { details }),
    };

    // Log the final error response
    this.logger.warn(
      `[WEBHOOK_ERROR] Sending error response: ${status} - ${message}`,
      { requestId, path, method },
    );

    response.status(status).json(errorResponse);
  }

  private getAuthenticationErrorMessage(originalMessage: string): string {
    const authErrorMessages: Record<string, string> = {
      'Authorization header is required':
        'Missing authorization header. Please provide a valid Bearer token.',
      'Invalid authorization header format':
        'Invalid authorization header format. Expected: "Bearer <token>"',
      'Invalid webhook token':
        'Invalid webhook token. Please check your API credentials.',
      'Webhook token not configured':
        'Webhook authentication is not properly configured on the server.',
    };

    return (
      authErrorMessages[originalMessage] ||
      'Authentication failed. Please check your credentials.'
    );
  }

  private getValidationErrorMessage(
    originalMessage: string,
    exceptionResponse: any,
  ): string {
    // Handle class-validator errors
    if (
      typeof exceptionResponse === 'object' &&
      Array.isArray(exceptionResponse.message)
    ) {
      const validationErrors = exceptionResponse.message;
      return `Validation failed: ${validationErrors.join(', ')}`;
    }

    // Handle custom validation errors
    if (originalMessage.includes('Invalid notification data')) {
      return originalMessage;
    }

    return `Invalid request data: ${originalMessage}`;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };

    // Remove sensitive headers from logs
    if (sanitized.authorization) {
      sanitized.authorization = '[REDACTED]';
    }

    return sanitized;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
