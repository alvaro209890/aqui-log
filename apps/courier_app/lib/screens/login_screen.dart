import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onSubmit,
    this.onCreateAccount,
    this.error,
    this.loading = false,
  });

  final Future<bool> Function(String email, String password) onSubmit;
  final VoidCallback? onCreateAccount;
  final String? error;
  final bool loading;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final emailCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  final formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    emailCtrl.dispose();
    passwordCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const AquiLogBrand(),
                  const SizedBox(height: 28),
                  const Text(
                    'Acesso do entregador',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Receba ofertas e conclua corridas.',
                    style: TextStyle(color: AquiLogColors.muted),
                  ),
                  const SizedBox(height: 28),
                  TextFormField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'E-mail'),
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Informe o e-mail' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: passwordCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Senha'),
                    validator: (v) =>
                        v == null || v.length < 8 ? 'Minimo 8 caracteres' : null,
                  ),
                  if (widget.error != null) ...[
                    const SizedBox(height: 12),
                    Text(widget.error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: widget.loading
                        ? null
                        : () async {
                            if (!formKey.currentState!.validate()) return;
                            await widget.onSubmit(
                              emailCtrl.text.trim(),
                              passwordCtrl.text,
                            );
                          },
                    child: Text(widget.loading ? 'Entrando...' : 'Entrar'),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Ainda não trabalha com a gente?',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AquiLogColors.muted, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: widget.onCreateAccount,
                    child: const Text('Quero ser entregador'),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'O cadastro passa por análise da equipe antes de liberar '
                    'as ofertas.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
