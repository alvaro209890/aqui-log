import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

void main() => runApp(const CompanyApp());

class CompanyApp extends StatelessWidget {
  const CompanyApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Aqui Log Empresa',
    debugShowCheckedModeBanner: false,
    theme: AquiLogTheme.light(),
    home: const CompanyHomePage(),
  );
}

class CompanyHomePage extends StatefulWidget {
  const CompanyHomePage({super.key});

  @override
  State<CompanyHomePage> createState() => _CompanyHomePageState();
}

class _CompanyHomePageState extends State<CompanyHomePage> {
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
          const Text(
            'Bom dia, Alvaro',
            style: TextStyle(
              fontSize: 25,
              fontWeight: FontWeight.w800,
              color: AquiLogColors.ink,
            ),
          ),
          const SizedBox(height: 5),
          const Text(
            'Sua operacao, simples e em movimento.',
            style: TextStyle(color: AquiLogColors.muted),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AquiLogColors.forestDark, AquiLogColors.forest],
              ),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.local_shipping_outlined,
                      color: AquiLogColors.mint,
                    ),
                    SizedBox(width: 9),
                    Text(
                      'PRECISA ENVIAR ALGO?',
                      style: TextStyle(
                        color: AquiLogColors.mint,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: .8,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 13),
                const Text(
                  'Solicite uma entrega\nem poucos passos.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    height: 1.25,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AquiLogColors.mint,
                    foregroundColor: AquiLogColors.forestDark,
                    minimumSize: const Size(190, 45),
                  ),
                  onPressed: () {},
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Nova entrega'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 25),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Resumo de hoje',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              Text(
                '14 JUL',
                style: TextStyle(
                  fontSize: 10,
                  color: AquiLogColors.muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 13),
          const Row(
            children: [
              Expanded(
                child: _SummaryCard(
                  icon: Icons.route_rounded,
                  value: '12',
                  label: 'Em andamento',
                  color: Color(0xFF4E83A1),
                ),
              ),
              SizedBox(width: 12),
              Expanded(
                child: _SummaryCard(
                  icon: Icons.check_circle_outline_rounded,
                  value: '38',
                  label: 'Concluidas',
                  color: Color(0xFF3BA87D),
                ),
              ),
            ],
          ),
          const SizedBox(height: 26),
          const Text(
            'Entregas recentes',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 13),
          const _DeliveryCard(
            code: '#AQL-1048',
            destination: 'Av. Getulio Vargas, 812',
            status: 'Em rota',
            icon: Icons.two_wheeler_rounded,
          ),
          const SizedBox(height: 10),
          const _DeliveryCard(
            code: '#AQL-1047',
            destination: 'Rua dos Timbiras, 1200',
            status: 'Coletado',
            icon: Icons.inventory_2_outlined,
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
          icon: Icon(Icons.local_shipping_outlined),
          label: 'Entregas',
        ),
        NavigationDestination(
          icon: Icon(Icons.bar_chart_rounded),
          label: 'Relatorios',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          label: 'Perfil',
        ),
      ],
    ),
  );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });
  final IconData icon;
  final String value;
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(17),
      child: Row(
        children: [
          Container(
            width: 39,
            height: 39,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  color: AquiLogColors.muted,
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({
    required this.code,
    required this.destination,
    required this.status,
    required this.icon,
  });
  final String code;
  final String destination;
  final String status;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(15),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFE5F5EE),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, color: AquiLogColors.forest, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  code,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  destination,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AquiLogColors.muted,
                  ),
                ),
              ],
            ),
          ),
          StatusPill(status),
        ],
      ),
    ),
  );
}
