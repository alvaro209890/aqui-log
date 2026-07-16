import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Company } from '../database/entities/company.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus, NotificationType } from '../database/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { parsePagination, toPageResult } from '../common/pagination';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(page?: string, limit?: string) {
    if (page != null || limit != null) {
      const p = parsePagination(page, limit);
      const [items, total] = await this.companies.findAndCount({
        order: { createdAt: 'DESC' },
        skip: p.skip,
        take: p.limit,
      });
      return toPageResult(items, total, p.page, p.limit);
    }
    return this.companies.find({ order: { createdAt: 'DESC' } });
  }

  async approve(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.ACTIVE,
      'COMPANY_APPROVED',
      actorId,
    );
  }

  async reject(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.REJECTED,
      'COMPANY_REJECTED',
      actorId,
    );
  }

  async suspend(id: string, actorId?: string) {
    return this.setStatus(
      id,
      AccountStatus.SUSPENDED,
      'COMPANY_SUSPENDED',
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
      const company = await manager.findOneBy(Company, { id });
      if (!company) throw new NotFoundException('Empresa nao encontrada');
      company.status = status;
      await manager.save(company);
      await manager.update(User, { companyId: id }, { status });
      const users = await manager.findBy(User, { companyId: id });
      const titles: Record<string, string> = {
        [AccountStatus.ACTIVE]: 'Empresa aprovada',
        [AccountStatus.REJECTED]: 'Cadastro recusado',
        [AccountStatus.SUSPENDED]: 'Conta suspensa',
      };
      const bodies: Record<string, string> = {
        [AccountStatus.ACTIVE]: 'Seu acesso a Aqui Log foi liberado.',
        [AccountStatus.REJECTED]: 'Seu cadastro de empresa foi recusado.',
        [AccountStatus.SUSPENDED]:
          'Sua empresa foi suspensa. Contate o suporte.',
      };
      await Promise.all(
        users.map((user) =>
          this.notifications.create({
            userId: user.id,
            type: NotificationType.ACCOUNT,
            title: titles[status] ?? 'Atualizacao de conta',
            body: bodies[status] ?? 'Status da conta atualizado.',
            data: { companyId: id, status },
          }),
        ),
      );
      await this.audit.record({
        actorId,
        action,
        resourceType: 'company',
        resourceId: id,
        metadata: { status },
      });
      return company;
    });
  }
}
