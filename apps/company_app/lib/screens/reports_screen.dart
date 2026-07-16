import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class ReportsScreen extends StatelessWidget {
  const ReportsScreen({
    super.key,
    required this.deliveries,
    this.finance,
  });

  final List<DeliverySummary> deliveries;
  final Map<String, dynamic>? finance;

  @override
  Widget build(BuildContext context) {
    final delivered = deliveries.where((d) => d.status == 'DELIVERED').length;
    final canceled = deliveries.where((d) => d.status == 'CANCELED').length;
    final gross = finance?['grossCents'];
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Relatorios', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text('Resumo da sua operacao', style: TextStyle(color: AquiLogColors.muted)),
        const SizedBox(height: 20),
        _row('Total de entregas', '${deliveries.length}'),
        _row('Concluidas', '$delivered'),
        _row('Canceladas', '$canceled'),
        _row(
          'Faturamento bruto',
          gross is num
              ? 'R\$ ${(gross / 100).toStringAsFixed(2)}'
              : '—',
        ),
      ],
    );
  }

  Widget _row(String label, String value) => Card(
    child: ListTile(
      title: Text(label),
      trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
    ),
  );
}
