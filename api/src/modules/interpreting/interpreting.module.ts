import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceMode } from './entities/service-mode.entity';
import { InterpreterProfile } from './entities/interpreter-profile.entity';
import { Faq } from './entities/faq.entity';
import { BookingSubmission } from './entities/booking-submission.entity';
import { InterpretingService } from './interpreting.service';
import { InterpretingController } from './interpreting.controller';
import { OrdersModule } from '../orders/orders.module';
import { TravelerBookingsController } from './traveler-bookings.controller';
import { TravelerBookingsService } from './traveler-bookings.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { City } from '../cities/entities/city.entity';
import { StoryRoute } from '../routes/entities/story-route.entity';
import { RouteCityLink } from '../routes/entities/route-city-link.entity';
import { User } from '../users/entities/user.entity';
import { AdminNotification } from '../notifications/entities/admin-notification.entity';
import { ServiceRequestAssignment, ServiceRequestMessage, ServiceRequestQuote, ServiceRequestRead } from './entities/service-request.entity';
import { ServiceRequestsService } from './service-requests.service';
import { AccountServiceRequestsController, AdminServiceRequestsController, ServicePackagesController } from './service-requests.controller';

@Module({
  imports: [
    OrdersModule,
    NotificationsModule,
    EmailModule,
    TypeOrmModule.forFeature([
      ServiceMode,
      InterpreterProfile,
      Faq,
      BookingSubmission,
      City, StoryRoute, RouteCityLink, User, AdminNotification,
      ServiceRequestAssignment, ServiceRequestMessage, ServiceRequestQuote, ServiceRequestRead,
    ]),
  ],
  controllers: [InterpretingController, TravelerBookingsController, ServicePackagesController, AccountServiceRequestsController, AdminServiceRequestsController],
  providers: [InterpretingService, TravelerBookingsService, ServiceRequestsService],
  exports: [InterpretingService],
})
export class InterpretingModule {}
