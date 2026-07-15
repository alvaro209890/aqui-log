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
import { User } from '../database/entities/user.entity';
import { AccountStatus, UserRole } from '../database/enums';
import { CreateCompanyUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  findAll(current: AuthenticatedUser) {
    if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(current.role)) {
      return this.users.find({ order: { createdAt: 'DESC' }, take: 200 });
    }
    if (!current.companyId)
      throw new ForbiddenException('Usuario sem empresa vinculada');
    return this.users.find({
      where: { companyId: current.companyId },
      order: { name: 'ASC' },
    });
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
    return user;
  }
}
