import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

void main() => runApp(const CourierApp());

class CourierApp extends StatelessWidget {
  const CourierApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Aqui Log Entregador',
    debugShowCheckedModeBanner: false,
    theme: AquiLogTheme.light(),
    home: const CourierHomePage(),
  );
}

class CourierHomePage extends StatefulWidget {
  const CourierHomePage({super.key});

  @override
  State<CourierHomePage> createState() => _CourierHomePageState();
}

class _CourierHomePageState extends State<CourierHomePage> {
  bool available = true;
  int currentIndex = 0;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      toolbarHeight: 76,
      title: const AquiLogBrand(),
      actions: [
        IconButton(
          onPressed: () {},
          icon: const Badge(
            smallSize: 7,
            child: Icon(Icons.notifications_none_rounded),
          ),
        ),
        const SizedBox(width: 10),
      ],
    ),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 28),
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Ola, Rafael',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Pronto para rodar?',
                      style: TextStyle(color: AquiLogColors.muted),
                    ),
                  ],
                ),
              ),
              CircleAvatar(
                radius: 23,
                backgroundColor: AquiLogColors.forest,
                child: Text(
                  'RS',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: available ? const Color(0xFFE1F5ED) : Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: available ? const Color(0xFFB9E7D4) : AquiLogColors.line,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 43,
                  height: 43,
                  decoration: BoxDecoration(
                    color: available
                        ? AquiLogColors.forest
                        : AquiLogColors.line,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    available
                        ? Icons.wifi_tethering_rounded
                        : Icons.power_settings_new_rounded,
                    color: available ? AquiLogColors.mint : AquiLogColors.muted,
                  ),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        available
                            ? 'Voce esta disponivel'
                            : 'Voce esta offline',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        available
                            ? 'Recebendo novas ofertas'
                            : 'Ative para receber corridas',
                        style: const TextStyle(
                          color: AquiLogColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: available,
                  activeTrackColor: AquiLogColors.mint,
                  activeThumbColor: AquiLogColors.forest,
                  onChanged: (value) => setState(() => available = value),
                ),
              ],
            ),
          ),
          const SizedBox(height: 23),
          const Row(
            children: [
              Expanded(
                child: _EarningCard(
                  value: 'R\$ 186,40',
                  label: 'GANHOS HOJE',
                  icon: Icons.account_balance_wallet_outlined,
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: _EarningCard(
                  value: '8',
                  label: 'ENTREGAS',
                  icon: Icons.check_circle_outline_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Nova oferta',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              StatusPill('Agora'),
            ],
          ),
          const SizedBox(height: 13),
          Card(
            child: Column(
              children: [
                Container(
                  height: 105,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE8EEE9),
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(18),
                    ),
                  ),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: CustomPaint(painter: _RoutePainter()),
                      ),
                      const Positioned(
                        left: 22,
                        top: 22,
                        child: _MapPoint(
                          icon: Icons.storefront_rounded,
                          color: AquiLogColors.forest,
                        ),
                      ),
                      const Positioned(
                        right: 27,
                        bottom: 18,
                        child: _MapPoint(
                          icon: Icons.flag_rounded,
                          color: Color(0xFFE29149),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    children: [
                      const Row(
                        children: [
                          Expanded(
                            child: _RouteInfo(
                              label: 'COLETA',
                              value: 'Padaria Primavera',
                              detail: 'Av. Brasil, 420',
                            ),
                          ),
                          Icon(
                            Icons.arrow_forward_rounded,
                            color: AquiLogColors.muted,
                            size: 19,
                          ),
                          SizedBox(width: 12),
                          Expanded(
                            child: _RouteInfo(
                              label: 'ENTREGA',
                              value: 'Marina Costa',
                              detail: 'Rua Ceara, 1220',
                            ),
                          ),
                        ],
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 17),
                        child: Divider(height: 1),
                      ),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _OfferData(
                            icon: Icons.route_rounded,
                            value: '6,8 km',
                          ),
                          _OfferData(
                            icon: Icons.schedule_rounded,
                            value: '~ 24 min',
                          ),
                          _OfferData(
                            icon: Icons.payments_outlined,
                            value: 'R\$ 18,90',
                            highlight: true,
                          ),
                        ],
                      ),
                      const SizedBox(height: 17),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () {},
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size.fromHeight(50),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                              child: const Text('Recusar'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: FilledButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.check_rounded),
                              label: const Text('Aceitar corrida'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 25),
          const Text(
            'Desempenho da semana',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 13),
          const Card(
            child: Padding(
              padding: EdgeInsets.all(17),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _Performance(value: '4,9', label: 'Avaliacao'),
                  _Divider(),
                  _Performance(value: '92%', label: 'Aceite'),
                  _Divider(),
                  _Performance(value: '38', label: 'Entregas'),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: (index) => setState(() => currentIndex = index),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'Inicio',
        ),
        NavigationDestination(
          icon: Icon(Icons.route_outlined),
          label: 'Corridas',
        ),
        NavigationDestination(
          icon: Icon(Icons.account_balance_wallet_outlined),
          label: 'Carteira',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          label: 'Perfil',
        ),
      ],
    ),
  );
}

class _EarningCard extends StatelessWidget {
  const _EarningCard({
    required this.value,
    required this.label,
    required this.icon,
  });
  final String value;
  final String label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AquiLogColors.forest, size: 20),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              color: AquiLogColors.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: .5,
            ),
          ),
        ],
      ),
    ),
  );
}

class _RouteInfo extends StatelessWidget {
  const _RouteInfo({
    required this.label,
    required this.value,
    required this.detail,
  });
  final String label;
  final String value;
  final String detail;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          fontSize: 9,
          color: AquiLogColors.muted,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 5),
      Text(
        value,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
      ),
      const SizedBox(height: 3),
      Text(
        detail,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: AquiLogColors.muted, fontSize: 10),
      ),
    ],
  );
}

class _OfferData extends StatelessWidget {
  const _OfferData({
    required this.icon,
    required this.value,
    this.highlight = false,
  });
  final IconData icon;
  final String value;
  final bool highlight;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Icon(
        icon,
        size: 17,
        color: highlight ? AquiLogColors.forest : AquiLogColors.muted,
      ),
      const SizedBox(width: 5),
      Text(
        value,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: highlight ? AquiLogColors.forest : AquiLogColors.ink,
        ),
      ),
    ],
  );
}

class _Performance extends StatelessWidget {
  const _Performance({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 4),
      Text(
        label,
        style: const TextStyle(fontSize: 10, color: AquiLogColors.muted),
      ),
    ],
  );
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) =>
      const SizedBox(height: 34, child: VerticalDivider());
}

class _MapPoint extends StatelessWidget {
  const _MapPoint({required this.icon, required this.color});
  final IconData icon;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    width: 34,
    height: 34,
    decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 3),
      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 8)],
    ),
    child: Icon(icon, color: Colors.white, size: 16),
  );
}

class _RoutePainter extends CustomPainter {
  const _RoutePainter();
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 7
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(0, size.height * .68)
      ..cubicTo(
        size.width * .27,
        size.height * .2,
        size.width * .63,
        size.height * .8,
        size.width,
        size.height * .27,
      );
    canvas.drawPath(path, paint);
    paint
      ..color = AquiLogColors.mint
      ..strokeWidth = 2.5;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
