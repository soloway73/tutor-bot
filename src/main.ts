import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load .env file before anything else
dotenv.config();

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Enable validation globally
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    // Enable CORS if needed
    app.enableCors();

    // Enable shutdown hooks for graceful shutdown
    app.enableShutdownHooks();

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    logger.log(`Application running on port: ${port}`);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to start application: ${errorMessage}`);
    process.exit(1);
  }
}

void bootstrap();
