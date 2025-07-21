import { plainToInstance, Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsPort,
  validateSync,
  IsUrl,
  Matches,
} from 'class-validator';

export class EnvironmentVariables {
  // Application Settings
  @IsOptional()
  @IsIn(['dev', 'staging', 'prod'])
  STAGE: string = 'dev';

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsPort()
  PORT: number = 3000;

  @IsOptional()
  @IsUrl({ require_tld: false })
  HOST_API: string;

  // Database Configuration
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Transform(({ value }) => parseInt(value))
  @IsPort()
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  // JWT Authentication
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+[smhd]$/, {
    message: 'JWT_EXPIRES_IN must be in format like 60s, 10m, 2h, 7d',
  })
  JWT_EXPIRES_IN: string = '24h';

  // WebSocket Notification Service
  @IsString()
  @IsNotEmpty()
  WEBHOOK_API_TOKEN: string;

  @IsOptional()
  @IsString()
  WS_CORS_ORIGIN: string = '*';

  @IsOptional()
  @IsString()
  @Matches(/^\/[a-zA-Z0-9_-]*$/, {
    message:
      'WS_NAMESPACE must start with / and contain only alphanumeric characters, hyphens, and underscores',
  })
  WS_NAMESPACE: string = '/notifications';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(
      `Environment validation failed:\n${errorMessages.join('\n')}`,
    );
  }

  return validatedConfig;
}
