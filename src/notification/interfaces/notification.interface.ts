export interface ConnectedClient {
  socketId: string;
  userId: string;
  connectedAt: Date;
}

export interface BaseNotification {
  id: string;
  type: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high';
  timestamp: Date;
  source: 'webhook' | 'system';
}

export interface NotificationTarget {
  targetUsers?: string[];
  broadcast?: boolean;
}

export interface ProcessedNotification
  extends BaseNotification,
    NotificationTarget {
  processedAt: Date;
}
