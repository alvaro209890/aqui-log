/// COUR-01 / DEC-21 — em que seção do app do prestador cada corrida aparece.
///
/// A regra mora aqui, e não na tela, por dois motivos: ela é testável sem
/// Flutter e o critério ("a janela já começou?") tem de ser o mesmo em qualquer
/// lugar que precise responder a pergunta. O plano §5.2 define duas seções;
/// a terceira existe porque a lista do prestador sempre incluiu as corridas já
/// encerradas, e sumir com elas seria perder função que já havia.
library;

import 'models.dart';

enum CourierSection {
  /// Corrida ativa: imediata aceita, ou agendada cuja janela já abriu.
  emAndamento,

  /// Agendada aceita com o início da janela ainda no futuro (`DEC-20`).
  agenda,

  /// Entregue ou cancelada — fora do trabalho do dia.
  concluida,
}

const _statusConcluidos = {'DELIVERED', 'CANCELED'};

/// Classifica uma corrida do prestador.
///
/// `now` é injetável porque a fronteira entre *Agenda* e *Em andamento* é um
/// instante: teste que depende do relógio real não prova nada.
CourierSection courierSectionOf(DeliverySummary delivery, {DateTime? now}) {
  if (_statusConcluidos.contains(delivery.status)) {
    return CourierSection.concluida;
  }
  // Só o que ainda está parado em `ACCEPTED` pode estar na agenda. Se o status
  // já andou (coleta, trânsito), a corrida está acontecendo — mesmo que a
  // janela diga outra coisa, porque admin/suporte podem abrir antes da hora.
  if (delivery.status == 'ACCEPTED' &&
      delivery.isScheduledAheadAt(now ?? DateTime.now())) {
    return CourierSection.agenda;
  }
  return CourierSection.emAndamento;
}

/// As corridas do prestador já separadas pelas seções da tela.
///
/// Não inclui ofertas: oferta ainda não é corrida dele e continua na aba
/// *Ofertas* (auto-dispatch), que é outra pergunta.
class CourierBoard {
  const CourierBoard({
    required this.emAndamento,
    required this.agenda,
    required this.concluidas,
  });

  final List<DeliverySummary> emAndamento;
  final List<DeliverySummary> agenda;
  final List<DeliverySummary> concluidas;

  factory CourierBoard.from(
    List<DeliverySummary> deliveries, {
    DateTime? now,
  }) {
    final instante = now ?? DateTime.now();
    final emAndamento = <DeliverySummary>[];
    final agenda = <DeliverySummary>[];
    final concluidas = <DeliverySummary>[];
    for (final delivery in deliveries) {
      switch (courierSectionOf(delivery, now: instante)) {
        case CourierSection.emAndamento:
          emAndamento.add(delivery);
        case CourierSection.agenda:
          agenda.add(delivery);
        case CourierSection.concluida:
          concluidas.add(delivery);
      }
    }
    // A agenda se lê de frente para trás: o próximo compromisso primeiro.
    agenda.sort((a, b) {
      final aStart = a.pickupWindowStart;
      final bStart = b.pickupWindowStart;
      if (aStart == null || bStart == null) return 0;
      return aStart.compareTo(bStart);
    });
    return CourierBoard(
      emAndamento: emAndamento,
      agenda: agenda,
      concluidas: concluidas,
    );
  }

  bool get isEmpty =>
      emAndamento.isEmpty && agenda.isEmpty && concluidas.isEmpty;
}
