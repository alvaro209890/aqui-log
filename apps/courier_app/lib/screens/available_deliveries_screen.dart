import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// Available offers with embedded OSM map pins from delivery coords.
class AvailableDeliveriesScreen extends StatelessWidget {
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

  List<LatLng> get _pins {
    final points = <LatLng>[];
    for (final offer in offers) {
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
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  available ? 'Voce esta disponivel' : 'Voce esta offline',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              Switch(value: available, onChanged: onToggleAvailable),
            ],
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
            '${offers.length} oferta(s) no mapa',
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
          if (loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (offers.isEmpty)
            const Text(
              'Nenhuma oferta no momento. Fique online para receber corridas.',
              style: TextStyle(color: AquiLogColors.muted),
            )
          else
            ...offers.map((offer) {
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
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: () => onAccept(id),
                              child: const Text('Aceitar'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => onReject(id),
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

  static String _weight(OrderMeta meta) {
    final weight = meta.weightKg;
    if (weight == null) return 'peso n/i';
    return '${weight.toStringAsFixed(1).replaceAll('.', ',')} kg';
  }
}
