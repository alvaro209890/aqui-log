import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.userName,
    required this.deliveries,
    required this.loading,
    required this.onNewOrder,
    required this.onOpenDelivery,
  });

  final String userName;
  final List<DeliverySummary> deliveries;
  final bool loading;
  final VoidCallback onNewOrder;
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
          'Olá, $userName',
          style: const TextStyle(
            fontSize: 25,
            fontWeight: FontWeight.w800,
            color: AquiLogColors.ink,
          ),
        ),
        const SizedBox(height: 5),
        const Text(
          'Sua encomenda, a caminho do seu jeito.',
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
                'Descreva a encomenda e um\nmotoboy aceita levar.',
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
                onPressed: onNewOrder,
                icon: const Icon(Icons.add_rounded),
                label: const Text('Fazer pedido'),
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
                label: 'Concluídas',
                color: const Color(0xFF3BA87D),
              ),
            ),
          ],
        ),
        const SizedBox(height: 26),
        const Text(
          'Pedidos recentes',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 13),
        if (loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(),
            ),
          )
        else if (deliveries.isEmpty)
          const Text(
            'Nenhum pedido ainda. Toque em "Fazer pedido" para começar.',
            style: TextStyle(color: AquiLogColors.muted),
          )
        else
          ...deliveries.take(8).map(
            (d) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () => onOpenDelivery(d),
                child: Card(
                  child: ListTile(
                    title: Text(
                      d.code,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      _subtitle(d),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: StatusPill(d.status),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  static String _subtitle(DeliverySummary d) {
    final meta = OrderMeta.fromNotes(d.notes);
    if (meta != null) return '${meta.productType} · ${meta.size} · ${d.status}';
    return d.status;
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
              Text(
                value,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              ),
              Text(
                label,
                style: const TextStyle(fontSize: 10, color: AquiLogColors.muted),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}
