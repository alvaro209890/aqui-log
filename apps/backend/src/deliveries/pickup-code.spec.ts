import {
  PICKUP_CODE_BLOCK_MINUTES,
  PICKUP_CODE_MAX_ATTEMPTS,
  generatePickupCode,
  isPickupCodeBlocked,
  isValidPickupCodeFormat,
  normalizePickupCode,
  pickupCodeBlockSecondsLeft,
  pickupCodeMatches,
  registerPickupCodeFailure,
} from './pickup-code';

describe('pickup code (FLOW-DEC-03)', () => {
  it('gera sempre 4 digitos, inclusive com zeros a esquerda', () => {
    const codes = Array.from({ length: 500 }, () => generatePickupCode());

    expect(codes.every((code) => /^\d{4}$/.test(code))).toBe(true);
    // Espaço pequeno, mas o gerador não pode colapsar num punhado de valores.
    expect(new Set(codes).size).toBeGreaterThan(100);
  });

  it('nao reaproveita o formato do codigo publico AQL-*', () => {
    expect(isValidPickupCodeFormat('AQL-1B2C3')).toBe(false);
    expect(isValidPickupCodeFormat('12345')).toBe(false);
    expect(isValidPickupCodeFormat('12a4')).toBe(false);
    expect(isValidPickupCodeFormat('0042')).toBe(true);
  });

  it('normaliza espacos e tracos digitados pelo prestador', () => {
    expect(normalizePickupCode(' 12 34 ')).toBe('1234');
    expect(normalizePickupCode('12-34')).toBe('1234');
    expect(normalizePickupCode(null)).toBe('');
    expect(pickupCodeMatches('1234', ' 12-34 ')).toBe(true);
  });

  it('compara sem aceitar prefixo, sufixo nem tipo errado', () => {
    expect(pickupCodeMatches('1234', '1234')).toBe(true);
    expect(pickupCodeMatches('1234', '123')).toBe(false);
    expect(pickupCodeMatches('1234', '12345')).toBe(false);
    expect(pickupCodeMatches('1234', '')).toBe(false);
    expect(pickupCodeMatches('1234', undefined)).toBe(false);
  });

  it('bloqueia na quinta tentativa errada, e nao antes', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    let state = { attempts: 0, blockedUntil: null as Date | null };

    for (let i = 1; i < PICKUP_CODE_MAX_ATTEMPTS; i += 1) {
      const failure = registerPickupCodeFailure(state, now);
      expect(failure.blockedNow).toBe(false);
      expect(failure.attemptsLeft).toBe(PICKUP_CODE_MAX_ATTEMPTS - i);
      state = {
        attempts: failure.attempts,
        blockedUntil: failure.blockedUntil,
      };
      expect(isPickupCodeBlocked(state, now)).toBe(false);
    }

    const last = registerPickupCodeFailure(state, now);
    expect(last.blockedNow).toBe(true);
    expect(last.attemptsLeft).toBe(0);
    expect(last.blockedUntil).toEqual(
      new Date(now.getTime() + PICKUP_CODE_BLOCK_MINUTES * 60_000),
    );
    // Contador zerado: o próximo ciclo começa com as mesmas 5 chances.
    expect(last.attempts).toBe(0);
  });

  it('o bloqueio e temporario e expira sozinho', () => {
    const now = new Date('2026-08-09T12:00:00.000Z');
    const blocked = {
      attempts: 0,
      blockedUntil: new Date(now.getTime() + 60_000),
    };

    expect(isPickupCodeBlocked(blocked, now)).toBe(true);
    expect(pickupCodeBlockSecondsLeft(blocked, now)).toBe(60);

    const later = new Date(now.getTime() + 61_000);
    expect(isPickupCodeBlocked(blocked, later)).toBe(false);
    expect(pickupCodeBlockSecondsLeft(blocked, later)).toBe(0);
  });
});
