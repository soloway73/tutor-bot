import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { IdentifierNormalizationService } from './identifier-normalization.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UserService, IdentifierNormalizationService],
  exports: [UserService, IdentifierNormalizationService],
})
export class UserModule {}
