import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

/// Available offers with a simple map canvas (no device map SDK required in tests).
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

  @override
  Widget build(BuildContext context) {
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
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
              ),
              Switch(
                value: available,
                onChanged: onToggleAvailable,
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Map surface for available deliveries (UI map; GPS plugins optional).
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: const Color(0xFFE8EEE9),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AquiLogColors.line),
            ),
            child: Stack(
              children: [
                Positioned.fill(child: CustomPaint(painter: _MapGridPainter())),
                const Positioned(
                  left: 24,
                  top: 40,
                  child: _MapPin(color: AquiLogColors.forest, icon: Icons.storefront),
                ),
                const Positioned(
                  right: 36,
                  bottom: 36,
                  child: _MapPin(color: Color(0xFFE29149), icon: Icons.flag),
                ),
                Positioned(
                  left: 12,
                  bottom: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .92),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '${offers.length} oferta(s) no mapa',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
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
              final id = '${offer['id'] ?? ''}';
              final delivery = offer['delivery'];
              final code = delivery is Map
                  ? '${delivery['code'] ?? id}'
                  : id;
              final pickup = delivery is Map
                  ? '${delivery['pickupAddress'] ?? 'Coleta'}'
                  : 'Coleta';
              final dest = delivery is Map
                  ? '${delivery['deliveryAddress'] ?? 'Entrega'}'
                  : 'Entrega';
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(code, style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text('$pickup → $dest', style: const TextStyle(color: AquiLogColors.muted, fontSize: 12)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: id.isEmpty ? null : () => onReject(id),
                              child: const Text('Recusar'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 2,
                            child: FilledButton(
                              onPressed: id.isEmpty ? null : () => onAccept(id),
                              child: const Text('Aceitar'),
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
}

class _MapPin extends StatelessWidget {
  const _MapPin({required this.color, required this.icon});
  final Color color;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(
    width: 34,
    height: 34,
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3),
    ),
    child: Icon(icon, color: Colors.white, size: 16),
  );
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white70
      ..strokeWidth = 1;
    for (var i = 0; i < 8; i++) {
      final dy = size.height * (i / 7);
      canvas.drawLine(Offset(0, dy), Offset(size.width, dy), paint);
      final dx = size.width * (i / 7);
      canvas.drawLine(Offset(dx, 0), Offset(dx, size.height), paint);
    }
    final route = Paint()
      ..color = AquiLogColors.mint
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(30, size.height * .7)
      ..quadraticBezierTo(size.width * .5, 20, size.width - 40, size.height * .55);
    canvas.drawPath(path, route);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
