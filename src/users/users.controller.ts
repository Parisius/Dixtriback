import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/constants/roles.enum';
import { RequirePermission } from '../common/decorators/permission.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('users.create')
  @ApiOperation({ summary: 'Créer un utilisateur (staff, tous rôles)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.usersService.createScoped(user, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.DIRECTOR)
  @RequirePermission('users.read')
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
  ) {
    return this.usersService.findAllScoped(user, { page, limit, companyId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un utilisateur par id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.findByIdScoped(user, id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('users.update')
  @ApiOperation({ summary: 'Mettre à jour un utilisateur' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateScoped(user, id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @RequirePermission('users.delete')
  @ApiOperation({ summary: 'Désactiver un utilisateur (soft delete)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.removeScoped(user, id);
  }
}
