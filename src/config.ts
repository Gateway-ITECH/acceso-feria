import { registerAs } from '@nestjs/config';

export default registerAs('config', () => {
  return {
    database: {
      dbName: process.env.DB_NAME,
      dbPort: parseInt(process.env.DB_PORT ?? '5432', 10),
      dbHost: process.env.DB_HOST,
      dbUsername: process.env.DB_USERNAME,
      dbPassword: process.env.DB_PASSWORD,
    },
    server: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      host: process.env.HOST_API,
      port: parseInt(process.env.PORT ?? '3000', 10),
      stage: process.env.STAGE,
      webhookApiToken: process.env.WEBHOOK_API_TOKEN,
    },
    ws: {
      wsCorsOrigin: process.env.WS_CORS_ORIGIN,
      wsNameSpace: process.env.WS_NAME_SPACE,
    },
  };
});
