export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  COURIER = 'COURIER',
  CUSTOMER = 'CUSTOMER',
  SUPPORT = 'SUPPORT',
}

export enum AccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
}

export enum DeliveryStatus {
  REQUESTED = 'REQUESTED',
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  AT_PICKUP = 'AT_PICKUP',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
  CANCELED = 'CANCELED',
}

export enum VehicleType {
  MOTORCYCLE = 'MOTORCYCLE',
  CAR = 'CAR',
  BICYCLE = 'BICYCLE',
  VAN = 'VAN',
}

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELED = 'CANCELED',
}

export enum NotificationType {
  DELIVERY = 'DELIVERY',
  ACCOUNT = 'ACCOUNT',
  FINANCE = 'FINANCE',
  SYSTEM = 'SYSTEM',
}

export enum TransactionType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
  PAYOUT = 'PAYOUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

/** PAY-01 — dono de uma conta do ledger (participante ou a própria plataforma). */
export enum LedgerOwnerType {
  CUSTOMER = 'CUSTOMER',
  COURIER = 'COURIER',
  PLATFORM = 'PLATFORM',
}

/**
 * PAY-01 — propósito da conta. `AVAILABLE` é o saldo utilizável; `RESERVED`
 * é o valor bloqueado do cliente enquanto o pedido está aberto (partida dupla:
 * reservar move `AVAILABLE → RESERVED`, sem nunca criar dinheiro).
 */
export enum LedgerAccountPurpose {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
}

/** PAY-01 — estado da conta do ledger. */
export enum LedgerAccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
}

/** PAY-01 — direção do lançamento em relação à conta (o valor é sempre positivo). */
export enum LedgerEntryDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

/**
 * PAY-01 — tipo da transação lógica do ledger. Cada operação de domínio gera
 * uma transação com partidas balanceadas (soma dos valores = zero).
 */
export enum LedgerTransactionType {
  ADJUSTMENT = 'ADJUSTMENT',
  RESERVATION = 'RESERVATION',
  RESERVATION_RELEASE = 'RESERVATION_RELEASE',
  SETTLEMENT = 'SETTLEMENT',
  COURIER_CANCEL_FEE = 'COURIER_CANCEL_FEE',
}

/**
 * PAY-01 — estado da transação. Segue a máquina da reserva do plano §4.1:
 * `RESERVED → SETTLED | RELEASED`. Transações sem estado de reserva (ajuste,
 * liberação, liquidação) nascem `COMPLETED`.
 */
export enum LedgerTransactionStatus {
  RESERVED = 'RESERVED',
  SETTLED = 'SETTLED',
  RELEASED = 'RELEASED',
  COMPLETED = 'COMPLETED',
}
