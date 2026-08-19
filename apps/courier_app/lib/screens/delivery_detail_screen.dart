import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

class DeliveryDetailScreen extends StatefulWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.delivery,
    required this.onProof,
    required this.onStatus,
    this.onCancel,
  });

  final DeliverySummary delivery;
  final VoidCallback onProof;
  final Future<void> Function(String status, {String? proofUrl}) onStatus;

  /// COUR-02: desistência com taxa. Nulo quando o servidor não autoriza.
  final Future<void> Function()? onCancel;

  @override
  State<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends State<DeliveryDetailScreen> {
  /// Transição em curso. O servidor é a autoridade sobre o que é permitido
  /// (`409` fora da janela do agendado, por exemplo); até esta rodada a
  /// chamada era disparada e esquecida, então uma recusa do servidor não
  /// aparecia em lugar nenhum e o entregador achava que tinha dado certo.
  String? enviando;

  Future<void> _cancelarCorrida() async {
    final onCancel = widget.onCancel;
    if (onCancel == null) return;
    final fee = widget.delivery.courierCancelFeeCents ?? 0;
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancelar esta corrida?'),
        content: Text(
          fee > 0
              ? 'Serão debitados ${formatCents(fee)} do seu saldo. O pedido volta para a busca de outro entregador.'
              : 'O pedido volta para a busca de outro entregador. Não há taxa nesta corrida.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Voltar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Cancelar mesmo assim'),
          ),
        ],
      ),
    );
    if (confirmar != true || !mounted) return;
    setState(() => enviando = 'CANCEL');
    try {
      await onCancel();
      if (!mounted) return;
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException
          ? e.message
          : 'Não foi possível cancelar a corrida. Tente de novo.';
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => enviando = null);
    }
  }

  Future<void> _mudarStatus(String status) async {
    setState(() => enviando = status);
    try {
      await widget.onStatus(status);
      if (!mounted) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text('Status atualizado: ${_rotulo(status)}')),
      );
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException
          ? e.message
          : 'Não foi possível atualizar o status. Tente de novo.';
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => enviando = null);
    }
  }

  static String _rotulo(String status) => switch (status) {
    'AT_PICKUP' => 'na coleta',
    'IN_TRANSIT' => 'a caminho da entrega',
    _ => status,
  };

  Future<void> _openMaps(double lat, double lng) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.delivery;
    final meta = d.orderMeta ?? OrderMeta.fromNotes(d.notes);
    final hasPickup = d.pickupLatitude != null && d.pickupLongitude != null;
    final hasDrop = d.deliveryLatitude != null && d.deliveryLongitude != null;

    return Scaffold(
      appBar: AppBar(title: Text(d.code)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(d.status),
                  const SizedBox(height: 12),
                  Text(
                    d.code,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (d.pickupAddress != null) ...[
                    const SizedBox(height: 12),
                    Text('Coleta: ${d.pickupAddress}'),
                  ],
                  if (d.deliveryAddress != null)
                    Text('Entrega: ${d.deliveryAddress}'),
                  // SCHED-01: no agendado, a janela combinada é a informação
                  // que decide o dia do prestador.
                  if (d.isScheduled) ...[
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        const Icon(
                          Icons.event_available_outlined,
                          size: 18,
                          color: AquiLogColors.primaryDark,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            formatPickupWindow(
                              d.pickupWindowStart,
                              d.pickupWindowEnd,
                            ),
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AquiLogColors.primaryDark,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (d.scheduledAhead)
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Text(
                          'Na agenda. A coleta so abre no inicio da janela.',
                          style: TextStyle(
                            color: AquiLogColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ),
          if (meta != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Encomenda',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${meta.productType} · ${meta.size}${_weight(meta)}',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      meta.scope,
                      style: const TextStyle(color: AquiLogColors.muted),
                    ),
                    if (meta.notes != null && meta.notes!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(meta.notes!),
                    ],
                    if (meta.photoUrl != null) ...[
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          meta.photoUrl!,
                          height: 150,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Container(
                            height: 100,
                            color: AquiLogColors.line,
                            alignment: Alignment.center,
                            child: const Icon(Icons.broken_image_outlined),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
          if (hasPickup || hasDrop) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 180,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(
                      d.pickupLatitude ?? d.deliveryLatitude!,
                      d.pickupLongitude ?? d.deliveryLongitude!,
                    ),
                    initialZoom: 13,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'br.com.aquilog.entregador',
                    ),
                    MarkerLayer(
                      markers: [
                        if (hasPickup)
                          Marker(
                            point: LatLng(
                              d.pickupLatitude!,
                              d.pickupLongitude!,
                            ),
                            width: 36,
                            height: 36,
                            child: const Icon(
                              Icons.storefront,
                              color: AquiLogColors.primary,
                            ),
                          ),
                        if (hasDrop)
                          Marker(
                            point: LatLng(
                              d.deliveryLatitude!,
                              d.deliveryLongitude!,
                            ),
                            width: 36,
                            height: 36,
                            child: const Icon(
                              Icons.flag,
                              color: Color(0xFFE29149),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (hasDrop)
              TextButton.icon(
                onPressed: () =>
                    _openMaps(d.deliveryLatitude!, d.deliveryLongitude!),
                icon: const Icon(Icons.navigation_outlined),
                label: const Text('Abrir no Google Maps'),
              ),
          ],
          if (d.pickupCodeRequired) ...[
            const SizedBox(height: 12),
            Card(
              color: AquiLogColors.primarySoft,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Row(
                  children: [
                    const Icon(Icons.pin_outlined, color: AquiLogColors.primaryDark),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        d.pickupCodeBlocked
                            ? 'Coleta bloqueada por tentativas erradas do código. Fale com o suporte.'
                            : 'A coleta exige o código de 4 dígitos que o cliente vai mostrar.',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          // O repasse desta corrida: é o que o entregador ganha ao concluir.
          if (d.courierFeeCents != null) ...[
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(
                      Icons.payments_outlined,
                      color: AquiLogColors.success,
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Seu repasse',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    Text(
                      formatCents(d.courierFeeCents!),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AquiLogColors.success,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: widget.onProof,
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Enviar comprovante'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            // DEC-20: antes da janela o servidor recusa a transicao; deixar o
            // botao ativo so produziria um erro que o prestador nao pediu.
            onPressed: d.scheduledAhead || enviando != null
                ? null
                : () => _mudarStatus('AT_PICKUP'),
            child: Text(
              d.scheduledAhead
                  ? 'Coleta abre em ${formatPickupWindow(d.pickupWindowStart, d.pickupWindowEnd)}'
                  : enviando == 'AT_PICKUP'
                  ? 'Enviando...'
                  : 'Cheguei na coleta',
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: enviando != null
                ? null
                : () => _mudarStatus('IN_TRANSIT'),
            child: Text(
              enviando == 'IN_TRANSIT' ? 'Enviando...' : 'Sai para entrega',
            ),
          ),
          if (d.courierCancelAllowed && widget.onCancel != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: enviando != null ? null : _cancelarCorrida,
              style: OutlinedButton.styleFrom(
                foregroundColor: AquiLogColors.errorText,
              ),
              child: Text(
                enviando == 'CANCEL' ? 'Cancelando...' : 'Cancelar corrida',
              ),
            ),
          ],
        ],
      ),
    );
  }

  static String _weight(OrderMeta meta) {
    final value = meta.weightKg;
    if (value == null) return '';
    return ' · ${value.toStringAsFixed(1).replaceAll('.', ',')} kg';
  }
}
