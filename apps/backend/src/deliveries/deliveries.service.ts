import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Courier } from '../database/entities/courier.entity';
import { Delivery } from '../database/entities/delivery.entity';
import { DeliveryStatus, UserRole } from '../database/enums';
import {
  AssignCourierDto,
  CreateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private readonly deliveries: Repository<Delivery>,
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
  ) {}

  async create(dto: CreateDeliveryDto, user: AuthenticatedUser) {
    if (!user.companyId)
      throw new ForbiddenException('Usuario sem empresa vinculada');
    return this.deliveries.save(
      this.deliveries.create({
        ...dto,
        companyId: user.companyId,
        createdById: user.id,
        courierId: null,
        notes: dto.notes ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        priceCents: dto.priceCents ?? 0,
      }),
    );
  }

  async findAll(user: AuthenticatedUser) {
    if (
      [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT].includes(
        user.role,
      )
    ) {
      return this.deliveries.find({ order: { createdAt: 'DESC' } });
    }
    if (user.companyId) {
      return this.deliveries.find({
        where: { companyId: user.companyId },
        order: { createdAt: 'DESC' },
      });
    }
    const courier = await this.couriers.findOneBy({ userId: user.id });
    return courier
      ? this.deliveries.find({
          where: { courierId: courier.id },
          order: { createdAt: 'DESC' },
        })
      : [];
  }

  async assign(id: string, dto: AssignCourierDto) {
    const delivery = await this.getById(id);
    delivery.courierId = dto.courierId;
    delivery.status = DeliveryStatus.OFFERED;
    return this.deliveries.save(delivery);
  }

  async updateStatus(id: string, dto: UpdateDeliveryStatusDto) {
    const delivery = await this.getById(id);
    delivery.status = dto.status;
    if (dto.status === DeliveryStatus.ACCEPTED)
      delivery.acceptedAt = new Date();
    if (dto.status === DeliveryStatus.DELIVERED)
      delivery.deliveredAt = new Date();
    if (dto.proofUrl) delivery.proofUrl = dto.proofUrl;
    return this.deliveries.save(delivery);
  }

  private async getById(id: string) {
    const delivery = await this.deliveries.findOneBy({ id });
    if (!delivery) throw new NotFoundException('Entrega nao encontrada');
    return delivery;
  }
}
