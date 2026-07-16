import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { parsePagination, toPageResult } from '../common/pagination';
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

  async findAll(page?: string, limit?: string) {
    if (page != null || limit != null) {
      const p = parsePagination(page, limit);
      const [items, total] = await this.couriers.findAndCount({
        order: { createdAt: 'DESC' },
        skip: p.skip,
        take: p.limit,
      });
      return toPageResult(items, total, p.page, p.limit);
    }
    return this.couriers.find({ order: { createdAt: 'DESC' } });
  }

  async approve(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.ACTIVE,
      'COURIER_APPROVED',
      actorId,
    );
  }

  async reject(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.REJECTED,
      'COURIER_REJECTED',
      actorId,
    );
  }

  async suspend(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.SUSPENDED,
      'COURIER_SUSPENDED',
      actorId,
    );
  }

  private async setStatus(
    id: string,
    status: AccountStatus,
    action: string,
    actorId?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const courier = await manager.findOneBy(Courier, { id });
      if (!courier) throw new NotFoundException('Entregador nao encontrado');
      courier.status = status;
      if (status !== AccountStatus.ACTIVE) courier.available = false;
      await manager.save(courier);
      await manager.update(User, { id: courier.userId }, { status });
      const titles: Record<string, string> = {
        [AccountStatus.ACTIVE]: 'Cadastro aprovado',
        [AccountStatus.REJECTED]: 'Cadastro recusado',
        [AccountStatus.SUSPENDED]: 'Conta suspensa',
      };
      const bodies: Record<string, string> = {
        [AccountStatus.ACTIVE]:
          'Voce ja pode ficar disponivel e receber corridas.',
        [AccountStatus.REJECTED]: 'Seu cadastro de entregador foi recusado.',
        [AccountStatus.SUSPENDED]: 'Sua conta foi suspensa. Contate o suporte.',
      };
      await this.notifications.create({
        userId: courier.userId,
        type: NotificationType.ACCOUNT,
        title: titles[status] ?? 'Atualizacao de conta',
        body: bodies[status] ?? 'Status da conta atualizado.',
        data: { courierId: courier.id, status },
      });
      await this.audit.record({
        actorId,
        action,
        resourceType: 'courier',
        resourceId: id,
        metadata: { status },
      });
      return courier;
    });
  }

  async setAvailability(userId: string, available: boolean) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    if (courier.status !== AccountStatus.ACTIVE && available) {
      throw new BadRequestException('Conta nao esta ativa');
    }
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
