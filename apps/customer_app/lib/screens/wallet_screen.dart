import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

/// Carteira do cliente (PAY-01 / `DEC-05`).
///
/// O produto é pré-pago: publicar um pedido reserva o preço no ledger interno e
/// a API responde `402` quando não há saldo. Sem esta tela o cliente veria o
/// `402` sem nenhum lugar onde conferir quanto tem — por isso ela mostra saldo
/// disponível, reservado e o extrato.
///
/// Recarga por PIX/cartão é `PAY-02` (Pagar.me, `DEC-06`); enquanto ela não
/// existe, o crédito entra por operação administrativa auditada e a tela diz
/// isso em vez de oferecer um botão que ainda não faz nada.
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key, required this.loadStatement});

  final Future<WalletStatement> Function() loadStatement;

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  WalletStatement? statement;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await widget.loadStatement();
      if (!mounted) return;
      setState(() {
        statement = data;
        loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = 'Não foi possível carregar a carteira: $e';
        loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = statement;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Minha carteira'),
        actions: [
          IconButton(
            onPressed: loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Atualizar',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          children: [
            if (loading && data == null)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red))
            else if (data != null) ...[
              _saldoCard(data),
              const SizedBox(height: 16),
              _avisoRecarga(),
              const SizedBox(height: 24),
              const Text(
                'Extrato',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              if (data.entries.isEmpty)
                const Text(
                  'Nenhum lançamento ainda.',
                  style: TextStyle(color: AquiLogColors.muted),
                )
              else
                ...data.entries.map(_linhaExtrato),
            ],
          ],
        ),
      ),
    );
  }

  Widget _saldoCard(WalletStatement data) => Container(
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
          'SALDO DISPONÍVEL',
          style: TextStyle(
            color: AquiLogColors.primarySoft,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          formatCents(data.availableCents),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: _mini('Reservado', formatCents(data.reservedCents)),
            ),
            Expanded(child: _mini('Total', formatCents(data.balanceCents))),
          ],
        ),
      ],
    ),
  );

  Widget _mini(String label, String value) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: AquiLogColors.primarySoft,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );

  Widget _avisoRecarga() => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: AquiLogColors.muted),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Cada pedido reserva o valor da entrega no seu saldo e só é '
              'cobrado quando a encomenda é entregue. Se o pedido for '
              'cancelado, o valor volta para o disponível.\n\n'
              'A recarga por PIX e cartão ainda está em preparação: por '
              'enquanto o crédito é liberado pela equipe do Aqui Log.',
              style: TextStyle(color: AquiLogColors.muted, fontSize: 13),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _linhaExtrato(WalletEntry entry) {
    final entrada = entry.amountCents >= 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (entrada ? const Color(0xFF3BA87D) : Colors.red)
              .withValues(alpha: .12),
          child: Icon(
            entrada ? Icons.south_west_rounded : Icons.north_east_rounded,
            color: entrada ? const Color(0xFF3BA87D) : Colors.red,
            size: 20,
          ),
        ),
        title: Text(
          entry.description.isEmpty ? entry.type : entry.description,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        subtitle: entry.createdAt == null
            ? null
            : Text(_data(entry.createdAt!)),
        trailing: Text(
          formatCents(entry.amountCents),
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: entrada ? const Color(0xFF3BA87D) : Colors.red,
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
