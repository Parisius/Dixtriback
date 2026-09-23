import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Order,
  OrderDocument,
  OrderChannel,
  OrderStatus,
  PaymentMethod,
  DiscountType,
} from './schemas/order.schema';
import { UnitsService } from '../units/units.service';
import { UnitOwnerType } from '../units/schemas/unit.schema';
import { CreateOrderDto, DiscountDto, OrderPaymentDto } from './dto/order.dto';
import { TenancyService } from '../tenancy/tenancy.service';
import { ShiftsService } from '../shifts/shifts.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { round2 } from '../common/utils/money';

const CREDIT_METHODS = [PaymentMethod.CREDIT, PaymentMethod.INSTALLMENT];

/** Discount currency amount for a base, clamped so a line/order can never go
 * negative or exceed its own value — a bad percentage/amount is rejected,
 * never silently clamped past that. */
function discountAmount(base: number, discount: DiscountDto | undefined | null): number {
  if (!discount) return 0;
  const amount =
    discount.type === DiscountType.PERCENT ? (base * discount.value) / 100 : discount.value;
  if (amount < 0 || amount > base + 0.01) {
    throw new BadRequestException(
      `Remise invalide : ${round2(amount)} dépasse le montant disponible (${round2(base)}).`,
    );
  }
  return round2(Math.min(amount, base));
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private unitsService: UnitsService,
    private tenancy: TenancyService,
    private shifts: ShiftsService,
  ) {}

  /**
   * Store/POS checkout. Cash/card/mobile money only — credit is exclusively
   * a Field Agent capability (locked decision), enforced here regardless of
   * what the caller sends. For each line, the requested quantity of
   * in-stock, serialized units is picked from the store's own stock and
   * marked sold, which is what actually decrements inventory.
   *
   * Supports a discount per line and/or on the whole order, and a split
   * payment (several payments whose amounts must sum to the final total).
   */
  async create(user: AuthUser, dto: CreateOrderDto) {
    const companyId = await this.tenancy.companyForCreate(user, dto.companyId);

    let subtotal = 0;
    let lineDiscountTotal = 0;
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
      const lineSubtotal = round2(line.quantity * line.unitPrice);
      const lineDiscount = discountAmount(lineSubtotal, line.discount);
      subtotal += lineSubtotal;
      lineDiscountTotal += lineDiscount;
      resolvedLines.push({
        ...line,
        unitIds,
        discountAmount: lineDiscount,
      });
    }
    subtotal = round2(subtotal);
    lineDiscountTotal = round2(lineDiscountTotal);

    const afterLineDiscount = round2(subtotal - lineDiscountTotal);
    const orderDiscount = discountAmount(afterLineDiscount, dto.discount);
    const discountTotal = round2(lineDiscountTotal + orderDiscount);
    const total = round2(afterLineDiscount - orderDiscount);

    this.validatePayments(dto.payments, total);

    const shiftId = await this.shifts.openShiftIdFor(companyId, dto.storeId);

    const order = new this.orderModel({
      channel: OrderChannel.STORE,
      companyId,
      storeId: dto.storeId,
      customerId: dto.customerId || null,
      cashierId: user.userId,
      shiftId,
      lines: resolvedLines,
      subtotal,
      discount: dto.discount ?? null,
      discountTotal,
      total,
      payments: dto.payments,
      status: OrderStatus.CONFIRMED,
    });
    return order.save();
  }

  private validatePayments(payments: OrderPaymentDto[], total: number) {
    if (!payments || payments.length === 0) {
      throw new BadRequestException('Au moins un paiement est requis.');
    }
    const credit = payments.find((p) => CREDIT_METHODS.includes(p.method));
    if (credit) {
      throw new BadRequestException(
        'Le crédit est réservé aux ventes agent terrain — la boutique est comptant/carte/mobile money uniquement.',
      );
    }
    const sum = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (Math.abs(sum - total) > 0.01) {
      throw new BadRequestException(
        `Le total des paiements (${sum}) ne correspond pas au total de la commande (${total}).`,
      );
    }
  }

  async findAll(user: AuthUser, query: {
    page?: number;
    limit?: number;
    companyId?: string;
    storeId?: string;
    customerId?: string;
    cashierId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter: Record<string, any> = {};
    if (query.storeId) filter.storeId = query.storeId;
    if (query.customerId) filter.customerId = query.customerId;
    if (query.cashierId) filter.cashierId = query.cashierId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) filter.createdAt.$gte = new Date(query.from);
      if (query.to) filter.createdAt.$lte = new Date(query.to);
    }
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
   * restocks every unit sold on this order back to the store, and stamps
   * `returnedAt` (used by the shift/cash-register reconciliation to know
   * exactly when the refund happened — a full return refunds the order's
   * payments exactly as they were originally taken). */
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
      order.returnedAt = new Date();
    }

    Object.assign(order, this.tenancy.stripImmutable(dto));
    return order.save();
  }
}
