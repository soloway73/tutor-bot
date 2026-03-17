import { Module } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
