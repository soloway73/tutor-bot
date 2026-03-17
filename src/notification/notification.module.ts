import { Module, forwardRef } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SentNotificationService } from './sent-notification.service';
import { NotificationCronService } from './notification-cron.service';
import { UserModule } from '../user/user.module';
import { TelegrafModule } from '../telegraf/telegraf.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [UserModule, forwardRef(() => TelegrafModule), CalendarModule],
  providers: [
    NotificationService,
    SentNotificationService,
    NotificationCronService,
  ],
  exports: [NotificationService, SentNotificationService],
})
export class NotificationModule {}
