import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsIn,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class WebSocketNotificationDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsString()
  @IsIn(['low', 'normal', 'high'])
  priority: 'low' | 'normal' | 'high';

  @IsDateString()
  timestamp: string;

  @IsString()
  @IsIn(['webhook', 'system'])
  source: 'webhook' | 'system';
}
