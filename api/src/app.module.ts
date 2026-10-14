import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { getDatabaseConfig } from './config/database.config';
import appConfig from './config/app.config';

// Common
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PublicContentCacheModule } from './common/cache/public-content-cache.module';
import { PublicContentCacheInterceptor } from './common/cache/public-content-cache.interceptor';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CitiesModule } from './modules/cities/cities.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ShopModule } from './modules/shop/shop.module';
import { InterpretingModule } from './modules/interpreting/interpreting.module';
import { OrdersModule } from './modules/orders/orders.module';
import { UploadModule } from './modules/upload/upload.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HomeModule } from './modules/home/home.module';
import { SettingsModule } from './modules/settings/settings.module';
import { CommunityModule } from './modules/community/community.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    // Global config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // In-memory cache
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ttl: 600,
        max: 100,
      }),
      isGlobal: true,
    }),

    // Rate limiting (global default: 60 requests per minute)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Scheduled jobs: unpaid-order expiry sweep (stock release) and the
    // nightly verification-code cleanup.
    ScheduleModule.forRoot(),

    // Serve uploaded files
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // Public content caching is explicit at read boundaries only. It never
    // intercepts authenticated, payment, order, preview, or mutation traffic.
    PublicContentCacheModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CitiesModule,
    RoutesModule,
    ShopModule,
    InterpretingModule,
    OrdersModule,
    UploadModule,
    DashboardModule,
    HomeModule,
    SettingsModule,
    CommunityModule,
    EventsModule,
    HealthModule,
    AuditModule,
    NotificationsModule,
    EmailModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // RolesGuard 必须在 JwtAuthGuard 之后注册，
      // 这样 request.user 已经被 JwtAuthGuard 填充。
      // NestJS 全局 guard 按 providers 数组顺序执行。
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PublicContentCacheInterceptor,
    },
  ],
})
export class AppModule {}
