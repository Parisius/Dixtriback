import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenancyService } from './tenancy.service';
import { Company, CompanySchema } from '../companies/schemas/company.schema';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }])],
  providers: [TenancyService],
  exports: [TenancyService],
})
export class TenancyModule {}
