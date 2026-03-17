# Tutor Bot - Telegram Bot for Lesson Reminders

A NestJS-based Telegram bot that sends automatic reminders about upcoming lessons from Google Calendar.

## Features

- 🤖 **Telegram Integration** - Register users via Telegram commands
- 📅 **Google Calendar Sync** - Automatically fetch upcoming events
- ⏰ **Scheduled Reminders** - Cron-based notification system (every 10 minutes)
- 🔒 **Duplicate Prevention** - Never send the same reminder twice
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS (TypeScript) |
| Telegram API | nestjs-telegraf / telegraf |
| Database | PostgreSQL + Prisma ORM |
| Google API | googleapis |
| Scheduler | @nestjs/schedule (Cron) |
| Containerization | Docker / Docker Compose |

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Docker (optional, for containerized deployment)
- Telegram Bot Token (from @BotFather)
- Google Cloud Service Account with Calendar access

## Installation

### 1. Clone and Install Dependencies

```bash
cd tutor-bot
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

- `TELEGRAM_BOT_TOKEN` - Get from @BotFather on Telegram
- `GOOGLE_CREDENTIALS` - Service Account JSON from Google Cloud Console
- `GOOGLE_CALENDAR_ID` - Your calendar ID (or use 'primary')

### 3. Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create a Service Account
5. Generate and download JSON key
6. Copy the JSON content to `GOOGLE_CREDENTIALS` in `.env`
7. **Important**: Share your Google Calendar with the service account email (found in the JSON)

### 4. Database Setup

#### Option A: Using Docker Compose (Recommended)

```bash
docker-compose up -d postgres
npm run prisma:migrate
```

#### Option B: Local PostgreSQL

1. Create a PostgreSQL database
2. Update `DATABASE_URL` in `.env`
3. Run migrations:

```bash
npm run prisma:migrate
```

### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

### Using Docker Compose (Full Stack)

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot and register |
| `/me` | View your registration info |
| `/register` | Re-register with new identifier |
| `/help` | Show available commands |

## How It Works

1. **User Registration**: Users send `/start` and provide their email/phone
2. **Event Parsing**: Bot reads Google Calendar events every 10 minutes
3. **Identifier Matching**: Extracts email/phone from event description
4. **Reminder Sending**: Sends Telegram message to matched users
5. **Duplicate Prevention**: Tracks sent notifications to avoid spam

## Event Format

For the bot to work correctly, add student contact info to event descriptions:

```
Event Title: English Lesson
Description: Student email: student@example.com
```

Or:

```
Event Title: Math Tutoring
Description: Contact: +1234567890
```

## Project Structure

```
tutor-bot/
├── src/
│   ├── calendar/           # Google Calendar integration
│   ├── notification/       # Reminder logic and cron jobs
│   ├── prisma/             # Database module
│   ├── telegraf/           # Telegram bot handlers
│   ├── user/               # User management
│   ├── app.module.ts       # Main application module
│   └── main.ts             # Application entry point
├── prisma/
│   └── schema.prisma       # Database schema
├── docker-compose.yml      # Docker services configuration
├── Dockerfile              # Application container
└── .env.example            # Environment template
```

## Database Schema

```prisma
model User {
  id           Int                @id @default(autoincrement())
  chatId       String             @unique  // Telegram Chat ID
  identifier   String             @unique  // Email or Phone
  createdAt    DateTime           @default(now())
  notifications SentNotification[]
}

model SentNotification {
  id        Int      @id @default(autoincrement())
  eventId   String   // Google Calendar event ID
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  sentAt    DateTime @default(now())

  @@unique([eventId, userId])
}
```

## Troubleshooting

### Bot doesn't send messages

1. Check if `TELEGRAM_BOT_TOKEN` is correct
2. Verify user is registered (`/me` command)
3. Check application logs for errors

### No events found

1. Verify `GOOGLE_CREDENTIALS` JSON is valid
2. Ensure service account has access to the calendar
3. Check if events have email/phone in description

### Database connection error

1. Ensure PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Run `npx prisma migrate dev` to apply migrations

## License

UNLICENSED

## Support

For issues and questions, please create an issue in the repository.
