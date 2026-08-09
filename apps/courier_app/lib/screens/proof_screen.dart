import 'dart:typed_data';

import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Proof capture + upload. Falls back to synthetic bytes when camera is unavailable (tests).
///
/// PICK-01 / DEC-24: na etapa de coleta o entregador também digita o código de
/// 4 dígitos que o cliente mostra. O app nunca recebe o código do servidor —
/// ele só o envia para validação.
class ProofScreen extends StatefulWidget {
  const ProofScreen({
    super.key,
    required this.deliveryId,
    required this.onSubmit,
    this.pickupCodeRequired = false,
    this.pickupCodeAttemptsLeft,
    this.pickupCodeBlockedUntil,
  });

  final String deliveryId;

  /// Coleta deste pedido exige código (pedido legado não exige).
  final bool pickupCodeRequired;

  /// Tentativas restantes antes do bloqueio temporário (`FLOW-DEC-03`).
  final int? pickupCodeAttemptsLeft;

  /// Fim do bloqueio temporário, quando o pedido já estiver bloqueado.
  final DateTime? pickupCodeBlockedUntil;

  /// Receives image bytes, content-type and target status; parent uploads to storage.
  final Future<void> Function({
    required Uint8List bytes,
    required String contentType,
    required String status,
    String? pickupCode,
  })
  onSubmit;

  @override
  State<ProofScreen> createState() => _ProofScreenState();
}

class _ProofScreenState extends State<ProofScreen> {
  Uint8List? bytes;
  bool loading = false;
  String status = 'PICKED_UP';
  String? error;
  final picker = ImagePicker();
  final pickupCodeController = TextEditingController();

  @override
  void dispose() {
    pickupCodeController.dispose();
    super.dispose();
  }

  /// O código só entra na coleta; na entrega final ele não existe.
  bool get _codeStep => widget.pickupCodeRequired && status == 'PICKED_UP';

  bool get _codeReady =>
      !_codeStep ||
      RegExp(r'^\d{4}$').hasMatch(pickupCodeController.text.trim());

  bool get _blocked {
    final until = widget.pickupCodeBlockedUntil;
    return until != null && until.isAfter(DateTime.now());
  }

  Future<void> _capture() async {
    try {
      final file = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
      );
      if (file != null) {
        final data = await file.readAsBytes();
        setState(() => bytes = data);
        return;
      }
    } catch (_) {
      // emulator / test without camera
    }
    setState(() {
      bytes = Uint8List.fromList(
        List<int>.generate(128, (i) => (i * 17) % 256),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final captured = bytes != null;
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
                  color: captured ? AquiLogColors.success : Colors.white70,
                  size: 64,
                ),
                Positioned(
                  bottom: 16,
                  left: 12,
                  right: 12,
                  child: Text(
                    captured
                        ? 'Foto pronta (${bytes!.length} bytes)'
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
            onPressed: _capture,
            icon: const Icon(Icons.camera_alt),
            label: const Text('Capturar foto'),
          ),
          if (_codeStep) ...[
            const SizedBox(height: 20),
            const Text(
              'Código de recolhimento',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text(
              'Peça ao cliente os 4 dígitos que aparecem no pedido dele.',
              style: TextStyle(color: AquiLogColors.muted, fontSize: 13),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: pickupCodeController,
              keyboardType: TextInputType.number,
              maxLength: 4,
              enabled: !_blocked,
              decoration: const InputDecoration(
                hintText: '0000',
                counterText: '',
                prefixIcon: Icon(Icons.pin_outlined),
              ),
              onChanged: (_) => setState(() {}),
            ),
            if (_blocked)
              const Text(
                'Coleta bloqueada por tentativas erradas. Fale com o suporte.',
                style: TextStyle(color: AquiLogColors.errorText),
              )
            else if (widget.pickupCodeAttemptsLeft != null)
              Text(
                'Tentativas restantes: ${widget.pickupCodeAttemptsLeft}',
                style: const TextStyle(
                  color: AquiLogColors.muted,
                  fontSize: 12,
                ),
              ),
          ],
          const SizedBox(height: 12),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          FilledButton(
            onPressed: !captured || loading || !_codeReady || _blocked
                ? null
                : () async {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    try {
                      await widget.onSubmit(
                        bytes: bytes!,
                        contentType: 'image/jpeg',
                        status: status,
                        pickupCode: _codeStep
                            ? pickupCodeController.text.trim()
                            : null,
                      );
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
