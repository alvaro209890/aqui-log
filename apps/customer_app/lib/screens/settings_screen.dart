import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.userName,
    required this.email,
    required this.onLogout,
    this.onOpenWallet,
    this.phoneVerified = false,
    this.onVerifyPhone,
  });

  final String userName;
  final String email;
  final VoidCallback onLogout;

  /// PAY-01: o pedido é pré-pago, então o cliente precisa de um lugar para ver
  /// o próprio saldo antes de descobrir o `402` na hora de publicar.
  final VoidCallback? onOpenWallet;

  final bool phoneVerified;
  final VoidCallback? onVerifyPhone;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Meu perfil',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.person)),
            title: Text(userName),
            subtitle: Text(email.isEmpty ? 'Conta cliente' : email),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.phone_iphone_outlined),
            title: const Text('Celular'),
            subtitle: Text(
              phoneVerified
                  ? 'Numero confirmado'
                  : 'Confirme o numero para publicar pedidos',
            ),
            trailing: phoneVerified
                ? const Icon(Icons.check_circle_outline)
                : const Icon(Icons.chevron_right),
            onTap: phoneVerified ? null : onVerifyPhone,
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.account_balance_wallet_outlined),
            title: const Text('Minha carteira'),
            subtitle: const Text('Saldo, valores reservados e extrato'),
            trailing: const Icon(Icons.chevron_right),
            onTap: onOpenWallet,
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: ListTile(
            leading: Icon(Icons.notifications_outlined),
            title: Text('Notificações'),
            subtitle: Text('Alertas de status dos seus pedidos'),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: ListTile(
            leading: Icon(Icons.help_outline),
            title: Text('Ajuda'),
            subtitle: Text('Perguntas frequentes e suporte'),
          ),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Sair'),
        ),
        const SizedBox(height: 12),
        const Text(
          'Aqui Log Cliente · MVP B2C',
          textAlign: TextAlign.center,
          style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
        ),
      ],
    );
  }
}
