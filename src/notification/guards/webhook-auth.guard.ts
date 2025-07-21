import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { WebhookAuthenticationException } from '../exceptions/webhook.exceptions';
import config from 'src/config';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebhookAuthGuard.name);

  constructor(@Inject(config.KEY) private configService: ConfigType<typeof config>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    const clientIp =
      request.ip || request.connection?.remoteAddress || 'unknown';
    const userAgent = request.headers['user-agent'];

    // Log authentication attempt
    this.logger.log(
      `[WEBHOOK_AUTH] Authentication attempt from ${clientIp} - User-Agent: ${userAgent}`,
    );

    if (!authHeader) {
      this.logger.warn(
        `[WEBHOOK_AUTH] Missing authorization header from ${clientIp}`,
      );
      throw new WebhookAuthenticationException(
        'Authorization header is required',
        'missing_auth_header',
      );
    }

    const token = this.extractTokenFromHeader(authHeader);

    if (!token) {
      this.logger.warn(
        `[WEBHOOK_AUTH] Invalid authorization header format from ${clientIp}`,
      );
      throw new WebhookAuthenticationException(
        'Invalid authorization header format',
        'invalid_header_format',
      );
    }

    const webhookToken = this.configService.server.webhookApiToken;
    if (!webhookToken) {
      this.logger.error(
        '[WEBHOOK_AUTH] Webhook token not configured in environment variables',
      );
      throw new WebhookAuthenticationException(
        'Webhook token not configured',
        'server_configuration_error',
      );
    }

    console.log('token', token);
    console.log('webhookToken', webhookToken);

    if (token !== webhookToken) {
      this.logger.warn(
        `[WEBHOOK_AUTH] Invalid webhook token provided from ${clientIp}`,
      );
      throw new WebhookAuthenticationException(
        'Invalid webhook token',
        'invalid_token',
      );
    }

    this.logger.log(
      `[WEBHOOK_AUTH] Authentication successful from ${clientIp}`,
    );
    return true;
  }

  private extractTokenFromHeader(authHeader: string): string | null {
    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
