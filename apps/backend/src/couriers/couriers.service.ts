import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Courier } from '../database/entities/courier.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus } from '../database/enums';

@Injectable()
export class CouriersService {
  constructor(
    @InjectRepository(Courier) private readonly couriers: Repository<Courier>,
    private readonly dataSource: DataSource,
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
      return courier;
    });
  }

  async setAvailability(userId: string, available: boolean) {
    const courier = await this.couriers.findOneBy({ userId });
    if (!courier) throw new NotFoundException('Entregador nao encontrado');
    courier.available = available;
    return this.couriers.save(courier);
  }
}
