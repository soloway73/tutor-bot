import { Module, Global, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SentNotificationService } from './sent-notification.service';
import { NotificationCronService } from './notification-cron.service';
import { UserModule } from '../user/user.module';
import { TelegrafModule } from '../telegraf/telegraf.module';
import { CalendarModule } from '../calendar/calendar.module';

@Global()
@Module({
  imports: [UserModule, forwardRef(() => TelegrafModule), CalendarModule],
  providers: [
    NotificationService,
    SentNotificationService,
    NotificationCronService,
  ],
  exports: [NotificationService, SentNotificationService, NotificationCronService],
})
export class NotificationModule {}
