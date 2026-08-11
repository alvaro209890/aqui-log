import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * PAY-01 — 402 Payment Required: criação de pedido sem saldo suficiente para
 * a reserva (produto pré-pago). O NestJS não exporta essa exceção, então a
 * definimos aqui seguindo o mesmo padrão das demais.
 */
export class PaymentRequiredException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, message },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
