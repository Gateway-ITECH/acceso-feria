# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the WebSocket Notification Service.

## Quick Diagnostics

### Health Check Commands

```bash
# 1. Check if the application is running
curl http://localhost:3000/

# 2. Test webhook endpoint (should return 401 without token)
curl -X POST http://localhost:3000/api/notifications/webhook

# 3. Test with valid token
curl -X POST http://localhost:3000/api/notifications/webhook \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "test", "message": "Health check"}'

# 4. Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: test" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:3000/socket.io/
```

## Common Issues and Solutions

### 1. Application Won't Start

#### Symptoms
- Application crashes on startup
- Environment validation errors
- Database connection failures

#### Diagnostic Steps
```bash
# Check environment variables
cat .env

# Validate required variables are set
echo "JWT_SECRET: $JWT_SECRET"
echo "WEBHOOK_API_TOKEN: $WEBHOOK_API_TOKEN"
echo "DB_HOST: $DB_HOST"

# Test database connection
psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME -c "SELECT 1;"
```

#### Common Solutions

**Missing Environment Variables:**
```bash
# Copy template and configure
cp .env.Template .env
# Edit .env with your values
```

**Invalid Environment Variable Format:**
```bash
# Check JWT_EXPIRES_IN format (should be like: 24h, 30m, 7d)
JWT_EXPIRES_IN=24h

# Check WS_NAMESPACE format (should start with /)
WS_NAMESPACE=/notifications
```

**Database Connection Issues:**
```bash
# Verify database is running
sudo systemctl status postgresql

# Check network connectivity
telnet $DB_HOST $DB_PORT

# Verify credentials
psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME
```

### 2. WebSocket Connection Failures

#### Symptoms
- Clients cannot connect to WebSocket
- Connection immediately drops
- CORS errors in browser console

#### Diagnostic Steps
```javascript
// Test WebSocket connection in browser console
const socket = io('http://localhost:3000/notifications');
socket.on('connect', () => console.log('Connected'));
socket.on('connect_error', (error) => console.error('Connection failed:', error));
```

#### Common Solutions

**CORS Configuration:**
```env
# For development
WS_CORS_ORIGIN=*

# For production (specify exact domains)
WS_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

**Wrong Namespace:**
```javascript
// Correct connection URL
const socket = io('http://localhost:3000/notifications');

// Not this
const socket = io('http://localhost:3000/notification'); // Missing 's'
```

**Port Issues:**
```bash
# Check if port is in use
netstat -tulpn | grep :3000

# Check application logs
yarn start:dev
```

### 3. Webhook Authentication Failures

#### Symptoms
- HTTP 401 Unauthorized responses
- "Invalid webhook token" errors
- "Authorization header is required" errors

#### Diagnostic Steps
```bash
# Test without token (should return 401)
curl -X POST http://localhost:3000/api/notifications/webhook

# Test with invalid token
curl -X POST http://localhost:3000/api/notifications/webhook \
  -H "Authorization: Bearer invalid-token"

# Check server logs for authentication attempts
tail -f logs/application.log | grep WEBHOOK_AUTH
```

#### Common Solutions

**Missing Authorization Header:**
```bash
# Correct format
curl -H "Authorization: Bearer YOUR_TOKEN" ...

# Not this
curl -H "Authorization: YOUR_TOKEN" ...  # Missing "Bearer"
```

**Token Mismatch:**
```bash
# Check environment variable
echo $WEBHOOK_API_TOKEN

# Ensure token matches exactly (case-sensitive)
# Generate new token if needed
openssl rand -base64 32
```

**Server Configuration:**
```bash
# Verify token is set in environment
grep WEBHOOK_API_TOKEN .env

# Restart application after changing token
yarn start:dev
```

### 4. Notifications Not Being Received

#### Symptoms
- Webhook returns success but clients don't receive notifications
- Some clients receive notifications, others don't
- Notifications received with delay

#### Diagnostic Steps
```javascript
// Check WebSocket connection status
socket.connected // Should be true

// Listen for all events to debug
socket.onAny((event, ...args) => {
  console.log('WebSocket event:', event, args);
});

