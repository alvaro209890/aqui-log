import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

class DeliveryDetailScreen extends StatelessWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.delivery,
    required this.onProof,
    required this.onStatus,
  });

  final DeliverySummary delivery;
  final VoidCallback onProof;
  final Future<void> Function(String status, {String? proofUrl}) onStatus;

  Future<void> _openMaps(double lat, double lng) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
    );
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final d = delivery;
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
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onProof,
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Enviar comprovante'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => onStatus('AT_PICKUP'),
            child: const Text('Cheguei na coleta'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => onStatus('IN_TRANSIT'),
            child: const Text('Sai para entrega'),
          ),
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
