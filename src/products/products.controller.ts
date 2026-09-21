import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Créer un produit' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user, dto);
  }

  @Get()
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lister / rechercher les produits',
    description:
      "Vitrine e-commerce (visiteur ou client, sans connexion) : les produits actifs de toutes les " +
      "entreprises. Personnel connecté : uniquement les produits de sa propre entreprise " +
      "(super admin : toutes les entreprises).",
  })
  findAll(
    @CurrentUser() user: AuthUser | null,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: string,
    @Query('q') q?: string,
  ) {
    return this.productsService.findAll(user, { page, limit, companyId, q });
  }

  @Get(':id')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Consulter le détail d'un produit (produit actif pour la vitrine)" })
  findOne(@CurrentUser() user: AuthUser | null, @Param('id') id: string) {
    return this.productsService.findById(user, id);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un produit' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver un produit' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.productsService.remove(user, id);
  }
}
