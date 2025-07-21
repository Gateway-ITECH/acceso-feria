import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UseFilters,
} from '@nestjs/common';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';
import { WebhookNotificationDto } from '../dto/webhook-notification.dto';
import { NotificationService } from '../services/notification.service';
import { NotificationGateway } from '../gateways/notification.gateway';
import { WebhookExceptionFilter } from '../filters/webhook-exception.filter';
import {
  WebhookProcessingException,
  WebhookValidationException,
  WebhookDeliveryException,
} from '../exceptions/webhook.exceptions';

@Controller('notifications')
@UseFilters(WebhookExceptionFilter)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @Post('webhook')
  @UseGuards(WebhookAuthGuard)
  @HttpCode(HttpStatus.OK)
  async receiveNotification(
    @Body() notification: WebhookNotificationDto,
  ): Promise<{
    message: string;
    status: string;
    notificationId: string;
    deliveryInfo: {
      totalClients: number;
      deliveredTo: number;
      targetType: 'broadcast' | 'targeted';
      targetUsers?: string[];
    };
  }> {
    const startTime = Date.now();
    this.logger.log(
      `[WEBHOOK] Received notification: type=${notification.type}, message="${
        notification.message
      }", targetUsers=${
        notification.targetUsers
          ? `[${notification.targetUsers.join(', ')}]`
          : 'none'
      }, priority=${notification.priority || 'normal'}`,
    );

    try {
      // Check connected clients before processing
      const totalConnectedClients =
        this.notificationService.getConnectedClientsCount();
      const connectedUsers = this.notificationService.getConnectedUsers();

      this.logger.log(
        `[WEBHOOK] Current connections: ${totalConnectedClients} clients, ${connectedUsers.length} unique users`,
      );

      if (totalConnectedClients === 0) {
        this.logger.warn(
          '[WEBHOOK] No clients connected - notification will not be delivered',
        );
        return {
          message: 'No clients connected - notification will not be delivered',
          status: 'error',
          notificationId: null,
          deliveryInfo: {
            targetType: 'broadcast',
            totalClients: 0,
            deliveredTo: 0,
          },
        }
      }

      // Process the webhook notification
      const processedNotification =
        this.notificationService.processWebhookNotification(notification);

      let deliveredTo = 0;
      let targetType: 'broadcast' | 'targeted' = 'broadcast';

      // Distribute the notification based on target users
      if (notification.targetUsers && notification.targetUsers.length > 0) {
        // Send to specific users
        targetType = 'targeted';
        this.logger.log(
          `[WEBHOOK] Sending targeted notification to users: ${notification.targetUsers.join(
            ', ',
          )}`,
        );

        // Check if target users are connected
        const connectedTargetUsers = notification.targetUsers.filter((userId) =>
          this.notificationService.isUserConnected(userId),
        );

        if (connectedTargetUsers.length === 0) {
          this.logger.warn(
            `[WEBHOOK] None of the target users are currently connected: ${notification.targetUsers.join(
              ', ',
            )}`,
          );
        } else {
          this.logger.log(
            `[WEBHOOK] ${connectedTargetUsers.length}/${notification.targetUsers.length} target users are connected`,
          );
        }

        // Send notification regardless of connection status (for logging purposes)
        this.notificationGateway.sendToUsers(
          processedNotification,
          notification.targetUsers,
        );

        // Calculate delivered count based on connected target users
        deliveredTo = connectedTargetUsers.reduce((count, userId) => {
          return (
            count + this.notificationService.getClientsByUserId(userId).length
          );
        }, 0);
      } else {
        // Broadcast to all connected clients
        this.logger.log(
          `[WEBHOOK] Broadcasting notification to all ${totalConnectedClients} connected clients`,
        );

        this.notificationGateway.sendToAll(processedNotification);
        deliveredTo = totalConnectedClients;
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `[WEBHOOK] Successfully processed notification: id=${processedNotification.id}, delivered to ${deliveredTo} clients, processing time: ${processingTime}ms`,
      );

      const response = {
        message: 'Notification received and processed successfully',
        status: 'success',
        notificationId: processedNotification.id,
        deliveryInfo: {
          totalClients: totalConnectedClients,
          deliveredTo,
          targetType,
          ...(targetType === 'targeted' && {
            targetUsers: notification.targetUsers,
          }),
        },
      };

      // Log response details
      this.logger.log(
        `[WEBHOOK] Response: ${JSON.stringify({
          notificationId: response.notificationId,
          deliveryInfo: response.deliveryInfo,
        })}`,
      );

      return response;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `[WEBHOOK] Error processing notification after ${processingTime}ms:`,
        error,
      );

      // Handle different types of errors with specific exceptions
      if (error.name === 'ValidationError' || error.status === 400) {
        this.logger.error(
          `[WEBHOOK] Validation error: ${error.message}`,
          error.stack,
        );
        throw new WebhookValidationException(
          'Invalid notification data: ' + error.message,
          Array.isArray(error.details) ? error.details : [error.message],
        );
      }

      // Handle notification processing errors
      if (
        error.message?.includes('notification') ||
        error.message?.includes('processing')
      ) {
        this.logger.error(
          `[WEBHOOK] Processing error: ${error.message}`,
          error.stack,
        );
        throw new WebhookProcessingException(
          'Failed to process notification: ' + error.message,
          {
            originalError: error.name,
            processingTime,
            timestamp: new Date().toISOString(),
          },
        );
      }

      // Handle delivery-related errors
      if (
        error.message?.includes('delivery') ||
        error.message?.includes('send')
      ) {
        this.logger.error(
          `[WEBHOOK] Delivery error: ${error.message}`,
          error.stack,
        );
        throw new WebhookDeliveryException(
          'Failed to deliver notification: ' + error.message,
          {
            totalClients: this.notificationService.getConnectedClientsCount(),
            failedDeliveries: 1,
            errors: [error.message],
          },
        );
      }

      // For any other unexpected errors, throw processing exception
      this.logger.error(
        `[WEBHOOK] Unexpected error: ${error.message}`,
        error.stack,
      );
      throw new WebhookProcessingException(
        'An unexpected error occurred while processing the webhook',
        {
          originalError: error.name || 'UnknownError',
          message: error.message,
          processingTime,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }
}