// Check connection stats (if available)
socket.emit('getStats', (stats) => console.log(stats));
```

#### Common Solutions

**Client Not Connected:**
```javascript
// Ensure proper connection handling
socket.on('connect', () => {
  console.log('Connected with ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Implement reconnection logic if needed
});
```

**User ID Issues:**
```javascript
// For targeted notifications, ensure user ID is set
const socket = io('http://localhost:3000/notifications', {
  query: {
    userId: 'actual-user-id' // Must match targetUsers in webhook
  }
});
```

**Server-Side Issues:**
```bash
# Check server logs for processing errors
tail -f logs/application.log | grep notification

# Monitor WebSocket connections
# Look for connection/disconnection logs
```

### 5. High Memory Usage or Performance Issues

#### Symptoms
- Application memory usage keeps growing
- Slow notification delivery
- Connection timeouts

#### Diagnostic Steps
```bash
# Monitor memory usage
top -p $(pgrep node)

# Check number of WebSocket connections
netstat -an | grep :3000 | grep ESTABLISHED | wc -l

# Monitor application logs for errors
tail -f logs/application.log | grep ERROR
```

#### Common Solutions

**Memory Leaks:**
```javascript
// Ensure proper cleanup in client code
useEffect(() => {
  const socket = io('...');
  
  return () => {
    socket.disconnect(); // Important: cleanup on unmount
  };
}, []);
```

**Too Many Connections:**
```bash
# Implement connection limits in production
# Monitor and alert on connection count
# Consider load balancing for high traffic
```

**Database Connection Pool:**
```typescript
// In TypeORM configuration
{
  // Limit connection pool size
  extra: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  }
}
```

## Error Code Reference

### HTTP Error Codes

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 401 | Unauthorized | Missing/invalid webhook token | Check Authorization header and token |
| 400 | Bad Request | Invalid request body | Validate JSON format and required fields |
| 500 | Internal Server Error | Server processing error | Check server logs and configuration |

### WebSocket Error Codes

| Event | Error | Cause | Solution |
|-------|-------|-------|----------|
| `connect_error` | Connection failed | Network/CORS issues | Check URL, CORS, and network |
| `disconnect` | Connection lost | Network interruption | Implement reconnection logic |
| `error` | General error | Various causes | Check error details and logs |

## Debugging Tools

### Enable Debug Logging

```typescript
// In main.ts
app.useLogger(['error', 'warn', 'log', 'debug']);

// Or set environment variable
DEBUG=* yarn start:dev
```

### WebSocket Debug Client

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Debug Client</title>
    <script src="https://cdn.socket.io/4.7.0/socket.io.min.js"></script>
</head>
<body>
    <div id="status">Disconnected</div>
    <div id="messages"></div>
    
    <script>
        const socket = io('http://localhost:3000/notifications', {
            query: { userId: 'debug-user' }
        });
        
        const status = document.getElementById('status');
        const messages = document.getElementById('messages');
        
        socket.on('connect', () => {
            status.textContent = 'Connected: ' + socket.id;
            status.style.color = 'green';
        });
        
        socket.on('disconnect', () => {
            status.textContent = 'Disconnected';
            status.style.color = 'red';
        });
        
        socket.onAny((event, data) => {
            const div = document.createElement('div');
            div.textContent = `${new Date().toISOString()} - ${event}: ${JSON.stringify(data)}`;
            messages.appendChild(div);
        });
    </script>
</body>
</html>
```

### Webhook Test Script

```bash
#!/bin/bash
# webhook-test.sh

TOKEN="your-webhook-token"
URL="http://localhost:3000/api/notifications/webhook"

echo "Testing webhook endpoint..."

# Test 1: No auth (should fail)
echo "Test 1: No authentication"
curl -s -X POST $URL -H "Content-Type: application/json" -d '{"type":"test","message":"test"}' | jq .

# Test 2: Valid auth
echo "Test 2: Valid authentication"
curl -s -X POST $URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"test","message":"Test notification"}' | jq .

# Test 3: Targeted notification
echo "Test 3: Targeted notification"
curl -s -X POST $URL \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"test","message":"Targeted test","targetUsers":["debug-user"]}' | jq .
```

## Performance Monitoring

### Key Metrics to Monitor

1. **WebSocket Connections:**
   - Total active connections
   - Connection rate (connections/second)
   - Disconnection rate

2. **Notification Processing:**
   - Webhook request rate
   - Notification delivery success rate
   - Average processing time

3. **System Resources:**
   - Memory usage
   - CPU usage
   - Database connection pool usage

### Monitoring Commands

```bash
# Monitor WebSocket connections
watch "netstat -an | grep :3000 | grep ESTABLISHED | wc -l"

# Monitor memory usage
watch "ps aux | grep node | grep -v grep"

# Monitor application logs
tail -f logs/application.log | grep -E "(ERROR|WARN|notification)"
```

## Getting Help

If you're still experiencing issues after following this guide:

1. **Check Application Logs:**
   ```bash
   tail -f logs/application.log
   ```

2. **Enable Debug Mode:**
   ```bash
   DEBUG=* yarn start:dev
   ```

3. **Collect System Information:**
   ```bash
   node --version
   yarn --version
   cat package.json | grep version
   ```

4. **Document the Issue:**
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages and logs
   - Environment details

5. **Test with Minimal Example:**
   - Use the debug client provided above
   - Test with simple webhook calls
   - Isolate the problem area

Remember to check the [Configuration Guide](CONFIGURATION.md) for detailed setup instructions and security considerations.