import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.userName,
    required this.email,
    required this.available,
    required this.onToggleAvailable,
    required this.onLogout,
  });

  final String userName;
  final String email;
  final bool available;
  final ValueChanged<bool> onToggleAvailable;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('Perfil', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AquiLogColors.forest,
              child: Text(
                userName.isNotEmpty ? userName[0].toUpperCase() : 'E',
                style: const TextStyle(color: Colors.white),
              ),
            ),
            title: Text(userName),
            subtitle: Text(email.isEmpty ? 'Entregador' : email),
          ),
        ),
        SwitchListTile(
          title: const Text('Disponivel para corridas'),
          value: available,
          onChanged: onToggleAvailable,
        ),
        const Card(
          child: ListTile(
            leading: Icon(Icons.support_agent_outlined),
            title: Text('Suporte'),
            subtitle: Text('Fale com a operacao Aqui Log'),
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: onLogout,
          icon: const Icon(Icons.logout),
          label: const Text('Sair'),
        ),
      ],
    );
  }
}
