import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// B2C-04 / DEC-04 — confirmação do telefone por código no app (sem SMS).
class PhoneVerifyScreen extends StatefulWidget {
  const PhoneVerifyScreen({
    super.key,
    required this.onChallenge,
    required this.onVerify,
    this.onSkip,
    this.maskedPhone,
  });

  final Future<Map<String, dynamic>> Function() onChallenge;
  final Future<void> Function(String code) onVerify;
  final VoidCallback? onSkip;
  final String? maskedPhone;

  @override
  State<PhoneVerifyScreen> createState() => _PhoneVerifyScreenState();
}

class _PhoneVerifyScreenState extends State<PhoneVerifyScreen> {
  final codeCtrl = TextEditingController();
  String? error;
  String? devCode;
  bool loading = false;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    _pedirCodigo();
  }

  @override
  void dispose() {
    codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _pedirCodigo() async {
    setState(() {
      sending = true;
      error = null;
    });
    try {
      final result = await widget.onChallenge();
      if (!mounted) return;
      setState(() {
        devCode = result['devCode'] is String
            ? result['devCode'] as String
            : null;
        sending = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        sending = false;
        error = e is ApiException
            ? e.message
            : 'Nao foi possivel enviar o codigo.';
      });
    }
  }

  Future<void> _confirmar() async {
    final code = codeCtrl.text.trim();
    if (code.length != 6) {
      setState(() => error = 'Informe os 6 digitos');
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await widget.onVerify(code);
      if (!mounted) return;
      if (Navigator.of(context).canPop()) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = e is ApiException ? e.message : 'Codigo invalido.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Confirmar celular')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.maskedPhone == null
                    ? 'Enviamos um codigo de 6 digitos para o seu celular.'
                    : 'Enviamos um codigo de 6 digitos para ${widget.maskedPhone}.',
                style: const TextStyle(color: AquiLogColors.muted),
              ),
              if (devCode != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Codigo de teste: $devCode',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AquiLogColors.primaryDark,
                  ),
                ),
              ],
              const SizedBox(height: 22),
              TextField(
                controller: codeCtrl,
                keyboardType: TextInputType.number,
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Codigo de 6 digitos',
                  prefixIcon: Icon(Icons.pin_outlined),
                  counterText: '',
                ),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 22),
              FilledButton(
                onPressed: loading ? null : _confirmar,
                child: Text(loading ? 'Confirmando...' : 'Confirmar'),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: sending ? null : _pedirCodigo,
                child: Text(sending ? 'Enviando...' : 'Reenviar codigo'),
              ),
              if (widget.onSkip != null)
                TextButton(
                  onPressed: widget.onSkip,
                  child: const Text('Confirmar depois'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
