import 'package:flutter/material.dart';
import 'theme.dart';

class AquiLogBrand extends StatelessWidget {
  const AquiLogBrand({super.key, this.inverse = false});

  final bool inverse;

  @override
  Widget build(BuildContext context) {
    final color = inverse ? Colors.white : AquiLogColors.ink;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: inverse ? AquiLogColors.primarySoft : AquiLogColors.primary,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.route_rounded,
            color: inverse ? AquiLogColors.primaryDark : Colors.white,
            size: 22,
          ),
        ),
        const SizedBox(width: 10),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: 'AQUI ',
                style: TextStyle(color: color),
              ),
              TextSpan(
                text: 'LOG',
                style: TextStyle(
                  color: inverse
                      ? AquiLogColors.primarySoft
                      : AquiLogColors.primary,
                ),
              ),
            ],
          ),
          style: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
          ),
        ),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill(this.label, {super.key, this.color});

  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final resolved = color ?? _statusColor(label);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: resolved.withValues(alpha: .13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _statusLabel(label),
        style: TextStyle(
          color: color == null ? _statusTextColor(label) : resolved,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  static Color _statusColor(String status) => switch (status) {
    'DELIVERED' => AquiLogColors.success,
    'CANCELED' => AquiLogColors.error,
    'PICKED_UP' || 'IN_TRANSIT' => AquiLogColors.info,
    'REQUESTED' || 'OFFERED' => AquiLogColors.warning,
    'ACCEPTED' || 'AT_PICKUP' => AquiLogColors.primary,
    _ => AquiLogColors.muted,
  };

  static Color _statusTextColor(String status) => switch (status) {
    'DELIVERED' => AquiLogColors.successText,
    'CANCELED' => AquiLogColors.errorText,
    'PICKED_UP' || 'IN_TRANSIT' => AquiLogColors.infoText,
    'REQUESTED' || 'OFFERED' => AquiLogColors.warningText,
    'ACCEPTED' || 'AT_PICKUP' => AquiLogColors.primaryDark,
    _ => AquiLogColors.ink,
  };

  static String _statusLabel(String status) => switch (status) {
    'REQUESTED' => 'Aguardando',
    'OFFERED' => 'Em oferta',
    'ACCEPTED' => 'Aceita',
    'AT_PICKUP' => 'Na coleta',
    'PICKED_UP' => 'Coletada',
    'IN_TRANSIT' => 'Em trânsito',
    'DELIVERED' => 'Entregue',
    'CANCELED' => 'Cancelada',
    _ => status,
  };
}
