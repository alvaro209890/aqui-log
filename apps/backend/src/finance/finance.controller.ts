import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { LedgerOwnerType, UserRole } from '../database/enums';
import { FinanceService } from './finance.service';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

@ApiTags('Financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  @Roles(...ADMIN_ROLES)
  summary() {
    return this.finance.summary();
  }

  /**
   * PAY-01 — extrato do ledger. Papéis de participante veem apenas a própria
   * carteira; admin/super admin podem consultar a de qualquer um pelos
   * parâmetros. Autorização: cliente não consulta carteira alheia.
   */
  @Get('statement')
  @Roles(UserRole.CUSTOMER, UserRole.COURIER, ...ADMIN_ROLES)
  statement(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('ownerType') ownerType?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    const user = req.user;
    if (user.role === UserRole.CUSTOMER || user.role === UserRole.COURIER) {
      return this.finance.resolveOwner(user.id, user.role).then((owner) => {
        // Papel de participante só enxerga a PRÓPRIA carteira: se tentou
        // consultar ownerType/ownerId de outra pessoa, 403 (DEC-05 §5).
        // `owner.ownerType` é um LedgerOwnerType e `ownerType` vem cru da query:
        // comparar como string mantém o eslint fora de uma comparação entre
        // tipos sem enum compartilhado, sem mudar a regra.
        if (
          ownerType &&
          ownerId &&
          (ownerType.toUpperCase() !== (owner.ownerType as string) ||
            ownerId !== owner.ownerId)
        ) {
          throw new ForbiddenException(
            'Participante so consulta a propria carteira',
          );
        }
        return this.finance.statement(owner.ownerType, owner.ownerId);
      });
    }
    if (!ownerType || !ownerId) {
      throw new BadRequestException(
        'Informe ownerType e ownerId para consultar',
      );
    }
    const type = ownerType.toUpperCase() as LedgerOwnerType;
    return this.finance.statement(type, ownerId);
  }

  /**
   * PAY-01 — ajuste administrativo auditado (crédito de teste / estorno).
   * Apenas admin/super admin, com motivo obrigatório e entrada na auditoria.
   */
  @Post('accounts/:ownerType/:ownerId/adjust')
  @Roles(...ADMIN_ROLES)
  adjust(
    @Req() req: Request & { user: AuthenticatedUser },
    @Param('ownerType') ownerType: string,
    @Param('ownerId') ownerId: string,
    @Body()
    body: {
      amountCents: number;
      reason: string;
      idempotencyKey?: string;
    },
  ) {
    return this.finance.adjust({
      actor: req.user,
      ownerType: ownerType.toUpperCase() as LedgerOwnerType,
      ownerId,
      amountCents: body.amountCents,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
    });
  }
}
