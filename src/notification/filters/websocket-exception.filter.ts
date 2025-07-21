import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import {
  WebSocketConnectionException,
  WebSocketAuthenticationException,
  WebSocketNotificationException,
  WebSocketBroadcastException,
  WebSocketClientManagementException,
} from '../exceptions/websocket.exceptions';

export interface WebSocketErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  socketId?: string;
  details?: any;
  requestId?: string;
}

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WebSocketExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const timestamp = new Date().toISOString();
    const socketId = client?.id || 'unknown';
    const requestId = this.generateRequestId();

    // Log the error with context
    this.logger.error(
      `[WS_ERROR] Socket: ${socketId} - RequestId: ${requestId}`,
      {
        error: exception.message,
        stack: exception.stack,
        socketId,
        userId: this.extractUserIdFromSocket(client),
        event: this.extractEventFromHost(host),
      },
    );

    let errorResponse: WebSocketErrorResponse;

    if (exception instanceof WsException) {
      errorResponse = this.handleWsException(
        exception,
        socketId,
        timestamp,
        requestId,
      );
    } else {
      errorResponse = this.handleGenericException(
        exception,
        socketId,
        timestamp,
        requestId,
      );
    }

    // Log the final error response
    this.logger.warn(
      `[WS_ERROR] Sending error response to socket: ${socketId}`,
      { requestId, error: errorResponse.error, message: errorResponse.message },
    );

    // Send error to client
    if (client && client.connected) {
      try {
        client.emit('error', errorResponse);
      } catch (emitError) {
        this.logger.error(
          `[WS_ERROR] Failed to send error response to socket: ${socketId}`,
          emitError,
        );
      }
    }

    // Don't call super.catch() to prevent default error handling
  }

  private handleWsException(
    exception: WsException,
    socketId: string,
    timestamp: string,
    requestId: string,
  ): WebSocketErrorResponse {
    const exceptionData = exception.getError();
    let error: string;
    let message: string;
    let details: any = undefined;

    if (typeof exceptionData === 'string') {
      error = 'WebSocket Error';
      message = exceptionData;
    } else if (typeof exceptionData === 'object') {
      error = (exceptionData as any).error || 'WebSocket Error';
      message = (exceptionData as any).message || exception.message;
      details = (exceptionData as any).details;
    } else {
      error = 'WebSocket Error';
      message = exception.message;
    }

    // Customize messages for specific WebSocket errors
    if (exception instanceof WebSocketConnectionException) {
      error = 'Connection Error';
      message = this.getConnectionErrorMessage(message);
    } else if (exception instanceof WebSocketAuthenticationException) {
      error = 'Authentication Error';
      message = this.getAuthenticationErrorMessage(message);
    } else if (exception instanceof WebSocketNotificationException) {
      error = 'Notification Error';
      message = this.getNotificationErrorMessage(message);
    } else if (exception instanceof WebSocketBroadcastException) {
      error = 'Broadcast Error';
      message = this.getBroadcastErrorMessage(message);
    } else if (exception instanceof WebSocketClientManagementException) {
      error = 'Client Management Error';
      message = this.getClientManagementErrorMessage(message);
    }

    return {
      error,
      message,
      timestamp,
      socketId,
      requestId,
      ...(details && { details }),
    };
  }

  private handleGenericException(
    exception: any,
    socketId: string,
    timestamp: string,
    requestId: string,
  ): WebSocketErrorResponse {
    // Log additional details for debugging
    this.logger.error(
      `[WS_ERROR] Unhandled exception: ${exception.constructor.name}`,
      {
        message: exception.message,
        stack: exception.stack,
        requestId,
        socketId,
      },
    );

    return {
      error: 'Internal WebSocket Error',
      message: 'An unexpected error occurred in the WebSocket connection',
      timestamp,
      socketId,
      requestId,
    };
  }

  private getConnectionErrorMessage(originalMessage: string): string {
    const connectionErrorMessages: Record<string, string> = {
      'Connection failed':
        'Failed to establish WebSocket connection. Please try again.',
      'Connection timeout':
        'WebSocket connection timed out. Please check your network connection.',
      'Connection refused': 'WebSocket connection was refused by the server.',
      'Invalid connection': 'Invalid WebSocket connection parameters.',
    };

    return (
      connectionErrorMessages[originalMessage] ||
      `Connection error: ${originalMessage}`
    );
  }

  private getAuthenticationErrorMessage(originalMessage: string): string {
    const authErrorMessages: Record<string, string> = {
      'Authentication failed':
        'WebSocket authentication failed. Please provide valid credentials.',
      'Token expired':
        'Your authentication token has expired. Please reconnect with a new token.',
      'Invalid token': 'Invalid authentication token provided.',
      'Missing credentials':
        'Authentication credentials are required for this WebSocket connection.',
    };

    return (
      authErrorMessages[originalMessage] ||
      `Authentication error: ${originalMessage}`
    );
  }

  private getNotificationErrorMessage(originalMessage: string): string {
    const notificationErrorMessages: Record<string, string> = {
      'Notification send failed':
        'Failed to send notification. The message could not be delivered.',
      'Invalid notification': 'The notification format is invalid.',
      'Client not found': 'The target client is no longer connected.',
      'Notification timeout': 'Notification delivery timed out.',
    };

    return (
      notificationErrorMessages[originalMessage] ||
      `Notification error: ${originalMessage}`
    );
  }

  private getBroadcastErrorMessage(originalMessage: string): string {
    const broadcastErrorMessages: Record<string, string> = {
      'Broadcast failed': 'Failed to broadcast message to all clients.',
      'Partial broadcast failure':
        'Message was delivered to some clients but failed for others.',
      'No clients connected':
        'No clients are currently connected to receive the broadcast.',
    };

    return (
      broadcastErrorMessages[originalMessage] ||
      `Broadcast error: ${originalMessage}`
    );
  }

  private getClientManagementErrorMessage(originalMessage: string): string {
    const clientErrorMessages: Record<string, string> = {
      'Client registration failed': 'Failed to register client connection.',
      'Client removal failed': 'Failed to remove client from registry.',
      'Client not found': 'Client not found in the connection registry.',
      'Duplicate client': 'Client is already registered.',
    };

    return (
      clientErrorMessages[originalMessage] ||
      `Client management error: ${originalMessage}`
    );
  }

  private extractUserIdFromSocket(client: Socket): string | null {
    if (!client) return null;

    try {
      // Try to get user ID from query parameters
      const userIdFromQuery = client.handshake.query.userId as string;
      if (userIdFromQuery && typeof userIdFromQuery === 'string') {
        return userIdFromQuery;
      }

      // Try to get user ID from auth object
      const userIdFromAuth = client.handshake.auth?.userId as string;
      if (userIdFromAuth && typeof userIdFromAuth === 'string') {
        return userIdFromAuth;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private extractEventFromHost(host: ArgumentsHost): string | null {
    try {
      const data = host.switchToWs().getData();
      return data?.event || null;
    } catch (error) {
      return null;
    }
  }

  private generateRequestId(): string {
    return `ws_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
