import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

// Controllers
import { WebhookController } from './controllers/webhook.controller';

// Gateways
import { NotificationGateway } from './gateways/notification.gateway';

// Services
import { NotificationService } from './services/notification.service';

// Guards
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    // Import ConfigModule to access environment variables
    ConfigModule,

    // Import JwtModule for potential future WebSocket authentication
    // Currently not used but configured for extensibility
    UserModule
  ],
  controllers: [WebhookController],
  providers: [NotificationService, NotificationGateway, WebhookAuthGuard],
  exports: [
    // Export NotificationService for potential use in other modules
    NotificationService,
    // Export NotificationGateway for potential direct access
    NotificationGateway,
  ],
})
export class NotificationModule {}
