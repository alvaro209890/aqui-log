import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class NewDeliveryScreen extends StatefulWidget {
  const NewDeliveryScreen({super.key, required this.onSubmit});

  final Future<void> Function(Map<String, dynamic> form) onSubmit;

  @override
  State<NewDeliveryScreen> createState() => _NewDeliveryScreenState();
}

class _NewDeliveryScreenState extends State<NewDeliveryScreen> {
  final formKey = GlobalKey<FormState>();
  final pickup = TextEditingController(text: 'Av. Afonso Pena, 1000');
  final delivery = TextEditingController(text: 'Praca da Liberdade');
  final recipient = TextEditingController(text: 'Cliente');
  final phone = TextEditingController(text: '+5531999999999');
  bool loading = false;
  String? error;

  @override
  void dispose() {
    pickup.dispose();
    delivery.dispose();
    recipient.dispose();
    phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nova entrega')),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            TextFormField(
              controller: pickup,
              decoration: const InputDecoration(labelText: 'Endereco de coleta'),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatorio' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: delivery,
              decoration: const InputDecoration(labelText: 'Endereco de entrega'),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatorio' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: recipient,
              decoration: const InputDecoration(labelText: 'Destinatario'),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatorio' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatorio' : null,
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: loading
                  ? null
                  : () async {
                      if (!formKey.currentState!.validate()) return;
                      setState(() {
                        loading = true;
                        error = null;
                      });
                      try {
                        await widget.onSubmit({
                          'pickupAddress': pickup.text.trim(),
                          'pickupLatitude': -19.9245,
                          'pickupLongitude': -43.9352,
                          'deliveryAddress': delivery.text.trim(),
                          'deliveryLatitude': -19.9386,
                          'deliveryLongitude': -43.9346,
                          'recipientName': recipient.text.trim(),
                          'recipientPhone': phone.text.trim(),
                          'priceCents': 3500,
                          'courierFeeCents': 1800,
                        });
                        if (context.mounted) Navigator.of(context).pop(true);
                      } catch (e) {
                        setState(() => error = e.toString());
                      } finally {
                        if (mounted) setState(() => loading = false);
                      }
                    },
              child: Text(loading ? 'Enviando...' : 'Solicitar entrega'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Coordenadas de exemplo sao usadas no MVP local.',
              style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
