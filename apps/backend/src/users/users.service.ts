import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { parsePagination, toPageResult } from '../common/pagination';
import { User } from '../database/entities/user.entity';
import { AccountStatus, UserRole } from '../database/enums';
import { CreateCompanyUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  private sanitize(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll(current: AuthenticatedUser, page?: string, limit?: string) {
    const paginated = page != null || limit != null;
    const p = parsePagination(page, limit);

    if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(current.role)) {
      if (paginated) {
        const [items, total] = await this.users.findAndCount({
          order: { createdAt: 'DESC' },
          skip: p.skip,
          take: p.limit,
        });
        return toPageResult(
          items.map((u) => this.sanitize(u)),
          total,
          p.page,
          p.limit,
        );
      }
      const items = await this.users.find({
        order: { createdAt: 'DESC' },
        take: 200,
      });
      return items.map((u) => this.sanitize(u));
    }
    if (!current.companyId)
      throw new ForbiddenException('Usuario sem empresa vinculada');
    const items = await this.users.find({
      where: { companyId: current.companyId },
      order: { name: 'ASC' },
    });
    return items.map((u) => this.sanitize(u));
  }

  async createCompanyUser(
    dto: CreateCompanyUserDto,
    current: AuthenticatedUser,
  ) {
    if (!current.companyId)
      throw new ForbiddenException('Usuario sem empresa vinculada');
    const email = dto.email.toLowerCase();
    if (await this.users.findOneBy({ email }))
      throw new ConflictException('E-mail ja cadastrado');
    const user = await this.users.save(
      this.users.create({
        name: dto.name,
        email,
        passwordHash: await hash(dto.password, 12),
        role: UserRole.COMPANY_USER,
        status: AccountStatus.ACTIVE,
        companyId: current.companyId,
      }),
    );
    await this.audit.record({
      actorId: current.id,
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: user.id,
      metadata: { companyId: current.companyId, role: user.role },
    });
    return this.sanitize(user);
  }
}
