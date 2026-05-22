import { Module } from '@nestjs/common';
import { SavedAddressesController } from './saved-addresses.controller';
import { SavedAddressesService } from './saved-addresses.service';

// PrismaModule is @Global() so PrismaService is available without importing it here.
@Module({
  controllers: [SavedAddressesController],
  providers: [SavedAddressesService],
})
export class SavedAddressesModule {}
