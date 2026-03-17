import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { calendar_v3 } from 'googleapis';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(private configService: ConfigService) {
    const credentials = this.configService.get<string>('GOOGLE_CREDENTIALS');
    this.calendarId = this.configService.get<string>(
      'GOOGLE_CALENDAR_ID',
      'primary',
    );

    if (credentials) {
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(credentials),
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      this.calendar = google.calendar({
        version: 'v3',
        auth,
      });
    } else {
      this.logger.warn(
        'Google credentials not provided. CalendarService will not function.',
      );
    }
  }

  async getUpcomingEvents(
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      this.logger.error('Calendar API not initialized');
      return [];
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      this.logger.log(`Found ${events.length} upcoming events`);
      return events as CalendarEvent[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error fetching calendar events: ${errorMessage}`,
        errorStack,
      );
      return [];
    }
  }

  /**
   * Extract identifier (phone or email) from event description or summary
   */
  parseIdentifier(event: CalendarEvent): string | null {
    const text = `${event.summary || ''} ${event.description || ''}`;

    // Try to find email pattern
    const emailPattern = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      return emailMatch[0];
    }

    // Try to find phone pattern (simple pattern, adjust as needed)
    const phonePattern = /\+?\d[\d\s-]{8,}\d/;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) {
      return phoneMatch[0].replace(/\s/g, '');
    }

    return null;
  }
}
