import { HttpException, HttpStatus } from '@nestjs/common';

export class WebhookProcessingException extends HttpException {
  constructor(
    message: string,
    public readonly details?: any,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(
      {
        message,
        error: 'Webhook Processing Failed',
        details,
      },
      status,
    );
  }
}

export class WebhookValidationException extends HttpException {
  constructor(message: string, public readonly validationErrors?: string[]) {
    super(
      {
        message,
        error: 'Webhook Validation Failed',
        details: validationErrors,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class WebhookAuthenticationException extends HttpException {
  constructor(message: string, public readonly reason?: string) {
    super(
      {
        message,
        error: 'Webhook Authentication Failed',
        details: reason ? { reason } : undefined,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class WebhookDeliveryException extends HttpException {
  constructor(
    message: string,
    public readonly deliveryDetails?: {
      totalClients: number;
      failedDeliveries: number;
      errors: string[];
    },
  ) {
    super(
      {
        message,
        error: 'Webhook Delivery Failed',
        details: deliveryDetails,
      },
      HttpStatus.PARTIAL_CONTENT,
    );
  }
}
