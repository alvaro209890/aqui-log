import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Company } from '../database/entities/company.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus, NotificationType } from '../database/enums';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  findAll() {
    return this.companies.find({ order: { createdAt: 'DESC' } });
  }

  async approve(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const company = await manager.findOneBy(Company, { id });
      if (!company) throw new NotFoundException('Empresa nao encontrada');
      company.status = AccountStatus.ACTIVE;
      await manager.save(company);
      await manager.update(
        User,
        { companyId: id },
        { status: AccountStatus.ACTIVE },
      );
      const users = await manager.findBy(User, { companyId: id });
      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            userId: user.id,
            type: NotificationType.ACCOUNT,
            title: 'Empresa aprovada',
            body: 'Seu acesso a Aqui Log foi liberado.',
            data: { companyId: id },
          }),
        ),
      );
      await this.audit.record({
        action: 'COMPANY_APPROVED',
        resourceType: 'company',
        resourceId: id,
      });
      return company;
    });
  }
}
