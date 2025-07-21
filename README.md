# NestJS Application with WebSocket Notification Service

A robust NestJS application featuring user management and real-time WebSocket notifications. The application provides a secure webhook endpoint for external applications to send notifications that are distributed to connected WebSocket clients in real-time.

## Features

- **User Management**: Complete user authentication and management system
- **WebSocket Notifications**: Real-time notification delivery to connected clients
- **Webhook API**: Secure endpoint for external applications to send notifications
- **JWT Authentication**: Secure authentication for both REST and WebSocket connections
- **PostgreSQL Database**: Robust data persistence with TypeORM
- **Environment Validation**: Comprehensive configuration validation on startup

## Architecture

The application follows a modular architecture with clear separation of concerns:

- **User Module**: Handles user authentication and management
- **Notification Module**: Manages WebSocket connections and notification distribution
- **Configuration**: Environment-based configuration with validation

## Quick Start

### Prerequisites

- Node.js >= 12.0.0
- PostgreSQL database
- Yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
yarn install
```

3. Configure environment variables:
```bash
cp .env.Template .env
# Edit .env with your configuration values
```

4. Start the application:
```bash
# Development
yarn start:dev

# Production
yarn build
yarn start:prod
```

## Configuration

See [Configuration Guide](docs/CONFIGURATION.md) for detailed configuration instructions.

### Required Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database

# JWT Authentication
JWT_SECRET=your-strong-jwt-secret

# WebSocket Notifications
WEBHOOK_API_TOKEN=your-webhook-token
```

## WebSocket Notification Service

The application includes a comprehensive WebSocket notification service that allows external applications to send real-time notifications to connected clients.

### API Documentation

#### Webhook Endpoint

Send notifications to connected WebSocket clients via HTTP webhook.

**Endpoint:** `POST /api/notifications/webhook`

**Authentication:** Bearer token required in Authorization header

**Request Headers:**
```
Authorization: Bearer YOUR_WEBHOOK_TOKEN
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "info",
  "message": "Your notification message",
  "targetUsers": ["user1", "user2"],
  "data": {
    "customField": "customValue"
  },
  "priority": "normal"
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Notification type (e.g., "info", "warning", "error") |
| `message` | string | Yes | The notification message |
| `targetUsers` | string[] | No | Array of user IDs to target (omit for broadcast) |
| `data` | object | No | Additional custom data |
| `priority` | string | No | Priority level: "low", "normal", "high" (default: "normal") |

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "notificationId": "uuid-generated-id",
  "deliveredTo": 5
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing webhook token
- `400 Bad Request`: Invalid request body or validation errors
- `500 Internal Server Error`: Server processing error

### WebSocket Connection

Connect to the WebSocket server to receive real-time notifications.

**Connection URL:** `ws://localhost:3000/notifications`

**Connection with User ID:**
```javascript
const socket = io('http://localhost:3000/notifications', {
  query: {
    userId: 'your-user-id'
  }
});
```

**Connection Events:**

1. **Connected Event:**
```javascript
socket.on('connected', (data) => {
  console.log('Connected:', data);
  // {
  //   message: "Successfully connected to notification service",
  //   socketId: "socket-id",
  //   userId: "your-user-id",
  //   timestamp: "2024-01-01T00:00:00.000Z",
  //   authenticated: true
  // }
});
```

2. **Notification Event:**
```javascript
socket.on('notification', (notification) => {
  console.log('Received notification:', notification);
  // {
  //   id: "uuid-generated-id",
  //   type: "info",
  //   message: "Your notification message",
  //   data: { customField: "customValue" },
  //   priority: "normal",
  //   timestamp: "2024-01-01T00:00:00.000Z",
  //   source: "webhook"
  // }
});
```

### Usage Examples

#### Sending a Broadcast Notification

