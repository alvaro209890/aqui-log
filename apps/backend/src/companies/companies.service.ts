import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus } from '../database/enums';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    private readonly dataSource: DataSource,
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
      return company;
    });
  }
}
