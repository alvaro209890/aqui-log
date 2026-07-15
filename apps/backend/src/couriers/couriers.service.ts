import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Courier } from '../database/entities/courier.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus, NotificationType } from '../database/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CouriersService {
  constructor(
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll() {
    return this.couriers.find({ order: { createdAt: 'DESC' } });
  }

  async approve(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const courier = await manager.findOneBy(Courier, { id });
      if (!courier) throw new NotFoundException('Entregador nao encontrado');
      courier.status = AccountStatus.ACTIVE;
      await manager.save(courier);
      await manager.update(
        User,
        { id: courier.userId },
        { status: AccountStatus.ACTIVE },
      );
      await this.notifications.create({
        userId: courier.userId,
        type: NotificationType.ACCOUNT,
        title: 'Cadastro aprovado',
        body: 'Voce ja pode ficar disponivel e receber corridas.',
        data: { courierId: courier.id },
      });
      await this.audit.record({
        action: 'COURIER_APPROVED',
        resourceType: 'courier',
        resourceId: id,
      });
      return courier;
    });
  }

  async setAvailability(userId: string, available: boolean) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    courier.available = available;
    return this.couriers.save(courier);
  }

  async updateLocation(userId: string, latitude: number, longitude: number) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    courier.lastLatitude = latitude;
    courier.lastLongitude = longitude;
    return this.couriers.save(courier);
  }
}
