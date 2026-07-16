import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class DeliveryDetailScreen extends StatelessWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.delivery,
    required this.onProof,
    required this.onStatus,
  });

  final DeliverySummary delivery;
  final VoidCallback onProof;
  final Future<void> Function(String status, {String? proofUrl}) onStatus;

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
                  StatusPill(delivery.status),
                  const SizedBox(height: 12),
                  Text(delivery.code, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text('ID: ${delivery.id}', style: const TextStyle(color: AquiLogColors.muted)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onProof,
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Enviar comprovante'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => onStatus('AT_PICKUP'),
            child: const Text('Cheguei na coleta'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => onStatus('IN_TRANSIT'),
            child: const Text('Sai para entrega'),
          ),
        ],
      ),
    );
  }
}
