import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SegmentsService } from './segments.service';
import { CreateSegmentDto, UpdateSegmentDto } from './dto/segment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('CRM')
@ApiBearerAuth()
@Controller('segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Post()
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer un segment basé sur des règles' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSegmentDto) {
    return this.segmentsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les segments' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.segmentsService.findAll(user, page, limit, companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un segment" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.segmentsService.findById(user, id);
  }

  @Put(':id')
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un segment' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSegmentDto) {
    return this.segmentsService.update(user, id, dto);
  }

  @Get(':id/customers')
  @ApiOperation({ summary: "Lister les clients membres d'un segment" })
  members(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.segmentsService.members(user, id, page, limit);
  }

  @Post(':id/recompute')
  @Roles(Role.MARKETING_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: "Recalculer l'appartenance au segment selon ses règles" })
  recompute(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.segmentsService.recompute(user, id);
  }
}
