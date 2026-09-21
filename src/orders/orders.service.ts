import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderChannel, OrderStatus, PaymentMethod } from './schemas/order.schema';
import { UnitsService } from '../units/units.service';
import { UnitOwnerType } from '../units/schemas/unit.schema';
import { CreateOrderDto } from './dto/order.dto';
import { TenancyService } from '../tenancy/tenancy.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const CREDIT_METHODS = [PaymentMethod.CREDIT, PaymentMethod.INSTALLMENT];

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private unitsService: UnitsService,
    private tenancy: TenancyService,
  ) {}

  /**
   * Store/POS checkout. Cash/card/mobile money only — credit is exclusively
   * a Field Agent capability (locked decision), enforced here regardless of
   * what the caller sends. For each line, the requested quantity of
   * in-stock, serialized units is picked from the store's own stock and
   * marked sold, which is what actually decrements inventory.
   */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);
    if (CREDIT_METHODS.includes(dto.paymentMethod)) {
      throw new BadRequestException(
        'Le crédit est réservé aux ventes agent terrain — la boutique est comptant/carte/mobile money uniquement.',
      );
    }

    let total = 0;
    const resolvedLines: Record<string, any>[] = [];

    for (const line of dto.lines) {
      // Stock is only picked from units of THIS company: a store id belonging
      // to another company simply has no matching units.
      const available = await this.unitsService.findAvailable(
        companyId,
        UnitOwnerType.STORE,
        dto.storeId,
        line.productId,
        line.quantity,
      );
      if (available.length < line.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour le produit ${line.productId} (${available.length}/${line.quantity} disponibles).`,
        );
      }
      const unitIds: string[] = [];
      for (const unit of available) {
        await this.unitsService.move(unit.id, UnitOwnerType.SOLD, dto.customerId || 'walk-in');
        unitIds.push(unit.id);
      }
      resolvedLines.push({ ...line, unitIds });
      total += line.quantity * line.unitPrice;
    }

    const order = new this.orderModel({
      channel: OrderChannel.STORE,
      companyId,
      storeId: dto.storeId,
      customerId: dto.customerId || null,
      lines: resolvedLines,
      total,
      paymentMethod: dto.paymentMethod,
      status: OrderStatus.CONFIRMED,
    });
    return order.save();
  }

  async findAll(user: AuthUser, query: {
    page?: number;
    limit?: number;
    companyId?: string;
    storeId?: string;
    customerId?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.storeId) filter.storeId = query.storeId;
    if (query.customerId) filter.customerId = query.customerId;
    Object.assign(filter, await this.tenancy.companyFilter(user, query.companyId));

    const [data, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort('-createdAt')
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit };
  }

  async findById(user: AuthUser, id: string) {
    const order = await this.orderModel.findById(id).exec();
    return this.tenancy.assertOwns(user, order, 'Commande introuvable');
  }

  /** Handles both generic edits and returns. Setting status to 'returned'
   * restocks every unit sold on this order back to the store. */
  async update(user: AuthUser, id: string, dto: Record<string, any>) {
    const order = await this.findById(user, id);

    if (dto.status === OrderStatus.RETURNED && order.status !== OrderStatus.RETURNED) {
      for (const line of order.lines) {
        for (const unitId of line.unitIds || []) {
          await this.unitsService.move(
            unitId,
            UnitOwnerType.STORE,
            order.storeId!.toString(),
            'retour client',
          );
        }
      }
    }

    Object.assign(order, this.tenancy.stripImmutable(dto));
    return order.save();
  }
}
