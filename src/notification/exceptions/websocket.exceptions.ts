import { WsException } from '@nestjs/websockets';

export class WebSocketConnectionException extends WsException {
  constructor(
    message: string,
    public readonly details?: {
      socketId?: string;
      userId?: string;
      reason?: string;
      timestamp?: string;
    },
  ) {
    super({
      error: 'WebSocket Connection Failed',
      message,
      details,
    });
  }
}

export class WebSocketAuthenticationException extends WsException {
  constructor(
    message: string,
    public readonly details?: {
      socketId?: string;
      reason?: string;
      timestamp?: string;
    },
  ) {
    super({
      error: 'WebSocket Authentication Failed',
      message,
      details,
    });
  }
}

export class WebSocketNotificationException extends WsException {
  constructor(
    message: string,
    public readonly details?: {
      notificationId?: string;
      socketId?: string;
      userId?: string;
      reason?: string;
      timestamp?: string;
    },
  ) {
    super({
      error: 'WebSocket Notification Failed',
      message,
      details,
    });
  }
}

export class WebSocketBroadcastException extends WsException {
  constructor(
    message: string,
    public readonly details?: {
      notificationId?: string;
      totalClients?: number;
      failedClients?: number;
      errors?: string[];
      timestamp?: string;
    },
  ) {
    super({
      error: 'WebSocket Broadcast Failed',
      message,
      details,
    });
  }
}

export class WebSocketClientManagementException extends WsException {
  constructor(
    message: string,
    public readonly details?: {
      socketId?: string;
      userId?: string;
      operation?: 'add' | 'remove' | 'update';
      reason?: string;
      timestamp?: string;
    },
  ) {
    super({
      error: 'WebSocket Client Management Failed',
      message,
      details,
    });
  }
}
