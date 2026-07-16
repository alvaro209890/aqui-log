import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class DeliveriesScreen extends StatelessWidget {
  const DeliveriesScreen({
    super.key,
    required this.deliveries,
    required this.loading,
    required this.onOpen,
    required this.onRefresh,
  });

  final List<DeliverySummary> deliveries;
  final bool loading;
  final void Function(DeliverySummary) onOpen;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    if (loading && deliveries.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: deliveries.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 80),
                Center(child: Text('Nenhuma entrega.', style: TextStyle(color: AquiLogColors.muted))),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: deliveries.length,
              separatorBuilder: (context, index) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final d = deliveries[index];
                return Card(
                  child: ListTile(
                    title: Text(d.code, style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(d.status),
                    trailing: StatusPill(d.status),
                    onTap: () => onOpen(d),
                  ),
                );
              },
            ),
    );
  }
}
