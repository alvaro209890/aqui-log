import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

/// Proof capture UI. Uses a camera-style frame; actual device camera can be
/// wired later without changing navigation. Tests pump this widget without hardware.
class ProofScreen extends StatefulWidget {
  const ProofScreen({
    super.key,
    required this.deliveryId,
    required this.onSubmit,
  });

  final String deliveryId;
  final Future<void> Function(String proofUrl, String status) onSubmit;

  @override
  State<ProofScreen> createState() => _ProofScreenState();
}

class _ProofScreenState extends State<ProofScreen> {
  bool captured = false;
  bool loading = false;
  String status = 'PICKED_UP';
  String? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Comprovante')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            height: 220,
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  captured ? Icons.check_circle : Icons.photo_camera_outlined,
                  color: captured ? AquiLogColors.mint : Colors.white70,
                  size: 64,
                ),
                Positioned(
                  bottom: 16,
                  left: 12,
                  right: 12,
                  child: Text(
                    captured
                        ? 'Foto capturada (simulada)'
                        : 'Aponte a camera e capture',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text('Etapa', style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('Coleta'),
                selected: status == 'PICKED_UP',
                onSelected: (_) => setState(() => status = 'PICKED_UP'),
              ),
              ChoiceChip(
                label: const Text('Entrega final'),
                selected: status == 'DELIVERED',
                onSelected: (_) => setState(() => status = 'DELIVERED'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => setState(() => captured = true),
            icon: const Icon(Icons.camera_alt),
            label: const Text('Capturar foto'),
          ),
          const SizedBox(height: 12),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          FilledButton(
            onPressed: !captured || loading
                ? null
                : () async {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    try {
                      final url =
                          'https://example.com/proof/${widget.deliveryId}-${DateTime.now().millisecondsSinceEpoch}.jpg';
                      await widget.onSubmit(url, status);
                      if (context.mounted) Navigator.of(context).pop(true);
                    } catch (e) {
                      setState(() => error = e.toString());
                    } finally {
                      if (mounted) setState(() => loading = false);
                    }
                  },
            child: Text(loading ? 'Enviando...' : 'Confirmar comprovante'),
          ),
        ],
      ),
    );
  }
}
