import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Cookie parser middleware
  app.use(cookieParser());

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only
    }),
  );

  // CORS configuration (explicit & safe)
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) throw new Error('FRONTEND_URL env var is required');

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
