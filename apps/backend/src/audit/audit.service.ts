import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parsePagination, toPageResult } from '../common/pagination';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
  ) {}

  record(entry: AuditEntry) {
    return this.logs.save(
      this.logs.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata ?? {},
      }),
    );
  }

  findRecent(limit = 100) {
    return this.logs.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async findPage(page?: string, limit?: string) {
    const p = parsePagination(page, limit, {
      page: 1,
      limit: 50,
      maxLimit: 200,
    });
    const [items, total] = await this.logs.findAndCount({
      order: { createdAt: 'DESC' },
      skip: p.skip,
      take: p.limit,
    });
    return toPageResult(items, total, p.page, p.limit);
  }
}
