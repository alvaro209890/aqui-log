import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

/// COUR-01 / DEC-21 — as corridas do prestador em duas seções de trabalho.
///
/// *Em andamento* é o que ele faz agora; *Agenda* é o que ele reservou para
/// depois (aceite antecipado, `DEC-20`). Misturar as duas na mesma lista, como
/// era até aqui, faz um agendado de amanhã disputar atenção com a coleta que
/// está acontecendo.
///
/// A terceira aba guarda o que já encerrou: a lista antiga mostrava tudo, e
/// tirar o histórico junto com a separação seria remover função sem pedido.
///
/// Ofertas (auto-dispatch) **não** entram aqui — corrida ofertada ainda não é
/// dele, e continua na aba *Ofertas*.
class MyDeliveriesScreen extends StatelessWidget {
  const MyDeliveriesScreen({
    super.key,
    required this.deliveries,
    required this.loading,
    required this.onOpen,
    required this.onRefresh,
  });

  final List<DeliverySummary> deliveries;
  final bool loading;
  final void Function(DeliverySummary) onOpen;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    if (loading && deliveries.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    final board = CourierBoard.from(deliveries);

    return DefaultTabController(
      length: 3,
      child: Column(
        children: [
          TabBar(
            labelColor: AquiLogColors.primaryDark,
            unselectedLabelColor: AquiLogColors.muted,
            indicatorColor: AquiLogColors.primary,
            labelStyle: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
            tabs: [
              Tab(text: _rotulo('Em andamento', board.emAndamento.length)),
              Tab(text: _rotulo('Agenda', board.agenda.length)),
              Tab(text: _rotulo('Concluídas', board.concluidas.length)),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                _Secao(
                  deliveries: board.emAndamento,
                  vazio: 'Nenhuma corrida em andamento agora.',
                  onOpen: onOpen,
                  onRefresh: onRefresh,
                ),
                _Secao(
                  deliveries: board.agenda,
                  vazio:
                      'Nada agendado. Aceite um pedido agendado para reservar '
                      'a janela.',
                  onOpen: onOpen,
                  onRefresh: onRefresh,
                ),
                _Secao(
                  deliveries: board.concluidas,
                  vazio: 'Nenhuma corrida encerrada ainda.',
                  onOpen: onOpen,
                  onRefresh: onRefresh,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _rotulo(String nome, int quantidade) =>
      quantidade == 0 ? nome : '$nome ($quantidade)';
}

class _Secao extends StatelessWidget {
  const _Secao({
    required this.deliveries,
    required this.vazio,
    required this.onOpen,
    required this.onRefresh,
  });

  final List<DeliverySummary> deliveries;
  final String vazio;
  final void Function(DeliverySummary) onOpen;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: deliveries.isEmpty
          ? ListView(
              children: [
                const SizedBox(height: 72),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      vazio,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AquiLogColors.muted),
                    ),
                  ),
                ),
              ],
            )
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
              itemCount: deliveries.length,
              itemBuilder: (context, index) => CorridaCard(
                delivery: deliveries[index],
                onTap: () => onOpen(deliveries[index]),
              ),
            ),
    );
  }
}

/// Cartão de corrida do prestador (plano §5.2): código, modo, janela,
/// endereços, encomenda, repasse e status.
///
/// O cancelamento com taxa (`COUR-02`) fica no detalhe, com confirmação da
/// multa — o cartão só abre o fluxo.
class CorridaCard extends StatelessWidget {
  const CorridaCard({super.key, required this.delivery, required this.onTap});

  final DeliverySummary delivery;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final d = delivery;
    final meta = d.orderMeta ?? OrderMeta.fromNotes(d.notes);
    final foto = meta?.photoUrl;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        // Toque abre o fluxo de detalhe/execução que já existe.
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      d.code,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  StatusPill(d.status),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    d.isScheduled
                        ? Icons.event_available_outlined
                        : Icons.bolt_outlined,
                    size: 15,
                    color: AquiLogColors.primaryDark,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    FulfillmentMode.label(d.fulfillmentMode),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AquiLogColors.primaryDark,
                    ),
                  ),
                ],
              ),
              // A janela só existe no agendado, e é ela que define o dia do
              // prestador — no card ela vem antes até dos endereços.
              if (d.isScheduled) ...[
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AquiLogColors.primarySoft,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Coleta: ${formatPickupWindow(d.pickupWindowStart, d.pickupWindowEnd)}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AquiLogColors.primaryDark,
                        ),
                      ),
                      if (d.deliveryWindowStart != null)
                        Text(
                          'Entrega: ${formatPickupWindow(d.deliveryWindowStart, d.deliveryWindowEnd)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AquiLogColors.primaryDark,
                          ),
                        ),
                      if (d.scheduledAhead)
                        const Text(
                          'Na agenda. A coleta so abre no inicio da janela.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AquiLogColors.muted,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 8),
              if (d.pickupAddress != null)
                _Linha(icone: Icons.storefront_outlined, texto: d.pickupAddress!),
              if (d.deliveryAddress != null)
                _Linha(icone: Icons.flag_outlined, texto: d.deliveryAddress!),
              if (meta != null) ...[
                const SizedBox(height: 6),
                _Linha(
                  icone: Icons.inventory_2_outlined,
                  texto: '${meta.productType} · ${meta.size}${_peso(meta)}',
                ),
              ],
              if (foto != null && foto.isNotEmpty) ...[
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    foto,
                    height: 110,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ],
              if (d.courierFeeCents != null) ...[
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Text(
                      'Seu repasse',
                      style: TextStyle(
                        fontSize: 12,
                        color: AquiLogColors.muted,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      _reais(d.courierFeeCents!),
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _peso(OrderMeta meta) {
    final peso = meta.weightKg;
    if (peso == null) return '';
    return ' · ${peso.toStringAsFixed(1).replaceAll('.', ',')} kg';
  }

  static String _reais(int cents) =>
      'R\$ ${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')}';
}

class _Linha extends StatelessWidget {
  const _Linha({required this.icone, required this.texto});

  final IconData icone;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icone, size: 15, color: AquiLogColors.muted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              texto,
              style: const TextStyle(fontSize: 13, color: AquiLogColors.ink),
            ),
          ),
        ],
      ),
    );
  }
}
