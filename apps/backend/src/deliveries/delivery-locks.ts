/** Acquire lock key helpers for delivery offer concurrency. */
export function offerAcceptLockKey(offerId: string): string {
  return `lock:offer:accept:${offerId}`;
}

export const OFFER_ACCEPT_LOCK_TTL_SECONDS = 5;

/**
 * DISP-01 / plano §6.2 — um pedido só tem uma rodada de reoferta em curso.
 * Sem este lock, dois ticks do job (ou o job e o admin ao mesmo tempo) leriam
 * o mesmo `dispatch_round` e criariam duas ofertas para a mesma rodada.
 */
export function dispatchLockKey(deliveryId: string): string {
  return `lock:delivery:dispatch:${deliveryId}`;
}

export const DISPATCH_LOCK_TTL_SECONDS = 10;

/**
 * COUR-02 — um clique duplo no cancelar não pode debitar duas vezes nem
 * deixar o pedido em estados diferentes. O TTL é curto: a operação cabe
 * numa transação de banco + um redespacho.
 */
export function courierCancelLockKey(deliveryId: string): string {
  return `lock:delivery:courier-cancel:${deliveryId}`;
}

export const COURIER_CANCEL_LOCK_TTL_SECONDS = 10;
