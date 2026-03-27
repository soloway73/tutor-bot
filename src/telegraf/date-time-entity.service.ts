import { Injectable } from '@nestjs/common';

export interface DateTimeEntity {
  type: 'date_time';
  offset: number;
  length: number;
  unix_time: number;
}

/**
 * Service for creating Telegram Bot API 9.5+ date_time entities
 * Allows sending interactive dates that users can add to favorites or set reminders
 */
@Injectable()
export class DateTimeEntityService {
  /**
   * Create a date_time entity for the given date
   * @param date - The date/time to encode
   * @param textPosition - Position in text where entity should be attached (offset)
   * @param textLength - Length of the text segment to attach to (default: 1)
   */
  createEntity(
    date: Date,
    textPosition: number = 0,
    textLength: number = 1,
  ): DateTimeEntity {
    return {
      type: 'date_time',
      offset: textPosition,
      length: textLength,
      unix_time: Math.floor(date.getTime() / 1000),
    };
  }

  /**
   * Convert ISO date string to unix timestamp
   * @param isoString - ISO 8601 date string
   */
  isoToUnix(isoString: string | null | undefined): number | null {
    if (!isoString) return null;
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / 1000);
  }
}
