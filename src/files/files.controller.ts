import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/file.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/permission.decorator';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { Role } from '../common/constants/roles.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

/** Read once at load: the multer limit must be static at decoration time. */
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || String(10 * 1024 * 1024), 10);

/** Every active staff role may upload; WHAT they may attach a file to is decided per owner type in the service. */
const STAFF = [
  Role.SUPER_ADMIN, Role.ADMIN, Role.DIRECTOR, Role.FINANCIAL_MANAGER, Role.ACCOUNTANT, Role.SALES_MANAGER,
  Role.MARKETING_MANAGER, Role.WAREHOUSE_MANAGER, Role.REGIONAL_SUPERVISOR, Role.SHOP_MANAGER, Role.CASHIER,
];

const baseUrl = (req: Request) => `${req.protocol}://${req.get('host')}`;

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(...STAFF)
  @RequirePermission('files.upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image (jpg/png/webp/gif), PDF, Word/Excel/PowerPoint, txt ou csv' },
        ownerType: { type: 'string', enum: ['product', 'store', 'company', 'user'] },
        ownerId: { type: 'string' },
        companyId: { type: 'string' },
        purpose: { type: 'string', example: 'logo' },
      },
    },
  })
  @ApiOperation({
    summary: 'Téléverser un fichier (image ou document)',
    description:
      "Un seul endpoint pour tout : photo de produit, logo de boutique/entreprise, avatar, document. " +
      "Rattachez-le avec `ownerType` + `ownerId` (l'entreprise en est déduite). Les images de produit sont " +
      "publiques (champ `url`, ajoutée à `product.media`) ; tout le reste est privé à l'entreprise. Le type " +
      "réel est vérifié sur le contenu ; taille max 10 Mo par défaut.",
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10, fieldSize: 2048 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Req() req: Request,
  ) {
    return this.filesService.upload(user, file, dto, baseUrl(req));
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les fichiers (filtrables par propriétaire, type, libellé)' })
  @ApiQuery({ name: 'ownerType', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: ['image', 'document'] })
  @ApiQuery({ name: 'purpose', required: false })
  findAll(@CurrentUser() user: AuthUser, @Query() query: Record<string, any>, @Req() req: Request) {
    return this.filesService.findAll(user, query, baseUrl(req));
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Métadonnées d'un fichier" })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.filesService.findById(user, id, baseUrl(req));
  }

  @Public()
  @Get(':id/public')
  @ApiOperation({
    summary: "Contenu d'un fichier public (image de produit) — sans connexion",
    description: "404 pour tout fichier non public ou dont le produit est désactivé.",
  })
  async publicContent(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { file, headers } = await this.filesService.publicContent(id);
    res.set(headers);
    return file;
  }

  @Get(':id/content')
  @OptionalAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Contenu d'un fichier privé",
    description:
      "Avec un jeton (accès limité à son entreprise), ou sans jeton mais avec un lien signé `?exp=&sig=` obtenu via `/link` — " +
      "pratique pour un `<img src>`.",
  })
  @ApiQuery({ name: 'exp', required: false })
  @ApiQuery({ name: 'sig', required: false })
  async content(
    @CurrentUser() user: AuthUser | null,
    @Param('id') id: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { file, headers } = await this.filesService.content(user, id, exp, sig);
    res.set(headers);
    return file;
  }

  @Get(':id/link')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lien temporaire vers un fichier privé',
    description: "Renvoie une URL signée valable `ttl` secondes (30–3600, 300 par défaut). Pour un fichier public, renvoie son URL publique.",
  })
  @ApiQuery({ name: 'ttl', required: false })
  link(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('ttl') ttl: string | undefined, @Req() req: Request) {
    return this.filesService.link(user, id, ttl ? Number(ttl) : undefined, baseUrl(req));
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(...STAFF)
  @RequirePermission('files.delete')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Supprimer un fichier',
    description: "Par son auteur, ou par un rôle autorisé à modifier l'élément auquel il est rattaché. Retire aussi l'image de `product.media`.",
  })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.filesService.remove(user, id);
  }
}
