import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Cadastro de cliente pessoa física (B2C) — auto-aprovado.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.onSubmit,
    this.loading = false,
    this.error,
  });

  final Future<bool> Function({
    required String name,
    required String email,
    required String password,
    required String document,
    required String phone,
  }) onSubmit;
  final bool loading;
  final String? error;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final formKey = GlobalKey<FormState>();
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final documentCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();

  @override
  void dispose() {
    nameCtrl.dispose();
    emailCtrl.dispose();
    phoneCtrl.dispose();
    documentCtrl.dispose();
    passwordCtrl.dispose();
    super.dispose();
  }

  String? _validateCpf(String? value) {
    if (value == null || value.trim().isEmpty) return 'Informe o CPF';
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 11) return 'CPF deve ter 11 dígitos';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Cadastro rápido. Sem empresa, sem aprovação.',
                  style: TextStyle(color: AquiLogColors.muted),
                ),
                const SizedBox(height: 22),
                TextFormField(
                  controller: nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Nome completo',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Informe seu nome' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'E-mail',
                    prefixIcon: Icon(Icons.mail_outline),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Informe o e-mail';
                    if (!v.contains('@')) return 'E-mail inválido';
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: phoneCtrl,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Celular (com DDD)',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Informe o celular';
                    }
                    if (v.replaceAll(RegExp(r'\D'), '').length < 10) {
                      return 'Celular incompleto';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: documentCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'CPF (somente números)',
                    prefixIcon: Icon(Icons.badge_outlined),
                  ),
                  validator: _validateCpf,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: passwordCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Senha',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                  validator: (v) =>
                      v == null || v.length < 8 ? 'Mínimo 8 caracteres' : null,
                ),
                if (widget.error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    widget.error!,
                    style: const TextStyle(color: Colors.red),
                  ),
                ],
                const SizedBox(height: 22),
                FilledButton(
                  onPressed: widget.loading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          final ok = await widget.onSubmit(
                            name: nameCtrl.text.trim(),
                            email: emailCtrl.text.trim(),
                            password: passwordCtrl.text,
                            document: documentCtrl.text,
                            phone: phoneCtrl.text,
                          );
                          if (ok && context.mounted) {
                            Navigator.of(context).pop();
                          }
                        },
                  child: Text(widget.loading ? 'Criando...' : 'Criar conta'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
