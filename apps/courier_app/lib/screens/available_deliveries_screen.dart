import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Available offers with embedded OSM map pins from delivery coords.
class AvailableDeliveriesScreen extends StatefulWidget {
  const AvailableDeliveriesScreen({
    super.key,
    required this.offers,
    required this.loading,
    required this.available,
    required this.onToggleAvailable,
    required this.onAccept,
    required this.onReject,
    required this.onRefresh,
  });

  final List<Map<String, dynamic>> offers;
  final bool loading;
  final bool available;
  final ValueChanged<bool> onToggleAvailable;
  final Future<void> Function(String offerId) onAccept;
  final Future<void> Function(String offerId) onReject;
  final Future<void> Function() onRefresh;

  @override
  State<AvailableDeliveriesScreen> createState() =>
      _AvailableDeliveriesScreenState();
}

class _AvailableDeliveriesScreenState extends State<AvailableDeliveriesScreen> {
  /// Oferta cuja decisão está em curso. A oferta tem TTL e pode ser aceita por
  /// outro entregador no meio do caminho: sem travar o card, um toque duplo
  /// dispara duas chamadas e a segunda volta erro sem explicação.
  String? decidindo;
  String? erro;

  Future<void> _decidir(
    String id,
    Future<void> Function(String) acao,
  ) async {
    setState(() {
      decidindo = id;
      erro = null;
    });
    try {
      await acao(id);
    } catch (e) {
      if (!mounted) return;
      // 409/404 aqui quase sempre significa "a oferta já não é sua" — expirou
      // ou outro entregador aceitou. Dizer isso vale mais que o texto cru.
      final msg = e is ApiException
          ? (e.statusCode == 404 || e.statusCode == 409
                ? 'Essa oferta não está mais disponível.'
                : e.message)
          : 'Não foi possível concluir. Tente de novo.';
      setState(() => erro = msg);
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => decidindo = null);
    }
  }

  List<LatLng> get _pins {
    final points = <LatLng>[];
    for (final offer in widget.offers) {
      final delivery = offer['delivery'];
      if (delivery is Map) {
        final lat = delivery['pickupLatitude'];
        final lng = delivery['pickupLongitude'];
        final la = lat is num ? lat.toDouble() : double.tryParse('$lat');
        final lo = lng is num ? lng.toDouble() : double.tryParse('$lng');
        if (la != null && lo != null) points.add(LatLng(la, lo));
      }
    }
    return points;
  }

  @override
  Widget build(BuildContext context) {
    final pins = _pins;
    final center = pins.isNotEmpty
        ? pins.first
        : const LatLng(-15.601, -56.097);

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.available
                      ? 'Voce esta disponivel'
                      : 'Voce esta offline',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              Switch(
                value: widget.available,
                onChanged: widget.onToggleAvailable,
              ),
            ],
          ),
          // Offline o servidor não oferta nada; sem este aviso o entregador
          // fica olhando uma lista vazia sem saber que ele mesmo desligou.
          if (!widget.available)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text(
                'Offline você não recebe ofertas. Ligue o botão acima para '
                'voltar a receber corridas.',
                style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
              ),
            ),
          const SizedBox(height: 12),
          SizedBox(
            height: 180,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: FlutterMap(
                options: MapOptions(
                  initialCenter: center,
                  initialZoom: pins.isEmpty ? 11 : 13,
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'br.com.aquilog.entregador',
                  ),
                  MarkerLayer(
                    markers: [
                      for (final p in pins)
                        Marker(
                          point: p,
                          width: 36,
                          height: 36,
                          child: const Icon(
                            Icons.location_on,
                            color: AquiLogColors.primary,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${widget.offers.length} oferta(s) no mapa',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AquiLogColors.muted,
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'Ofertas disponiveis',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          if (widget.loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (widget.offers.isEmpty)
            const Text(
              'Nenhuma oferta no momento. Fique online para receber corridas.',
              style: TextStyle(color: AquiLogColors.muted),
            )
          else
            ...widget.offers.map((offer) {
              final id = '${offer['id']}';
              final delivery = offer['delivery'];
              final code = delivery is Map ? '${delivery['code'] ?? id}' : id;
              final pickup = delivery is Map
                  ? '${delivery['pickupAddress'] ?? ''}'
                  : '';
              final drop = delivery is Map
                  ? '${delivery['deliveryAddress'] ?? ''}'
                  : '';
              final meta = delivery is Map
                  ? OrderMeta.fromDeliveryJson(
                      Map<String, dynamic>.from(delivery),
                    )
                  : null;
              // SCHED-01 / DEC-20: o agendado aparece na mesma lista e pode
              // ser aceito agora — o prestador precisa ver a janela ANTES de
              // aceitar, senão ele reserva um horário sem saber qual.
              //
              // Lê direto do mapa da oferta em vez de montar um
              // `DeliverySummary`: o card já trabalha assim e não deve quebrar
              // por causa de um campo ausente numa oferta.
              final scheduled = delivery is Map &&
                  delivery['fulfillmentMode'] == FulfillmentMode.scheduled;
              final windowStart = delivery is Map
                  ? _parseDate(delivery['pickupWindowStart'])
                  : null;
              final windowEnd = delivery is Map
                  ? _parseDate(delivery['pickupWindowEnd'])
                  : null;
              // O repasse é o número que decide o aceite. Ele já vinha no
              // payload da oferta (`present()` não corta `courierFeeCents`
              // para o COURIER), mas o card não mostrava — o entregador
              // aceitava sem saber quanto ganha.
              final repasseRaw = delivery is Map
                  ? delivery['courierFeeCents']
                  : null;
              final repasse = repasseRaw is num ? repasseRaw.toInt() : null;
              final ocupado = decidindo != null;
              final decidindoEste = decidindo == id;
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              code,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          if (meta != null)
                            Text(
                              '${meta.size} · ${_weight(meta)}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AquiLogColors.primaryDark,
                              ),
                            ),
                        ],
                      ),
                      if (meta != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.inventory_2_outlined,
                              size: 15,
                              color: AquiLogColors.muted,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                '${meta.productType} · ${meta.scope}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: AquiLogColors.ink,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (scheduled) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AquiLogColors.primarySoft,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.event_available_outlined,
                                size: 15,
                                color: AquiLogColors.primaryDark,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Agendado · ${formatPickupWindow(windowStart, windowEnd)}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AquiLogColors.primaryDark,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Aceitando agora voce reserva essa janela; a coleta '
                          'so abre no horario combinado.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AquiLogColors.muted,
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      if (pickup.isNotEmpty) Text('Coleta: $pickup'),
                      if (drop.isNotEmpty) Text('Entrega: $drop'),
                      if (meta?.photoUrl != null &&
                          meta!.photoUrl!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            meta.photoUrl!,
                            height: 120,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => const SizedBox.shrink(),
                          ),
                        ),
                      ],
                      if (repasse != null) ...[
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: AquiLogColors.success.withValues(alpha: .10),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.payments_outlined,
                                size: 18,
                                color: AquiLogColors.success,
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Você recebe',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const Spacer(),
                              Text(
                                formatCents(repasse),
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AquiLogColors.success,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: ocupado
                                  ? null
                                  : () => _decidir(id, widget.onAccept),
                              child: decidindoEste
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Text('Aceitar'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: ocupado
                                  ? null
                                  : () => _decidir(id, widget.onReject),
                              child: const Text('Recusar'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value is! String || value.isEmpty) return null;
    return DateTime.tryParse(value)?.toLocal();
  }

  static String _weight(OrderMeta meta) {
    final weight = meta.weightKg;
    if (weight == null) return 'peso n/i';
    return '${weight.toStringAsFixed(1).replaceAll('.', ',')} kg';
  }
}
