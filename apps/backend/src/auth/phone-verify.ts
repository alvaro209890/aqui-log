import { randomInt, timingSafeEqual } from 'crypto';
import { hashToken } from './token-crypto';

/**
 * B2C-04 / DEC-04 — regras puras da verificação de telefone.
 *
 * Sem provedor SMS: o código vive no próprio sistema. Hash + TTL + tentativas
 * + cooldown. O adapter local pode revelar o código; produção nunca revela.
 */

export const PHONE_CODE_LENGTH = 6;
export const PHONE_CODE_TTL_MINUTES = 10;
export const PHONE_CODE_MAX_ATTEMPTS = 5;
export const PHONE_CODE_BLOCK_MINUTES = 15;
export const PHONE_CODE_RESEND_SECONDS = 60;

const PHONE_CODE_RE = /^\d{6}$/;

export function generatePhoneCode(): string {
  return String(randomInt(0, 10 ** PHONE_CODE_LENGTH)).padStart(
    PHONE_CODE_LENGTH,
    '0',
  );
}

export function hashPhoneCode(raw: string): string {
  return hashToken(raw);
}

export function phoneCodeMatches(
  expectedHash: string,
  provided: string | null | undefined,
): boolean {
  const candidate = (provided ?? '').replace(/[\s-]/g, '');
  if (!PHONE_CODE_RE.test(candidate) || !expectedHash) return false;
  const got = Buffer.from(hashPhoneCode(candidate), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

/**
 * Normaliza para E.164. BR: 10/11 dígitos viram `+55…`. Já internacional
 * (`+…` ou começando com 55 e ≥ 12 dígitos) se mantém. Inválido → null.
 */
export function normalizePhoneE164(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return null;
}

export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return e164;
  return `****${digits.slice(-4)}`;
}

export type PhoneChallengeState = {
  sentAt: Date | null;
  blockedUntil: Date | null;
};

export function challengeCooldownSecondsLeft(
  sentAt: Date | null,
  now: Date = new Date(),
): number {
  if (!sentAt) return 0;
  const readyAt = sentAt.getTime() + PHONE_CODE_RESEND_SECONDS * 1000;
  return Math.max(0, Math.ceil((readyAt - now.getTime()) / 1000));
}

export function isPhoneChallengeBlocked(
  blockedUntil: Date | null,
  now: Date = new Date(),
): boolean {
  return blockedUntil !== null && blockedUntil.getTime() > now.getTime();
}

export type PhoneVerifyFailure = {
  attempts: number;
  blockedUntil: Date | null;
  attemptsLeft: number;
  blockedNow: boolean;
};

export function registerPhoneVerifyFailure(
  attempts: number,
  now: Date = new Date(),
): PhoneVerifyFailure {
  const next = attempts + 1;
  if (next >= PHONE_CODE_MAX_ATTEMPTS) {
    return {
      attempts: 0,
      blockedUntil: new Date(now.getTime() + PHONE_CODE_BLOCK_MINUTES * 60_000),
      attemptsLeft: 0,
      blockedNow: true,
    };
  }
  return {
    attempts: next,
    blockedUntil: null,
    attemptsLeft: PHONE_CODE_MAX_ATTEMPTS - next,
    blockedNow: false,
  };
}

/**
 * Adapter explícito: `local` revela, `silent` nunca. Sem adapter, produção
 * fica silent e o resto local — o piloto no acer é NODE_ENV=production, então
 * precisa `PHONE_VERIFY_ADAPTER=local` para o smoke e o app de teste.
 */
export function shouldRevealDevCode(
  nodeEnv: string | undefined,
  adapter: string | undefined,
): boolean {
  const name = (adapter ?? '').toLowerCase();
  if (name === 'local') return true;
  if (name === 'silent') return false;
  return nodeEnv !== 'production';
}

/** Só o flag explícito liga o gate. NODE_ENV=production no acer não basta. */
export function phoneVerifyRequired(
  _nodeEnv: string | undefined,
  flag: string | undefined,
): boolean {
  return flag === 'true';
}
