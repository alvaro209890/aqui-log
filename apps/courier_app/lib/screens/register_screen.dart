import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

import '../app_state.dart';

/// Tipos de veículo aceitos pela API (`VehicleType`). Enviar qualquer outra
/// coisa volta como `400`, então a tela oferece só estes.
const Map<String, String> kVehicleTypes = {
  'MOTORCYCLE': 'Moto',
  'BICYCLE': 'Bicicleta',
  'CAR': 'Carro',
  'VAN': 'Van',
};

/// Cadastro do entregador.
///
/// Diferente do cliente, aqui **não existe auto-login**: a API cria a conta com
/// `status: PENDING` e o login responde `401 Cadastro ainda nao aprovado` até
/// um admin aprovar. A tela termina numa confirmação que diz isso — inventar
/// uma entrada direta só produziria um erro logo depois.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({
    super.key,
    required this.onSubmit,
    this.error,
    this.loading = false,
  });

  final Future<CourierRegistration?> Function({
    required String name,
    required String email,
    required String password,
    required String document,
    required String vehicleType,
    String? vehiclePlate,
  })
  onSubmit;

  final String? error;
  final bool loading;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final formKey = GlobalKey<FormState>();
  final nameCtrl = TextEditingController();
  final emailCtrl = TextEditingController();
  final passwordCtrl = TextEditingController();
  final documentCtrl = TextEditingController();
  final plateCtrl = TextEditingController();

  String vehicleType = kVehicleTypes.keys.first;
  CourierRegistration? resultado;

  /// Veículo sem placa (bicicleta) não deve exigir placa.
  bool get _requerPlaca => vehicleType != 'BICYCLE';

  @override
  void dispose() {
    nameCtrl.dispose();
    emailCtrl.dispose();
    passwordCtrl.dispose();
    documentCtrl.dispose();
    plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!formKey.currentState!.validate()) return;
    final r = await widget.onSubmit(
      name: nameCtrl.text.trim(),
      email: emailCtrl.text.trim(),
      password: passwordCtrl.text,
      document: documentCtrl.text.replaceAll(RegExp(r'\D'), ''),
      vehicleType: vehicleType,
      vehiclePlate: _requerPlaca ? plateCtrl.text.trim() : null,
    );
    if (r != null && mounted) setState(() => resultado = r);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: SafeArea(
        child: resultado != null ? _confirmacao(resultado!) : _formulario(),
      ),
    );
  }

  Widget _confirmacao(CourierRegistration r) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const SizedBox(height: 24),
      Icon(
        r.pending ? Icons.hourglass_top_rounded : Icons.check_circle_outline,
        size: 72,
        color: AquiLogColors.primary,
      ),
      const SizedBox(height: 20),
      Text(
        r.pending ? 'Cadastro enviado!' : 'Cadastro aprovado!',
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 12),
      Text(
        r.pending
            ? 'Sua conta está em análise pela equipe do Aqui Log. Assim que ela '
                  'for aprovada, você já consegue entrar aqui no app e começar a '
                  'receber ofertas.\n\nEnquanto isso, o login vai avisar que o '
                  'cadastro ainda não foi aprovado — é normal.'
            : 'Sua conta já está ativa. Entre com o seu e-mail e senha.',
        textAlign: TextAlign.center,
        style: const TextStyle(color: AquiLogColors.muted, height: 1.4),
      ),
      const SizedBox(height: 32),
      FilledButton(
        onPressed: () => Navigator.of(context).pop(),
        child: const Text('Voltar para o login'),
      ),
    ],
  );

  Widget _formulario() => Form(
    key: formKey,
    child: ListView(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 28),
      children: [
        const Text(
          'Trabalhe com a gente',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        const Text(
          'Preencha seus dados. A equipe confere e libera o seu acesso.',
          style: TextStyle(color: AquiLogColors.muted),
        ),
        const SizedBox(height: 24),
        TextFormField(
          controller: nameCtrl,
          textCapitalization: TextCapitalization.words,
          decoration: const InputDecoration(
            labelText: 'Nome completo',
            prefixIcon: Icon(Icons.person_outline),
          ),
          validator: (v) =>
              v == null || v.trim().length < 3 ? 'Informe o nome' : null,
        ),
        const SizedBox(height: 14),
        TextFormField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(
            labelText: 'E-mail',
            prefixIcon: Icon(Icons.mail_outline),
          ),
          validator: (v) => v == null || !v.contains('@')
              ? 'Informe um e-mail válido'
              : null,
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
        const SizedBox(height: 14),
        TextFormField(
          controller: documentCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'CPF (somente números)',
            prefixIcon: Icon(Icons.badge_outlined),
          ),
          validator: (v) {
            final digits = (v ?? '').replaceAll(RegExp(r'\D'), '');
            return digits.length < 11 ? 'CPF incompleto' : null;
          },
        ),
        const SizedBox(height: 20),
        const Text('Veículo', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: vehicleType,
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.two_wheeler_outlined),
          ),
          items: kVehicleTypes.entries
              .map(
                (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
              )
              .toList(),
          onChanged: (v) => setState(() => vehicleType = v ?? vehicleType),
        ),
        if (_requerPlaca) ...[
          const SizedBox(height: 14),
          TextFormField(
            controller: plateCtrl,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Placa',
              prefixIcon: Icon(Icons.confirmation_number_outlined),
            ),
            validator: (v) {
              if (!_requerPlaca) return null;
              final placa = (v ?? '').replaceAll(RegExp(r'[^A-Za-z0-9]'), '');
              return placa.length < 7 ? 'Placa incompleta' : null;
            },
          ),
        ],
        if (widget.error != null) ...[
          const SizedBox(height: 14),
          Text(widget.error!, style: const TextStyle(color: Colors.red)),
        ],
        const SizedBox(height: 24),
        FilledButton(
          onPressed: widget.loading ? null : _submit,
          child: Text(widget.loading ? 'Enviando...' : 'Enviar cadastro'),
        ),
        const SizedBox(height: 12),
        const Text(
          'Documentos (CNH, documento do veículo) podem ser pedidos pela '
          'equipe durante a análise.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
        ),
      ],
    ),
  );
}
