import { Module } from '@nestjs/common';
import { TelegrafService } from './telegraf.service';
import { SimplePollingService } from './simple-polling.service';
import { UserModule } from '../user/user.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [UserModule, CalendarModule],
  providers: [TelegrafService, SimplePollingService],
  exports: [TelegrafService],
})
export class TelegrafModule {}
