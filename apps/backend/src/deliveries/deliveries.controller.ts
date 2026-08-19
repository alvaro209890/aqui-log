import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { UserRole } from '../database/enums';
import { DeliveriesService } from './deliveries.service';
import {
  AssignCourierDto,
  CreateDeliveryDto,
  PickupCodeOverrideDto,
  RateDeliveryDto,
  UpdateDeliveryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';

@ApiTags('Entregas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(
    @Body() dto: CreateDeliveryDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.create(dto, req.user);
  }

  @Get()
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query('status') status?: string,
    @Query('courier') courier?: string,
    @Query('date') date?: string,
    @Query('productType') productType?: string,
    @Query('packageSize') packageSize?: string,
    @Query('fulfillmentMode') fulfillmentMode?: string,
    @Query('weightMin') weightMin?: string,
    @Query('weightMax') weightMax?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deliveries.findAll(req.user, {
      status,
      courier,
      date,
      productType,
      packageSize,
      fulfillmentMode,
      weightMin,
      weightMax,
      customerId,
      page,
      limit,
    });
  }

  @Get('ratings')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  listRatings() {
    return this.deliveries.listRatings();
  }

  @Get('offers/mine')
  @Roles(UserRole.COURIER)
  findOffers(@Req() req: Request & { user: AuthenticatedUser }) {
    return this.deliveries.findOffers(req.user.id, req.user);
  }

  @Get(':id/history')
  history(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.history(id, req.user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.findOne(id, req.user);
  }

  @Patch(':id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignCourierDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.assign(id, dto, req.user.id);
  }

  @Post(':id/dispatch')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  dispatch(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    // DISP-01: o despacho manual do admin é a ação de recuperação do plano
    // §6.1.5 — ele reabre o ciclo de anéis mesmo depois de esgotado. Quem já
    // recusou continua excluído.
    return this.deliveries.dispatch(id, req.user.id, { reopen: true });
  }

  /**
   * DISP-02 / plano §6.1.5 — "tentar de novo" do cliente. Mesmo caminho de
   * recuperação do admin (`dispatch(..., { reopen: true })`), mas só o dono do
   * pedido pode chamar e só quando a busca esgotou (ou nunca começou).
   */
  @Post(':id/retry')
  @Roles(UserRole.CUSTOMER)
  retry(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.retry(id, req.user);
  }

  /**
   * DISP-02 / plano §6.1.5 — "editar" do pedido com busca esgotada. Campos
   * restritos (endereços, destinatário, telefone, observação, janelas do
   * agendado); nunca preço, peso, tipo, tamanho ou foto (`DEC-19`).
   */
  @Patch(':id')
  @Roles(UserRole.CUSTOMER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.updateDelivery(id, dto, req.user);
  }

  /**
   * DISP-02 / DEC-03 §3.3 — consentimento explícito do aumento de valor para
   * destravar a busca. Grava a trilha (evento + auditoria), reescreve o
   * snapshot do pedido e reabre a busca com o novo preço. Nunca silencioso.
   */
  @Post(':id/price-boost/consent')
  @Roles(UserRole.CUSTOMER)
  consentPriceBoost(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.consentPriceBoost(id, req.user);
  }

  @Patch('offers/:offerId/accept')
  @Roles(UserRole.COURIER)
  acceptOffer(
    @Param('offerId') offerId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.acceptOffer(offerId, req.user);
  }

  @Patch('offers/:offerId/reject')
  @Roles(UserRole.COURIER)
  rejectOffer(
    @Param('offerId') offerId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.rejectOffer(offerId, req.user);
  }

  /**
   * COUR-02 / DEC-22 — desistência do prestador com débito da taxa congelada.
   * O pedido volta a `REQUESTED` e reentra na busca; não é cancelamento do
   * cliente (`PATCH .../status CANCELED`).
   */
  @Post(':id/courier-cancel')
  @Roles(UserRole.COURIER)
  cancelByCourier(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.cancelByCourier(id, req.user);
  }

  /**
   * PICK-01 / DEC-24: fallback de código perdido ou ilegível. Só admin/suporte,
   * com motivo obrigatório e auditoria; não avança o status sozinho.
   */
  @Post(':id/pickup-code/override')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  overridePickupCode(
    @Param('id') id: string,
    @Body() dto: PickupCodeOverrideDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.overridePickupCode(id, dto, req.user);
  }

  @Patch(':id/status')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.COURIER,
    UserRole.CUSTOMER,
  )
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.updateStatus(id, dto, req.user);
  }

  @Post(':id/rating')
  @Roles(UserRole.CUSTOMER)
  rate(
    @Param('id') id: string,
    @Body() dto: RateDeliveryDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.deliveries.rate(id, dto, req.user);
  }
}
