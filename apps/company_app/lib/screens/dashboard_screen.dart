import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    super.key,
    required this.userName,
    required this.deliveries,
    required this.loading,
    required this.onNewDelivery,
    required this.onOpenDelivery,
  });

  final String userName;
  final List<DeliverySummary> deliveries;
  final bool loading;
  final VoidCallback onNewDelivery;
  final void Function(DeliverySummary) onOpenDelivery;

  @override
  Widget build(BuildContext context) {
    final inProgress = deliveries
        .where((d) => !const {'DELIVERED', 'CANCELED'}.contains(d.status))
        .length;
    final done = deliveries.where((d) => d.status == 'DELIVERED').length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
      children: [
        Text(
          'Bom dia, $userName',
          style: const TextStyle(
            fontSize: 25,
            fontWeight: FontWeight.w800,
            color: AquiLogColors.ink,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Sua operacao, simples e em movimento.',
          style: TextStyle(color: AquiLogColors.muted),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AquiLogColors.forestDark, AquiLogColors.forest],
            ),
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'PRECISA ENVIAR ALGO?',
                style: TextStyle(
                  color: AquiLogColors.mint,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 13),
              const Text(
                'Solicite uma entrega\nem poucos passos.',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  height: 1.25,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AquiLogColors.mint,
                  foregroundColor: AquiLogColors.forestDark,
                ),
                onPressed: onNewDelivery,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Nova entrega'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 25),
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                icon: Icons.route_rounded,
                value: '$inProgress',
                label: 'Em andamento',
                color: const Color(0xFF4E83A1),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SummaryCard(
                icon: Icons.check_circle_outline_rounded,
                value: '$done',
                label: 'Concluidas',
                color: const Color(0xFF3BA87D),
              ),
            ),
          ],
        ),
        const SizedBox(height: 26),
        const Text(
          'Entregas recentes',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 13),
        if (loading)
          const Center(child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(),
          ))
        else if (deliveries.isEmpty)
          const Text('Nenhuma entrega ainda.', style: TextStyle(color: AquiLogColors.muted))
        else
          ...deliveries.take(8).map(
            (d) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () => onOpenDelivery(d),
                child: Card(
                  child: ListTile(
                    title: Text(d.code, style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(d.status),
                    trailing: StatusPill(d.status),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(17),
      child: Row(
        children: [
          Container(
            width: 39,
            height: 39,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              Text(label, style: const TextStyle(fontSize: 10, color: AquiLogColors.muted)),
            ],
          ),
        ],
      ),
    ),
  );
}
