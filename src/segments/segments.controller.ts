import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SegmentsService } from './segments.service';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/segment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Post()
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer un segment basé sur des règles' })
  create(@Body() dto: CreateSegmentDto) {
    return this.segmentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les segments' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.segmentsService.findAll(page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un segment" })
  findOne(@Param('id') id: string) {
    return this.segmentsService.findById(id);
  }

  @Put(':id')
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un segment' })
  update(@Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.segmentsService.update(id, dto);
  }

  @Get(':id/customers')
  @ApiOperation({ summary: "Lister les clients membres d'un segment" })
  members(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.segmentsService.members(id, page, limit);
  }

  @Post(':id/recompute')
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Recalculer l'appartenance au segment selon ses règles" })
  recompute(@Param('id') id: string) {
    return this.segmentsService.recompute(id);
  }
}
