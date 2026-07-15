import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { NotificationsService } from './notifications.service';

@ApiTags('Notificacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findMine(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.notifications.findForUser(req.user.id);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.notifications.markRead(id, req.user.id);
  }
}
