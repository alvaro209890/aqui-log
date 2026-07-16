import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class DeliveryDetailScreen extends StatefulWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.delivery,
    required this.loadHistory,
    required this.onRate,
  });

  final DeliverySummary delivery;
  final Future<List<dynamic>> Function() loadHistory;
  final Future<void> Function(int score, String? comment) onRate;

  @override
  State<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends State<DeliveryDetailScreen> {
  List<dynamic> history = [];
  bool loading = true;
  int score = 5;
  final comment = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      history = await widget.loadHistory();
    } catch (_) {}
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.delivery;
    final hasCoords =
        d.pickupLatitude != null &&
        d.pickupLongitude != null &&
        d.deliveryLatitude != null &&
        d.deliveryLongitude != null;

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
                  const Text(
                    'Status',
                    style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  StatusPill(d.status),
                  const SizedBox(height: 16),
                  Text(
                    d.code,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  if (d.recipientName != null) ...[
                    const SizedBox(height: 8),
                    Text('Destinatario: ${d.recipientName}'),
                  ],
                  if (d.pickupAddress != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Coleta',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    Text(d.pickupAddress!),
                  ],
                  if (d.deliveryAddress != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Entrega',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    Text(d.deliveryAddress!),
                  ],
                ],
              ),
            ),
          ),
          if (hasCoords) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(
                      d.pickupLatitude!,
                      d.pickupLongitude!,
                    ),
                    initialZoom: 12,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'br.com.aquilog.empresa',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(
                            d.pickupLatitude!,
                            d.pickupLongitude!,
                          ),
                          width: 40,
                          height: 40,
                          child: const Icon(
                            Icons.storefront,
                            color: AquiLogColors.forest,
                          ),
                        ),
                        Marker(
                          point: LatLng(
                            d.deliveryLatitude!,
                            d.deliveryLongitude!,
                          ),
                          width: 40,
                          height: 40,
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
          ],
          const SizedBox(height: 16),
          const Text(
            'Historico',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 8),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (history.isEmpty)
            const Text(
              'Sem eventos ainda.',
              style: TextStyle(color: AquiLogColors.muted),
            )
          else
            ...history.map((raw) {
              final e = raw is Map<String, dynamic>
                  ? raw
                  : Map<String, dynamic>.from(raw as Map);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${e['status'] ?? ''}'),
                subtitle: Text('${e['note'] ?? e['createdAt'] ?? ''}'),
              );
            }),
          if (d.status == 'DELIVERED') ...[
            const Divider(height: 32),
            const Text(
              'Avaliar entrega',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            Slider(
              value: score.toDouble(),
              min: 1,
              max: 5,
              divisions: 4,
              label: '$score',
              onChanged: (v) => setState(() => score = v.round()),
            ),
            TextField(
              controller: comment,
              decoration: const InputDecoration(labelText: 'Comentario'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                await widget.onRate(
                  score,
                  comment.text.trim().isEmpty ? null : comment.text.trim(),
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Avaliacao enviada')),
                  );
                }
              },
              child: const Text('Enviar avaliacao'),
            ),
          ],
        ],
      ),
    );
  }
}
