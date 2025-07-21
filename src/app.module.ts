import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { NotificationModule } from './notification/notification.module';
import { validateEnvironment } from './config/environment.validation';
import { DatabaseModule } from './database/database.module';
import config from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [config],
    }),
    UserModule,
    NotificationModule,
    DatabaseModule,
  ],
})
export class AppModule {}
