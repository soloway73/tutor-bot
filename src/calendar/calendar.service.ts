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
   * Нормализует идентификатор: удаляет пробелы, email приводит к нижнему регистру
   */
  parseIdentifier(event: CalendarEvent): string | null {
    const text = `${event.summary || ''} ${event.description || ''}`;

    // Try to find email pattern
    const emailPattern = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      // Normalize email: remove spaces and convert to lowercase
      return emailMatch[0].replace(/\s/g, '').toLowerCase();
    }

    // Try to find phone pattern (simple pattern, adjust as needed)
    const phonePattern = /\+?\d[\d\s-]{8,}\d/;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch) {
      // Normalize phone: remove all spaces
      return phoneMatch[0].replace(/\s/g, '');
    }

    return null;
  }

  /**
   * Get upcoming events that match the given identifier
   */
  async getUpcomingEventsByIdentifier(
    identifier: string,
    limit = 2,
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      this.logger.error('Calendar API not initialized');
      return [];
    }

    try {
      // Get events for the next 7 days
      const now = new Date();
      const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const allEvents = response.data.items || [];
      this.logger.log(
        `Found ${allEvents.length} upcoming events, filtering by identifier: ${identifier}`,
      );

      // Filter events that contain the identifier
      const matchingEvents = allEvents.filter((event) => {
        const eventIdentifier = this.parseIdentifier(event as CalendarEvent);
        return eventIdentifier === identifier;
      });

      // Return only the requested number of events
      const result = matchingEvents.slice(0, limit);
      this.logger.log(
        `Returning ${result.length} matching events for identifier: ${identifier}`,
      );
      return result as CalendarEvent[];
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
   * Get past events that match the given identifier (for history)
   */
  async getPastEventsByIdentifier(
    identifier: string,
    limit = 10,
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      this.logger.error('Calendar API not initialized');
      return [];
    }

    try {
      // Get events from the last 30 days
      const now = new Date();
      const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const allEvents = response.data.items || [];
      this.logger.log(
        `Found ${allEvents.length} past events, filtering by identifier: ${identifier}`,
      );

      // Filter events that contain the identifier
      const matchingEvents = allEvents.filter((event) => {
        const eventIdentifier = this.parseIdentifier(event as CalendarEvent);
        return eventIdentifier === identifier;
      });

      // Return the most recent events (reverse order)
      const result = matchingEvents.reverse().slice(0, limit);
      this.logger.log(
        `Returning ${result.length} matching past events for identifier: ${identifier}`,
      );
      return result as CalendarEvent[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error fetching past calendar events: ${errorMessage}`,
        errorStack,
      );
      return [];
    }
  }

  /**
   * Get recent past events for user history (last 16 events)
   */
  async getRecentPastEvents(limit = 16): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      this.logger.error('Calendar API not initialized');
      return [];
    }

    try {
      // Get events from the last 90 days to ensure we have enough
      const now = new Date();
      const startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const allEvents = response.data.items || [];
      this.logger.log(`Found ${allEvents.length} past events`);

      // Return the most recent events in reverse chronological order
      const result = allEvents.reverse().slice(0, limit);
      this.logger.log(`Returning ${result.length} recent past events`);
      return result as CalendarEvent[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error fetching recent past calendar events: ${errorMessage}`,
        errorStack,
      );
      return [];
    }
  }

  /**
   * Get recent past events for a specific user identifier (last 16 events)
   * Returns events in chronological order (oldest first)
   */
  async getRecentPastEventsByIdentifier(
    identifier: string,
    limit = 16,
  ): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      this.logger.error('Calendar API not initialized');
      return [];
    }

    try {
      // Get events from the last 90 days to ensure we have enough
      const now = new Date();
      const startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: startTime.toISOString(),
        timeMax: now.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const allEvents = response.data.items || [];
      this.logger.log(
        `Found ${allEvents.length} past events, filtering by identifier: ${identifier}`,
      );

      // Filter events that match the user's identifier
      const matchingEvents = allEvents.filter((event) => {
        const eventIdentifier = this.parseIdentifier(event as CalendarEvent);
        return eventIdentifier === identifier;
      });

      // Return events in chronological order (oldest first), take last N
      const result = matchingEvents.slice(-limit);
      this.logger.log(
        `Returning ${result.length} matching past events for identifier: ${identifier}`,
      );
      return result as CalendarEvent[];
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error fetching recent past calendar events for identifier: ${errorMessage}`,
        errorStack,
      );
      return [];
    }
  }
}
