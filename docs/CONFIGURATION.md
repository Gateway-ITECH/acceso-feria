# Configuration Guide

This document provides detailed information about configuring the WebSocket Notification Service and the overall application.

## Environment Variables

All configuration is managed through environment variables. Copy `.env.Template` to `.env` and configure the values according to your environment.

### Application Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STAGE` | No | `dev` | Application environment (`dev`, `staging`, `prod`) |
| `PORT` | No | `3000` | Server port number |
| `HOST_API` | No | - | API host URL for CORS and external references |

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_HOST` | Yes | - | PostgreSQL database host |
| `DB_PORT` | Yes | `5438` | PostgreSQL database port |
| `DB_USERNAME` | Yes | - | Database username |
| `DB_PASSWORD` | Yes | - | Database password |
| `DB_NAME` | Yes | - | Database name |

### JWT Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for JWT token signing |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiration time |

**JWT_SECRET Security:**
- Use a strong, random string (minimum 32 characters)
- Generate using: `openssl rand -base64 32`
- Never commit this value to version control
- Rotate regularly in production

**JWT_EXPIRES_IN Format:**
- Supports: `60s` (seconds), `10m` (minutes), `2h` (hours), `7d` (days)
- Shorter expiration times are more secure but require more frequent re-authentication

### WebSocket Notification Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEBHOOK_API_TOKEN` | Yes | - | API token for webhook authentication |
| `WS_CORS_ORIGIN` | No | `*` | WebSocket CORS allowed origins |
| `WS_NAMESPACE` | No | `/notifications` | WebSocket namespace |

## Security Considerations

### Webhook Authentication

The webhook endpoint requires Bearer token authentication:

```bash
curl -X POST http://localhost:3000/api/notifications/webhook \
  -H "Authorization: Bearer YOUR_WEBHOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "info", "message": "Test notification"}'
```

**Security Best Practices:**
- Generate a strong, random token: `openssl rand -base64 32`
- Store the token securely (environment variables, secrets manager)
- Use HTTPS in production
- Rotate tokens regularly
- Monitor for unauthorized access attempts

### WebSocket CORS Configuration

**Development:**
```env
WS_CORS_ORIGIN=*
```

**Production:**
```env
WS_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

**Security Considerations:**
- Never use `*` in production
- Specify exact domains that should have access
- Use HTTPS origins only in production
- Consider subdomain policies carefully

### Database Security

**Connection Security:**
- Use SSL connections in production (`STAGE=prod` enables SSL)
- Use strong database passwords
- Limit database user permissions to minimum required
- Consider connection pooling limits

**Environment-Specific Settings:**
- Development: SSL disabled for local development
- Production: SSL enabled with certificate validation

## Environment-Specific Configuration

### Development Environment

```env
STAGE=dev
PORT=3000
WS_CORS_ORIGIN=*
JWT_EXPIRES_IN=24h
```

### Staging Environment

```env
STAGE=staging
PORT=3000
WS_CORS_ORIGIN=https://staging.yourdomain.com
JWT_EXPIRES_IN=8h
```

### Production Environment

```env
STAGE=prod
PORT=3000
WS_CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
JWT_EXPIRES_IN=1h
```

## Configuration Validation

The application validates all environment variables on startup. If validation fails, the application will not start and will display detailed error messages.

### Common Validation Errors

1. **Missing Required Variables:**
   ```
   Environment validation failed:
   JWT_SECRET: should not be empty
   WEBHOOK_API_TOKEN: should not be empty
   ```

2. **Invalid Format:**
   ```
   Environment validation failed:
   JWT_EXPIRES_IN: JWT_EXPIRES_IN must be in format like 60s, 10m, 2h, 7d
   WS_NAMESPACE: WS_NAMESPACE must start with / and contain only alphanumeric characters
   ```

3. **Invalid Port:**
   ```
   Environment validation failed:
   DB_PORT: must be a port
   ```

## Monitoring and Logging

### Log Levels

The application logs important events at different levels:

- **INFO**: Normal operations (connections, successful notifications)
- **WARN**: Recoverable issues (partial broadcast failures, missing clients)
- **ERROR**: Serious issues (authentication failures, configuration errors)

### Key Metrics to Monitor

1. **WebSocket Connections:**
   - Total active connections
   - Connection/disconnection rates
   - Authentication failures

2. **Webhook Activity:**
   - Request rates
   - Authentication failures
   - Processing errors

3. **Notification Delivery:**
   - Successful deliveries
   - Failed deliveries
   - Broadcast vs targeted notification ratios

## Troubleshooting

### Common Issues

1. **Application Won't Start:**
   - Check environment variable validation errors
   - Verify database connectivity
   - Ensure all required variables are set

2. **WebSocket Connection Failures:**
   - Check CORS configuration
   - Verify namespace configuration
   - Check client connection URL

3. **Webhook Authentication Failures:**
   - Verify `WEBHOOK_API_TOKEN` is set correctly
   - Check Authorization header format: `Bearer <token>`
   - Ensure token matches exactly (case-sensitive)

4. **Database Connection Issues:**
   - Verify database credentials
   - Check network connectivity
   - Ensure database server is running

### Debug Mode

Enable debug logging by setting the log level in your application:

```typescript
// In main.ts or app configuration
app.useLogger(['error', 'warn', 'log', 'debug']);
```

## Performance Considerations

### WebSocket Connections

- Monitor memory usage with many concurrent connections
- Consider connection limits based on server resources
- Implement connection cleanup for idle connections

### Database Performance

- Monitor connection pool usage
- Consider read replicas for high-traffic scenarios
- Implement proper indexing for user queries

### Notification Throughput

- Monitor notification processing times
- Consider message queuing for high-volume scenarios
- Implement rate limiting if needed

## Backup and Recovery

### Environment Configuration

- Store environment configurations in secure configuration management
- Maintain separate configurations for each environment
- Document all configuration changes

### Database Backups

- Implement regular database backups
- Test backup restoration procedures
- Consider point-in-time recovery requirements

## Security Checklist

- [ ] Strong, unique JWT_SECRET configured
- [ ] Strong, unique WEBHOOK_API_TOKEN configured
- [ ] CORS origins restricted in production
- [ ] HTTPS enabled in production
- [ ] Database SSL enabled in production
- [ ] Environment variables not committed to version control
- [ ] Regular token rotation schedule established
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures tested