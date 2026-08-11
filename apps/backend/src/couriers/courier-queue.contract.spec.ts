import { Courier } from '../database/entities/courier.entity';
import { AccountStatus, VehicleType } from '../database/enums';
import { parseCourierStatus, withUser } from './couriers.rules';

/**
 * `ADMIN-02A` — o contrato de que a fila de aprovação do painel depende.
 *
 * Aprovar cadastro é revisão humana (`PLANO_ADMIN` §2.3; §7 proíbe aprovação em
 * lote sem revisão individual). Até esta rodada `GET /couriers` devolvia apenas
 * as colunas de `couriers` — quem aprovava via um UUID, um CPF e um tipo de
 * veículo, **sem nome nem e-mail**. Se a junção com `users` sumir, a tela volta
 * a pedir uma decisão sobre alguém que ela não sabe identificar, e nada quebra
 * visivelmente. Este teste tranca a porta.
 */

const courier: Courier = {
  id: 'c1',
  userId: 'u1',
  document: '12345678909',
  vehicleType: VehicleType.MOTORCYCLE,
  vehiclePlate: 'ABC1D23',
  documentUrls: ['https://exemplo/cnh.pdf'],
  status: AccountStatus.PENDING,
  available: false,
  lastLatitude: null,
  lastLongitude: null,
  createdAt: new Date('2026-08-11T10:00:00Z'),
  updatedAt: new Date('2026-08-11T10:00:00Z'),
};

describe('ADMIN-02A — payload da fila de aprovacao', () => {
  it('acrescenta nome e e-mail do usuario ao entregador', () => {
    const row = withUser(courier, {
      user_name: 'Rafael Entregador',
      user_email: 'rafael@teste.com',
    });

    expect(row.name).toBe('Rafael Entregador');
    expect(row.email).toBe('rafael@teste.com');
  });

  it('preserva os campos que a revisao humana usa', () => {
    const row = withUser(courier, { user_name: 'Rafael' });

    // Sem estes, a revisao perde o proprio objeto: documento para conferir
    // identidade, veiculo/placa e os arquivos enviados.
    expect(row.id).toBe('c1');
    expect(row.document).toBe('12345678909');
    expect(row.vehicleType).toBe(VehicleType.MOTORCYCLE);
    expect(row.vehiclePlate).toBe('ABC1D23');
    expect(row.documentUrls).toEqual(['https://exemplo/cnh.pdf']);
    expect(row.status).toBe(AccountStatus.PENDING);
    expect(row.createdAt).toEqual(new Date('2026-08-11T10:00:00Z'));
  });

  it('entregador sem usuario correspondente nao quebra a lista', () => {
    const row = withUser(courier, undefined);
    expect(row.name).toBeNull();
    expect(row.email).toBeNull();
    expect(row.id).toBe('c1');
  });
});

describe('ADMIN-02A — filtro de status', () => {
  it('aceita os status reais, em qualquer caixa', () => {
    expect(parseCourierStatus('PENDING')).toBe(AccountStatus.PENDING);
    expect(parseCourierStatus('pending')).toBe(AccountStatus.PENDING);
    expect(parseCourierStatus('ACTIVE')).toBe(AccountStatus.ACTIVE);
    expect(parseCourierStatus('SUSPENDED')).toBe(AccountStatus.SUSPENDED);
    expect(parseCourierStatus('REJECTED')).toBe(AccountStatus.REJECTED);
  });

  it('ignora status invalido em vez de derrubar a pagina do painel', () => {
    // Um enum inexistente no `WHERE` viraria erro do Postgres: a listagem
    // responderia 500 e a tela ficaria vazia sem explicacao.
    expect(parseCourierStatus('BANANA')).toBeUndefined();
    expect(parseCourierStatus('')).toBeUndefined();
    expect(parseCourierStatus(undefined)).toBeUndefined();
  });
});
