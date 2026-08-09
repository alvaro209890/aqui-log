import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:test/test.dart';

/// COUR-01 / DEC-21 — a fronteira entre *Agenda* e *Em andamento* é um
/// instante, então todo caso aqui fixa o "agora".
void main() {
  final agora = DateTime(2026, 8, 9, 10, 0);

  DeliverySummary corrida({
    required String id,
    required String status,
    String modo = 'IMMEDIATE',
    DateTime? janelaInicio,
    DateTime? janelaFim,
  }) => DeliverySummary(
    id: id,
    code: 'AQL-$id',
    status: status,
    fulfillmentMode: modo,
    pickupWindowStart: janelaInicio,
    pickupWindowEnd: janelaFim,
  );

  test('agendada aceita com janela no futuro vai para a Agenda', () {
    final d = corrida(
      id: '1',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: agora.add(const Duration(hours: 3)),
      janelaFim: agora.add(const Duration(hours: 4)),
    );
    expect(courierSectionOf(d, now: agora), CourierSection.agenda);
  });

  test('agendada cuja janela ja comecou vai para Em andamento', () {
    final d = corrida(
      id: '2',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: agora.subtract(const Duration(minutes: 10)),
      janelaFim: agora.add(const Duration(minutes: 50)),
    );
    expect(courierSectionOf(d, now: agora), CourierSection.emAndamento);
  });

  test('a fronteira e o inicio exato da janela: no instante ja e execucao', () {
    final d = corrida(
      id: '3',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: agora,
      janelaFim: agora.add(const Duration(hours: 1)),
    );
    expect(courierSectionOf(d, now: agora), CourierSection.emAndamento);

    final umMinutoAntes = agora.subtract(const Duration(minutes: 1));
    expect(courierSectionOf(d, now: umMinutoAntes), CourierSection.agenda);
  });

  test('imediata aceita vai para Em andamento mesmo sem janela', () {
    final d = corrida(id: '4', status: 'ACCEPTED');
    expect(courierSectionOf(d, now: agora), CourierSection.emAndamento);
  });

  test('agendada em execucao nao volta para a Agenda pelo status', () {
    // Admin/suporte podem abrir a coleta antes da hora; se o status andou, a
    // corrida está acontecendo, e a janela futura não deve escondê-la.
    for (final status in ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT']) {
      final d = corrida(
        id: status,
        status: status,
        modo: 'SCHEDULED',
        janelaInicio: agora.add(const Duration(hours: 2)),
      );
      expect(
        courierSectionOf(d, now: agora),
        CourierSection.emAndamento,
        reason: status,
      );
    }
  });

  test('entregue e cancelada saem das duas secoes de trabalho', () {
    for (final status in ['DELIVERED', 'CANCELED']) {
      expect(
        courierSectionOf(corrida(id: status, status: status), now: agora),
        CourierSection.concluida,
        reason: status,
      );
    }
  });

  test('agendada sem janela nao fica presa na Agenda', () {
    // Pedido legado ou dado incompleto: sem instante de início não há como
    // dizer que é futuro, e esconder a corrida seria pior que mostrá-la.
    final d = corrida(id: '5', status: 'ACCEPTED', modo: 'SCHEDULED');
    expect(courierSectionOf(d, now: agora), CourierSection.emAndamento);
  });

  test('CourierBoard separa a lista inteira e ordena a agenda', () {
    final tarde = corrida(
      id: 'tarde',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: agora.add(const Duration(hours: 8)),
    );
    final cedo = corrida(
      id: 'cedo',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: agora.add(const Duration(hours: 2)),
    );
    final ativa = corrida(id: 'ativa', status: 'IN_TRANSIT');
    final feita = corrida(id: 'feita', status: 'DELIVERED');

    final board = CourierBoard.from([tarde, ativa, feita, cedo], now: agora);

    expect(board.emAndamento.map((d) => d.id), ['ativa']);
    expect(board.agenda.map((d) => d.id), ['cedo', 'tarde']);
    expect(board.concluidas.map((d) => d.id), ['feita']);
    expect(board.isEmpty, isFalse);
    expect(CourierBoard.from(const [], now: agora).isEmpty, isTrue);
  });

  test('isScheduledAheadAt concorda com scheduledAhead no relogio real', () {
    final futura = corrida(
      id: '6',
      status: 'ACCEPTED',
      modo: 'SCHEDULED',
      janelaInicio: DateTime.now().add(const Duration(hours: 5)),
    );
    expect(futura.scheduledAhead, isTrue);
    expect(futura.isScheduledAheadAt(DateTime.now()), isTrue);
  });
}
