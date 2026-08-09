/// SCHED-01 / DEC-18 — modo de cumprimento do pedido.
///
/// Os dois apps mostram a mesma coisa (modo, janela, quanto falta), então o
/// texto mora aqui: divergir o rótulo entre cliente e prestador é como
/// combinar horários diferentes com cada lado.
library;

class FulfillmentMode {
  static const immediate = 'IMMEDIATE';
  static const scheduled = 'SCHEDULED';

  static const labels = <String, String>{
    immediate: 'Imediato',
    scheduled: 'Agendado',
  };

  static String label(String? mode) => labels[mode] ?? labels[immediate]!;
}

/// FLOW-DEC-02 — antecedência mínima usada pela UI para não deixar o cliente
/// montar uma janela que o servidor vai recusar.
///
/// O valor de verdade é `min_schedule_lead_minutes` no admin; o app não tem
/// acesso a `/settings` (rota administrativa), então carrega este espelho. Se
/// o dono mudar o número no painel, o servidor continua sendo a autoridade —
/// a tela apenas erra para o lado seguro.
const int kMinScheduleLeadMinutes = 30;

/// Duração padrão sugerida da janela de coleta.
const int kDefaultScheduleWindowMinutes = 60;

String _two(int value) => value.toString().padLeft(2, '0');

String _hourMinute(DateTime value) =>
    '${_two(value.hour)}:${_two(value.minute)}';

String _dayMonth(DateTime value) =>
    '${_two(value.day)}/${_two(value.month)}';

/// "10/08 das 14:00 às 15:00" — e só as horas quando é o mesmo dia.
String formatPickupWindow(DateTime? start, DateTime? end) {
  if (start == null) return 'Sem janela definida';
  if (end == null) return '${_dayMonth(start)} a partir das ${_hourMinute(start)}';
  final sameDay =
      start.year == end.year && start.month == end.month && start.day == end.day;
  if (sameDay) {
    return '${_dayMonth(start)} das ${_hourMinute(start)} às ${_hourMinute(end)}';
  }
  return '${_dayMonth(start)} ${_hourMinute(start)} até ${_dayMonth(end)} ${_hourMinute(end)}';
}
