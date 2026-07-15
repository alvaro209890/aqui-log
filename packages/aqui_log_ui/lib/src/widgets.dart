import 'package:flutter/material.dart';
import 'theme.dart';

class AquiLogBrand extends StatelessWidget {
  const AquiLogBrand({super.key, this.inverse = false});

  final bool inverse;

  @override
  Widget build(BuildContext context) {
    final color = inverse ? Colors.white : AquiLogColors.forest;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: inverse ? AquiLogColors.mint : AquiLogColors.forest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.route_rounded,
            color: inverse ? AquiLogColors.forest : Colors.white,
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
              const TextSpan(
                text: 'LOG',
                style: TextStyle(color: AquiLogColors.mint),
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
  const StatusPill(this.label, {super.key, this.color = AquiLogColors.mint});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .15),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: Color.alphaBlend(color, AquiLogColors.forestDark),
        fontSize: 11,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}
