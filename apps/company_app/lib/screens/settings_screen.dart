import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.userName,
    required this.email,
    required this.onLogout,
  });

  final String userName;
  final String email;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Configuracoes', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.business)),
            title: Text(userName),
            subtitle: Text(email.isEmpty ? 'Conta empresa' : email),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: ListTile(
            leading: Icon(Icons.notifications_outlined),
            title: Text('Notificacoes'),
            subtitle: Text('Alertas de status de entrega'),
          ),
        ),
        const SizedBox(height: 12),
        const Card(
          child: ListTile(
            leading: Icon(Icons.policy_outlined),
            title: Text('Politicas'),
            subtitle: Text('Preferencias da empresa (MVP)'),
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
          'Aqui Log Empresa · MVP',
          textAlign: TextAlign.center,
          style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
        ),
      ],
    );
  }
}
