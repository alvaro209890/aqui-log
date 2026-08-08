import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { parsePagination, toPageResult } from '../common/pagination';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private sanitize(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async findAll(current: AuthenticatedUser, page?: string, limit?: string) {
    const paginated = page != null || limit != null;
    const p = parsePagination(page, limit);

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
}
