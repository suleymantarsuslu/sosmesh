import { Module } from '@nestjs/common';
import { RelayDeliveryStatusController } from './relay-delivery-status.controller';
import { RelayDeliveryStatusService } from './relay-delivery-status.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RelayDeliveryStatusController],
  providers: [RelayDeliveryStatusService],
  exports: [RelayDeliveryStatusService],
})
export class RelayModule {}
