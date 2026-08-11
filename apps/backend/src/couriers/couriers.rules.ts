import { Courier } from '../database/entities/courier.entity';
import { AccountStatus } from '../database/enums';

/** Colunas cruas que a junção com `users` acrescenta ao resultado. */
export interface CourierRawUser {
  user_name?: string;
  user_email?: string;
}

export type CourierWithUser = Courier & {
  name: string | null;
  email: string | null;
};

/**
 * `ADMIN-02A` — junta a identidade do usuário ao entregador.
 *
 * Aprovar cadastro é revisão humana (`PLANO_ADMIN` §2.3; §7 proíbe aprovação em
 * lote "porque documentos exigem olho humano"). Sem nome e e-mail o painel pede
 * uma decisão sobre alguém que ele não sabe identificar — era o que acontecia
 * até aqui, porque `Courier` não declara relação com `User` e a listagem
 * devolvia só as colunas de `couriers`.
 */
export function withUser(
  courier: Courier,
  raw?: CourierRawUser,
): CourierWithUser {
  return {
    ...courier,
    name: raw?.user_name ?? null,
    email: raw?.user_email ?? null,
  };
}

/**
 * Lê o filtro `?status=` da listagem.
 *
 * Status desconhecido volta `undefined` (sem filtro) de propósito: um enum
 * inexistente no `WHERE` vira erro do Postgres, a listagem responde 500 e a
 * página do painel fica vazia sem explicação. Ignorar o filtro é o modo de
 * falhar menos pior.
 */
export function parseCourierStatus(status?: string): AccountStatus | undefined {
  if (!status) return undefined;
  const alvo = status.toUpperCase();
  return (Object.values(AccountStatus) as string[]).includes(alvo)
    ? (alvo as AccountStatus)
    : undefined;
}
