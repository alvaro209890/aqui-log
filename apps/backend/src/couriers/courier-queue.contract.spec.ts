import { AccountStatus } from '../database/enums';
import { CouriersService } from './couriers.service';

/**
 * `ADMIN-02A` — o contrato de que a fila de aprovação do painel depende.
 *
 * Aprovar cadastro é revisão humana (`PLANO_ADMIN` §2.3; §7 proíbe aprovação em
 * lote sem revisão individual). Até esta rodada `GET /couriers` devolvia apenas
 * as colunas de `couriers` — quem aprovava via um UUID, um CPF e um tipo de
 * veículo, **sem nome nem e-mail**. Se a junção com `users` sumir, a tela volta
 * a pedir uma decisão sobre alguém que ela não sabe identificar, e nada quebra
 * visivelmente. Este teste tranca a porta.
 *
 * Testa as partes puras (montagem do payload e leitura do filtro) sem subir o
 * Nest: o resto do comportamento está coberto pelo smoke em HTTP vivo.
 */

type ServicePrivates = {
  withUser: (
    courier: unknown,
    raw?: { user_name?: string; user_email?: string },
  ) => Record<string, unknown>;
  parseStatus: (status?: string) => AccountStatus | undefined;
};

const service = Object.create(
  CouriersService.prototype,
) as CouriersService & ServicePrivates;

const courier = {
  id: 'c1',
  userId: 'u1',
  document: '12345678909',
  vehicleType: 'MOTORCYCLE',
  vehiclePlate: 'ABC1D23',
  documentUrls: ['https://exemplo/cnh.pdf'],
  status: AccountStatus.PENDING,
  available: false,
  createdAt: new Date('2026-08-11T10:00:00Z'),
};

describe('ADMIN-02A — payload da fila de aprovação', () => {
  it('acrescenta nome e e-mail do usuario ao entregador', () => {
    const row = service.withUser(courier, {
      user_name: 'Rafael Entregador',
      user_email: 'rafael@teste.com',
    });

    expect(row.name).toBe('Rafael Entregador');
    expect(row.email).toBe('rafael@teste.com');
  });

  it('preserva os campos que a tela ja usava', () => {
    const row = service.withUser(courier, { user_name: 'Rafael' });

    // Sem estes, a revisao humana perde o objeto da revisao: documento para
    // conferir identidade, veiculo/placa e os arquivos enviados.
    expect(row.id).toBe('c1');
    expect(row.document).toBe('12345678909');
    expect(row.vehicleType).toBe('MOTORCYCLE');
    expect(row.vehiclePlate).toBe('ABC1D23');
    expect(row.documentUrls).toEqual(['https://exemplo/cnh.pdf']);
    expect(row.status).toBe(AccountStatus.PENDING);
    expect(row.createdAt).toEqual(new Date('2026-08-11T10:00:00Z'));
  });

  it('entregador sem usuario correspondente nao quebra a lista', () => {
    const row = service.withUser(courier, undefined);
    expect(row.name).toBeNull();
    expect(row.email).toBeNull();
    expect(row.id).toBe('c1');
  });
});

describe('ADMIN-02A — filtro de status', () => {
  it('aceita os status reais, em qualquer caixa', () => {
    expect(service.parseStatus('PENDING')).toBe(AccountStatus.PENDING);
    expect(service.parseStatus('pending')).toBe(AccountStatus.PENDING);
    expect(service.parseStatus('ACTIVE')).toBe(AccountStatus.ACTIVE);
    expect(service.parseStatus('SUSPENDED')).toBe(AccountStatus.SUSPENDED);
    expect(service.parseStatus('REJECTED')).toBe(AccountStatus.REJECTED);
  });

  it('ignora status invalido em vez de derrubar a pagina do painel', () => {
    // Um enum inexistente no `where` viraria erro 500 do Postgres e a tela
    // ficaria vazia sem explicacao; sem filtro ela ao menos lista tudo.
    expect(service.parseStatus('BANANA')).toBeUndefined();
    expect(service.parseStatus('')).toBeUndefined();
    expect(service.parseStatus(undefined)).toBeUndefined();
  });
});
