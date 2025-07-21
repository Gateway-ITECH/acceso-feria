import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
} from 'class-validator';

export class WebhookNotificationDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUsers?: string[];

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';
}
