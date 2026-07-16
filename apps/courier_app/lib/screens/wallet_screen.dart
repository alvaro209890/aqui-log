import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({
    super.key,
    required this.statement,
    required this.loading,
    required this.onRefresh,
  });

  final Map<String, dynamic>? statement;
  final bool loading;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final balance = statement?['balanceCents'];
    final entries = statement?['entries'];
    final list = entries is List ? entries : const [];

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Carteira', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          Card(
            color: AquiLogColors.forest,
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Saldo', style: TextStyle(color: AquiLogColors.mint)),
                  const SizedBox(height: 8),
                  Text(
                    balance is num
                        ? 'R\$ ${(balance / 100).toStringAsFixed(2)}'
                        : loading
                            ? '...'
                            : 'R\$ 0,00',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Extrato', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 10),
          if (loading && list.isEmpty)
            const Center(child: CircularProgressIndicator())
          else if (list.isEmpty)
            const Text('Sem lancamentos.', style: TextStyle(color: AquiLogColors.muted))
          else
            ...list.map((raw) {
              final e = raw is Map ? raw : <String, dynamic>{};
              final amount = e['amountCents'];
              final desc = '${e['description'] ?? e['type'] ?? 'Lancamento'}';
              return Card(
                child: ListTile(
                  title: Text(desc),
                  trailing: Text(
                    amount is num
                        ? 'R\$ ${(amount / 100).toStringAsFixed(2)}'
                        : '—',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
