import { Module } from '@nestjs/common';
import { TelegrafService } from './telegraf.service';
import { SimplePollingService } from './simple-polling.service';
import { DateTimeEntityService } from './date-time-entity.service';
import { UserModule } from '../user/user.module';
import { CalendarModule } from '../calendar/calendar.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [UserModule, CalendarModule, NotificationModule],
  providers: [TelegrafService, SimplePollingService, DateTimeEntityService],
  exports: [TelegrafService, DateTimeEntityService],
})
export class TelegrafModule {}
