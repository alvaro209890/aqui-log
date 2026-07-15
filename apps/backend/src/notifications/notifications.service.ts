import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
import { NotificationType } from '../database/enums';

export interface CreateNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  create(input: CreateNotification) {
    return this.notifications.save(
      this.notifications.create({
        ...input,
        data: input.data ?? {},
        readAt: null,
      }),
    );
  }

  findForUser(userId: string) {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.notifications.findOneBy({ id, userId });
    if (!notification)
      throw new NotFoundException('Notificacao nao encontrada');
    notification.readAt = new Date();
    return this.notifications.save(notification);
  }
}
