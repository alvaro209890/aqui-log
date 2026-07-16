import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class DeliveryDetailScreen extends StatelessWidget {
  const DeliveryDetailScreen({super.key, required this.delivery});

  final DeliverySummary delivery;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(delivery.code)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Status', style: TextStyle(color: AquiLogColors.muted, fontSize: 12)),
                  const SizedBox(height: 8),
                  StatusPill(delivery.status),
                  const SizedBox(height: 16),
                  const Text('Codigo', style: TextStyle(color: AquiLogColors.muted, fontSize: 12)),
                  Text(delivery.code, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 16),
                  const Text('Identificador', style: TextStyle(color: AquiLogColors.muted, fontSize: 12)),
                  Text(delivery.id),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Acompanhe atualizacoes em tempo real pelo painel ou pela API de historico.',
            style: TextStyle(color: AquiLogColors.muted),
          ),
        ],
      ),
    );
  }
}
