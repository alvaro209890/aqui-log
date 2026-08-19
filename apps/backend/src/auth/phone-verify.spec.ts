import { hashToken } from './token-crypto';
import {
  challengeCooldownSecondsLeft,
  generatePhoneCode,
  hashPhoneCode,
  maskPhone,
  normalizePhoneE164,
  phoneCodeMatches,
  phoneVerifyRequired,
  registerPhoneVerifyFailure,
  shouldRevealDevCode,
  PHONE_CODE_LENGTH,
  PHONE_CODE_MAX_ATTEMPTS,
} from './phone-verify';

describe('B2C-04 — regras puras do telefone', () => {
  it('gera 6 digitos com zero a esquerda possivel', () => {
    for (let i = 0; i < 40; i += 1) {
      const code = generatePhoneCode();
      expect(code).toMatch(new RegExp(`^\\d{${PHONE_CODE_LENGTH}}$`));
    }
  });

  it('compara o hash em tempo constante e recusa formato errado', () => {
    const hash = hashPhoneCode('042017');
    expect(hash).toBe(hashToken('042017'));
    expect(phoneCodeMatches(hash, '042017')).toBe(true);
    expect(phoneCodeMatches(hash, '04 20-17')).toBe(true);
    expect(phoneCodeMatches(hash, '042018')).toBe(false);
    expect(phoneCodeMatches(hash, '42017')).toBe(false);
  });

  it('normaliza BR para E.164 sem vazar lixo', () => {
    expect(normalizePhoneE164('31999999999')).toBe('+5531999999999');
    expect(normalizePhoneE164('+55 31 99999-9999')).toBe('+5531999999999');
    expect(normalizePhoneE164('5531999999999')).toBe('+5531999999999');
    expect(normalizePhoneE164('9999')).toBeNull();
    expect(normalizePhoneE164('')).toBeNull();
  });

  it('mascara o telefone mostrando so os 4 finais', () => {
    expect(maskPhone('+5531999999999')).toBe('****9999');
  });

  it('cooldown de reenvio conta a partir do sentAt', () => {
    const sentAt = new Date('2026-08-19T12:00:00.000Z');
    expect(
      challengeCooldownSecondsLeft(
        sentAt,
        new Date('2026-08-19T12:00:10.000Z'),
      ),
    ).toBe(50);
    expect(
      challengeCooldownSecondsLeft(
        sentAt,
        new Date('2026-08-19T12:01:00.000Z'),
      ),
    ).toBe(0);
    expect(challengeCooldownSecondsLeft(null)).toBe(0);
  });

  it('5a tentativa errada bloqueia e zera o contador', () => {
    let attempts = 0;
    for (let i = 0; i < PHONE_CODE_MAX_ATTEMPTS - 1; i += 1) {
      const result = registerPhoneVerifyFailure(attempts);
      expect(result.blockedNow).toBe(false);
      attempts = result.attempts;
    }
    const blocked = registerPhoneVerifyFailure(attempts);
    expect(blocked.blockedNow).toBe(true);
    expect(blocked.attemptsLeft).toBe(0);
    expect(blocked.attempts).toBe(0);
    expect(blocked.blockedUntil).not.toBeNull();
  });

  it('producao nunca revela o codigo; local revela por default', () => {
    expect(shouldRevealDevCode('production', 'local')).toBe(false);
    expect(shouldRevealDevCode('development', 'local')).toBe(true);
    expect(shouldRevealDevCode('development', 'silent')).toBe(false);
    expect(shouldRevealDevCode(undefined, undefined)).toBe(true);
  });

  it('gate de producao: PHONE_VERIFY_REQUIRED manda, senao NODE_ENV', () => {
    expect(phoneVerifyRequired('production', undefined)).toBe(true);
    expect(phoneVerifyRequired('development', undefined)).toBe(false);
    expect(phoneVerifyRequired('production', 'false')).toBe(false);
    expect(phoneVerifyRequired('development', 'true')).toBe(true);
  });
});
