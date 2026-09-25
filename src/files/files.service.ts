import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { FileAsset, FileAssetDocument, OwnerType } from './schemas/file-asset.schema';
import { detectType } from './file-types';
import { StorageService } from '../storage/storage.service';
import { TenancyService } from '../tenancy/tenancy.service';
import { CustomRolesService } from '../custom-roles/custom-roles.service';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Store, StoreDocument } from '../stores/schemas/store.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/constants/roles.enum';
import { AuthUser } from '../common/decorators/current-user.decorator';

const MAX_FILES_PER_OWNER = 20;

/** Who may attach/remove files on each kind of owner: the fixed roles that can
 * edit that entity, or a custom role holding the matching permission. */
const OWNER_EDIT_RULES: Record<string, { roles: Role[]; permission: string }> = {
  [OwnerType.PRODUCT]: { roles: [Role.SUPER_ADMIN, Role.ADMIN], permission: 'products.update' },
  [OwnerType.STORE]: { roles: [Role.SUPER_ADMIN, Role.ADMIN, Role.SHOP_MANAGER], permission: 'stores.update' },
  [OwnerType.COMPANY]: { roles: [Role.SUPER_ADMIN, Role.ADMIN], permission: 'companies.update' },
  [OwnerType.USER]: { roles: [Role.SUPER_ADMIN, Role.ADMIN], permission: 'users.update' },
  none: { roles: [Role.SUPER_ADMIN, Role.ADMIN], permission: 'files.delete' },
};

export interface FileView {
  _id: string;
  companyId: string | null;
  originalName: string;
  contentType: string;
  size: number;
  kind: string;
  ownerType: string | null;
  ownerId: string | null;
  purpose: string | null;
  isPublic: boolean;
  uploadedBy: string;
  createdAt: Date;
  /** Direct URL — only for public files (product images); null for private ones (use /link or /content). */
  url: string | null;
}

@Injectable()
export class FilesService {
  private readonly apiPrefix: string;
  private readonly configuredBaseUrl: string;
  private readonly defaultLinkTtl: number;
  private readonly signingKey: Buffer;