```bash
curl -X POST http://localhost:3000/api/notifications/webhook \
  -H "Authorization: Bearer YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "announcement",
    "message": "System maintenance scheduled for tonight at 2 AM",
    "priority": "high"
  }'
```

#### Sending a Targeted Notification

```bash
curl -X POST http://localhost:3000/api/notifications/webhook \
  -H "Authorization: Bearer YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "alert",
    "message": "Your order has been shipped",
    "targetUsers": ["user123", "user456"],
    "data": {
      "orderId": "ORD-789",
      "trackingNumber": "TRK-123456"
    }
  }'
```

#### JavaScript WebSocket Client

```javascript
import { io } from 'socket.io-client';

// Connect to the notification service
const socket = io('http://localhost:3000/notifications', {
  query: {
    userId: 'current-user-id'
  }
});

// Handle connection
socket.on('connected', (data) => {
  console.log('Connected to notification service:', data);
});

// Handle notifications
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  
  // Display notification to user
  showNotification(notification.message, notification.type);
  
  // Handle custom data if present
  if (notification.data) {
    handleCustomData(notification.data);
  }
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from notification service');
});

function showNotification(message, type) {
  // Your notification display logic here
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
}
```

#### React Hook Example

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function useNotifications(userId) {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io('http://localhost:3000/notifications', {
      query: { userId }
    });

    newSocket.on('connected', (data) => {
      setIsConnected(true);
      console.log('Connected to notifications:', data);
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [...prev, notification]);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [userId]);

  return { socket, notifications, isConnected };
}
```

## Message Formats

### Webhook Notification Format

```typescript
interface WebhookNotificationDto {
  type: string;                    // Notification type
  message: string;                 // Main message
  targetUsers?: string[];          // Optional user targeting
  data?: Record<string, any>;      // Optional custom data
  priority?: 'low' | 'normal' | 'high'; // Optional priority
}
```

### WebSocket Notification Format

```typescript
interface WebSocketNotificationDto {
  id: string;                      // Unique notification ID
  type: string;                    // Notification type
  message: string;                 // Main message
  data?: Record<string, any>;      // Optional custom data
  priority: 'low' | 'normal' | 'high'; // Priority level
  timestamp: Date;                 // When notification was created
  source: 'webhook' | 'system';    // Source of notification
}
```

## Development

### Running Tests

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# Test coverage
yarn test:cov
```

### Development Commands

```bash
# Start in development mode with hot reload
yarn start:dev

# Start in debug mode
yarn start:debug

# Build for production
yarn build

# Lint code
yarn lint

# Format code
yarn format
```

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if the server is running on the correct port
   - Verify CORS configuration for your domain
   - Ensure the WebSocket namespace is correct (`/notifications`)

2. **Webhook Authentication Failed**
   - Verify the `WEBHOOK_API_TOKEN` environment variable is set
   - Check that the Authorization header format is `Bearer <token>`
   - Ensure the token matches exactly (case-sensitive)

3. **Notifications Not Received**
   - Check if the WebSocket client is properly connected
   - Verify the user ID is correctly set during connection
   - Check server logs for any processing errors

4. **Database Connection Issues**
   - Verify database credentials in environment variables
   - Ensure PostgreSQL server is running
   - Check network connectivity to database host

### Debug Mode

Enable detailed logging by setting the log level:

```typescript
// In main.ts
app.useLogger(['error', 'warn', 'log', 'debug']);
```

### Health Check

Check if the notification service is working:

```bash
# Test webhook endpoint (should return 401 without token)
curl -X POST http://localhost:3000/api/notifications/webhook

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:3000/socket.io/
```

## Security Considerations

- Always use HTTPS in production
- Keep webhook tokens secure and rotate them regularly
- Restrict CORS origins in production environments
- Monitor for unauthorized access attempts
- Use strong JWT secrets and rotate them periodically

## License

This project is licensed under the UNLICENSED license.

---

<p align="center">
  <a href="http://nestjs.com/" target="blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" />
  </a>
</p>
