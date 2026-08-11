import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

/// Carteira do entregador (PAY-01 / `DEC-05`, `DEC-23`).
///
/// O saldo vem do **ledger**: cada entrega concluída gera uma liquidação que
/// credita o repasse aqui (a carteira MVP antiga, `wallet_transactions`, ficou
/// congelada). Saque/payout ainda **não existe** no servidor — a tela diz isso
/// em vez de mostrar um botão que não faz nada.
class WalletScreen extends StatelessWidget {
  const WalletScreen({
    super.key,
    required this.statement,
    required this.loading,
    required this.onRefresh,
  });

  final WalletStatement? statement;
  final bool loading;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final data = statement;
    final entries = data?.entries ?? const <WalletEntry>[];

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Carteira',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AquiLogColors.primaryDark, AquiLogColors.primary],
              ),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'SALDO ACUMULADO',
                  style: TextStyle(
                    color: AquiLogColors.primarySoft,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  data == null
                      ? (loading ? '...' : formatCents(0))
                      : formatCents(data.availableCents),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Cada entrega concluída credita o seu repasse aqui.',
                  style: TextStyle(
                    color: AquiLogColors.primarySoft,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: AquiLogColors.muted),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'O repasse das corridas fica registrado nesta carteira. '
                      'O saque ainda é feito pela equipe do Aqui Log — o '
                      'pagamento automático está em preparação.',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            'Extrato',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 10),
          if (loading && entries.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (entries.isEmpty)
            const Text(
              'Sem lançamentos ainda. Conclua uma corrida para o primeiro '
              'repasse aparecer aqui.',
              style: TextStyle(color: AquiLogColors.muted),
            )
          else
            ...entries.map(_linha),
        ],
      ),
    );
  }

  Widget _linha(WalletEntry entry) {
    final entrada = entry.amountCents >= 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (entrada ? AquiLogColors.success : Colors.red)
              .withValues(alpha: .12),
          child: Icon(
            entrada ? Icons.south_west_rounded : Icons.north_east_rounded,
            color: entrada ? AquiLogColors.success : Colors.red,
            size: 20,
          ),
        ),
        title: Text(
          entry.description.isEmpty ? entry.type : entry.description,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: entry.createdAt == null ? null : Text(_data(entry.createdAt!)),
        trailing: Text(
          formatCents(entry.amountCents),
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: entrada ? AquiLogColors.success : Colors.red,
          ),
        ),
      ),
    );
  }

  static String _data(DateTime value) {
    final local = value.toLocal();
    String dois(int n) => n.toString().padLeft(2, '0');
    return '${dois(local.day)}/${dois(local.month)}/${local.year} '
        '${dois(local.hour)}:${dois(local.minute)}';
  }
}