  constructor(
    @InjectModel(FileAsset.name) private fileModel: Model<FileAssetDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Store.name) private storeModel: Model<StoreDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private storage: StorageService,
    private tenancy: TenancyService,
    private customRoles: CustomRolesService,
    config: ConfigService,
  ) {
    this.apiPrefix = config.get<string>('apiPrefix')!;
    this.configuredBaseUrl = config.get<string>('files.publicBaseUrl') || '';
    this.defaultLinkTtl = config.get<number>('files.linkTtlSeconds') || 300;
    // Separate key for file links, derived from (not equal to) the JWT secret.
    this.signingKey = crypto
      .createHash('sha256')
      .update('file-link:' + config.get<string>('jwt.accessSecret'))
      .digest();
  }

  // ---- helpers -------------------------------------------------------------

  private publicUrl(id: string, requestBase: string): string {
    return `${this.configuredBaseUrl || requestBase}/${this.apiPrefix}/files/${id}/public`;
  }

  private view(a: any, requestBase: string): FileView {
    return {
      _id: String(a._id),
      companyId: a.companyId ?? null,
      originalName: a.originalName,
      contentType: a.contentType,
      size: a.size,
      kind: a.kind,
      ownerType: a.ownerType ?? null,
      ownerId: a.ownerId ?? null,
      purpose: a.purpose ?? null,
      isPublic: !!a.isPublic,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      url: a.isPublic ? this.publicUrl(String(a._id), requestBase) : null,
    };
  }

  private async load(id: string): Promise<FileAssetDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Fichier introuvable');
    const asset = await this.fileModel.findById(id).exec();
    if (!asset) throw new NotFoundException('Fichier introuvable');
    return asset;
  }

  /** Company files: the caller's company scope. Company-less files: only their uploader. */
  private async canAccess(user: AuthUser, asset: FileAssetDocument): Promise<boolean> {
    if (asset.companyId) {
      return (await this.tenancy.allowedCompanyIds(user)).includes(asset.companyId);
    }
    return asset.uploadedBy === user.userId;
  }

  private async loadAccessible(user: AuthUser, id: string): Promise<FileAssetDocument> {
    const asset = await this.load(id);
    if (!(await this.canAccess(user, asset))) throw new NotFoundException('Fichier introuvable');
    return asset;
  }

  private async mayEdit(user: AuthUser, ownerType: string | null): Promise<boolean> {
    const rule = OWNER_EDIT_RULES[ownerType ?? 'none'];
    if (rule.roles.includes(user.role as Role)) return true;
    return user.role === Role.CUSTOM && (await this.customRoles.userHasPermission(user, rule.permission));
  }

  private sanitizeName(raw: string): string {
    // multer hands the name over as latin1; recover the real UTF-8.
    let name = Buffer.from(raw || 'fichier', 'latin1').toString('utf8');
    name = name.replace(/[\\/]+/g, '_').replace(/[\u0000-\u001f\u007f"]/g, '').trim();
    return (name || 'fichier').slice(0, 200);
  }

  /** Validates the owner and returns the company the file belongs to. */
  private async resolveOwner(user: AuthUser, ownerType: OwnerType, ownerId: string): Promise<string | null> {
    if (!Types.ObjectId.isValid(ownerId)) throw new NotFoundException('Propriétaire introuvable');

    if (ownerType === OwnerType.USER) {
      const target = await this.userModel.findById(ownerId).exec();
      if (!target) throw new NotFoundException('Utilisateur introuvable');
      const self = target.id === user.userId;
      if (!self) {
        if (!(await this.mayEdit(user, OwnerType.USER))) {
          throw new ForbiddenException("Seul un admin peut modifier la photo d'un autre utilisateur.");
        }
        await this.tenancy.assertOwns(user, target, 'Utilisateur introuvable');
      }
      return target.companyId ? String(target.companyId) : null;
    }

    if (!(await this.mayEdit(user, ownerType))) {
      throw new ForbiddenException(`Ce rôle ne peut pas ajouter de fichier à cet élément (${ownerType}).`);
    }
    if (ownerType === OwnerType.PRODUCT) {
      const p = await this.productModel.findById(ownerId).exec();
      await this.tenancy.assertOwns(user, p, 'Produit introuvable');
      return String(p!.companyId);
    }
    if (ownerType === OwnerType.STORE) {
      const s = await this.storeModel.findById(ownerId).exec();
      await this.tenancy.assertOwns(user, s, 'Boutique introuvable');
      return String(s!.companyId);
    }
    // company
    return this.tenancy.assertCompany(user, ownerId);
  }

  // ---- upload --------------------------------------------------------------

  async upload(
    user: AuthUser,
    file: Express.Multer.File | undefined,
    dto: { ownerType?: OwnerType; ownerId?: string; companyId?: string; purpose?: string },
    requestBase: string,
  ): Promise<FileView> {
    if (!file) throw new BadRequestException('Aucun fichier reçu (champ multipart "file").');
    if (!file.size) throw new BadRequestException('Le fichier est vide.');
    if (!!dto.ownerType !== !!dto.ownerId) {
      throw new BadRequestException('ownerType et ownerId vont ensemble.');
    }

    const originalName = this.sanitizeName(file.originalname);
    const detected = detectType(file.buffer, file.mimetype, originalName);
    if (!detected) {
      throw new UnsupportedMediaTypeException(
        'Type de fichier non autorisé. Acceptés : images (jpg, png, webp, gif), PDF, Word/Excel/PowerPoint, txt, csv.',
      );
    }

    let companyId: string | null;
    if (dto.ownerType && dto.ownerId) {
      companyId = await this.resolveOwner(user, dto.ownerType, dto.ownerId);
      if (dto.companyId && companyId && dto.companyId !== companyId) {
        throw new BadRequestException("companyId ne correspond pas à l'entreprise du propriétaire.");
      }
      const existing = await this.fileModel.countDocuments({ ownerType: dto.ownerType, ownerId: dto.ownerId }).exec();
      if (existing >= MAX_FILES_PER_OWNER) {
        throw new ConflictException(`Maximum ${MAX_FILES_PER_OWNER} fichiers par élément.`);
      }
    } else {
      companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    }

    const isPublic = dto.ownerType === OwnerType.PRODUCT && detected.kind === 'image';
    const key = this.storage.buildKey(
      `${companyId ?? 'platform'}/${dto.ownerType ?? 'misc'}/${crypto.randomUUID()}.${detected.ext}`,
    );

    await this.storage.put(key, file.buffer, detected.mime);

    let asset: FileAssetDocument;
    try {
      asset = await new this.fileModel({
        companyId,
        key,
        originalName,
        contentType: detected.mime,
        size: file.size,
        kind: detected.kind,
        ownerType: dto.ownerType ?? null,
        ownerId: dto.ownerId ?? null,
        purpose: dto.purpose ?? null,
        isPublic,
        uploadedBy: user.userId,
      }).save();
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined); // don't orphan the bytes
      throw err;
    }

    if (isPublic && dto.ownerId) {
      await this.productModel
        .updateOne({ _id: dto.ownerId }, { $addToSet: { media: this.publicUrl(asset.id, requestBase) } })
        .exec();
    }
    return this.view(asset, requestBase);
  }

  // ---- reads ---------------------------------------------------------------

  async findAll(
    user: AuthUser,
    q: { page?: number; limit?: number; companyId?: string; ownerType?: string; ownerId?: string; kind?: string; purpose?: string },
    requestBase: string,
  ) {
    const page = Math.max(Number(q.page) || 1, 1);
    const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
    const scope = await this.tenancy.companyFilter(user, q.companyId);
    const conditions: Record<string, any>[] = [
      q.companyId ? scope : { $or: [scope, { companyId: null, uploadedBy: user.userId }] },
    ];
    const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    if (s(q.ownerType)) conditions.push({ ownerType: s(q.ownerType) });
    if (s(q.ownerId)) conditions.push({ ownerId: s(q.ownerId) });
    if (s(q.kind)) conditions.push({ kind: s(q.kind) });
    if (s(q.purpose)) conditions.push({ purpose: s(q.purpose) });
    const filter = { $and: conditions };

    const [rows, total] = await Promise.all([
      this.fileModel.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit).lean().exec(),
      this.fileModel.countDocuments(filter).exec(),
    ]);
    return { data: rows.map((r) => this.view(r, requestBase)), total, page, limit };
  }

  async findById(user: AuthUser, id: string, requestBase: string) {
    return this.view(await this.loadAccessible(user, id), requestBase);
  }

  // ---- serving -------------------------------------------------------------

  private async stream(asset: FileAssetDocument, inline: boolean, cache: string): Promise<{ file: StreamableFile; headers: Record<string, string> }> {
    const obj = await this.storage.get(asset.key);
    if (!obj) throw new NotFoundException('Fichier introuvable dans le stockage');
    const ascii = asset.originalName.replace(/[^\x20-\x7e]/g, '_');
    const disposition = `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`;
    return {
      file: new StreamableFile(obj.body, { type: asset.contentType, disposition, length: obj.length }),
      headers: {
        'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff',
        // even if a browser mis-sniffs, nothing here may run script or load anything
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    };
  }

  /** Anonymous access — only files flagged public (product images), of active products. */
  async publicContent(id: string) {
    const asset = await this.load(id);
    if (!asset.isPublic) throw new NotFoundException('Fichier introuvable');
    if (asset.ownerType === OwnerType.PRODUCT && asset.ownerId) {
      const product = await this.productModel.findById(asset.ownerId).select('isActive').lean().exec();
      if (!product || product.isActive === false) throw new NotFoundException('Fichier introuvable');
    }
    return this.stream(asset, true, 'public, max-age=3600');
  }

  /** Logged-in access (company-scoped) or a valid short-lived signed link. */
  async content(user: AuthUser | null, id: string, exp?: string, sig?: string) {
    const asset = await this.load(id);
    if (user) {
      if (!(await this.canAccess(user, asset))) throw new NotFoundException('Fichier introuvable');
    } else if (!this.validSignature(id, exp, sig)) {
      throw new UnauthorizedException('Lien invalide ou expiré.');
    }
    return this.stream(asset, asset.kind === 'image', 'private, max-age=300');
  }

  // ---- signed links --------------------------------------------------------

  private sign(id: string, exp: number): string {
    return crypto.createHmac('sha256', this.signingKey).update(`file:${id}:${exp}`).digest('hex');
  }

  private validSignature(id: string, exp?: string, sig?: string): boolean {
    const expNum = Number(exp);
    if (!exp || !sig || typeof sig !== 'string' || !Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(id, expNum));
    const given = Buffer.from(sig);
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  }

  async link(user: AuthUser, id: string, ttl: number | undefined, requestBase: string) {
    const asset = await this.loadAccessible(user, id);
    if (asset.isPublic) return { url: this.publicUrl(asset.id, requestBase), expiresAt: null };
    const seconds = Math.min(Math.max(Number(ttl) || this.defaultLinkTtl, 30), 3600);
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const base = this.configuredBaseUrl || requestBase;
    return {
      url: `${base}/${this.apiPrefix}/files/${asset.id}/content?exp=${exp}&sig=${this.sign(asset.id, exp)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  // ---- delete --------------------------------------------------------------

  async remove(user: AuthUser, id: string) {
    const asset = await this.loadAccessible(user, id);
    if (asset.uploadedBy !== user.userId && !(await this.mayEdit(user, asset.ownerType))) {
      throw new ForbiddenException("Vous ne pouvez pas supprimer ce fichier.");
    }
    await this.storage.delete(asset.key);
    await asset.deleteOne();
    if (asset.isPublic && asset.ownerType === OwnerType.PRODUCT && asset.ownerId) {
      await this.productModel
        .updateOne({ _id: asset.ownerId }, { $pull: { media: { $regex: `/files/${asset.id}/public$` } } })
        .exec();
    }
  }
}
