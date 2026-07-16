import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'screens/dashboard_screen.dart';
import 'screens/deliveries_screen.dart';
import 'screens/delivery_detail_screen.dart';
import 'screens/login_screen.dart';
import 'screens/new_delivery_screen.dart';
import 'screens/reports_screen.dart';
import 'screens/settings_screen.dart';

void main() => runApp(const CompanyApp());

class CompanyApp extends StatefulWidget {
  const CompanyApp({super.key, this.state});

  final CompanyAppState? state;

  @override
  State<CompanyApp> createState() => _CompanyAppState();
}

class _CompanyAppState extends State<CompanyApp> {
  late final CompanyAppState state = widget.state ?? CompanyAppState();

  @override
  void dispose() {
    if (widget.state == null) state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) => MaterialApp(
        title: 'Aqui Log Empresa',
        debugShowCheckedModeBanner: false,
        theme: AquiLogTheme.light(),
        home: state.isAuthenticated
            ? CompanyShell(state: state)
            : LoginScreen(
                loading: state.loading,
                error: state.error,
                onSubmit: state.login,
              ),
      ),
    );
  }
}

class CompanyShell extends StatefulWidget {
  const CompanyShell({super.key, required this.state});
  final CompanyAppState state;

  @override
  State<CompanyShell> createState() => _CompanyShellState();
}

class _CompanyShellState extends State<CompanyShell> {
  int index = 0;
  List<DeliverySummary> deliveries = [];
  Map<String, dynamic>? finance;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final results = await Future.wait([
        widget.state.api.deliveries(),
        widget.state.api.financeSummary().catchError((_) => <String, dynamic>{}),
      ]);
      deliveries = results[0] as List<DeliverySummary>;
      finance = results[1] as Map<String, dynamic>;
    } catch (_) {
      // keep previous data
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _openDetail(DeliverySummary d) async {
    DeliverySummary full = d;
    try {
      full = await widget.state.api.delivery(d.id);
    } catch (_) {}
    if (!mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DeliveryDetailScreen(
          delivery: full,
          loadHistory: () => widget.state.api.deliveryHistory(d.id),
          onRate: (score, comment) => widget.state.api.rateDelivery(
            d.id,
            score: score,
            comment: comment,
          ),
        ),
      ),
    );
    await _load();
  }

  Future<void> _openNew() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => NewDeliveryScreen(
          geocode: widget.state.api.geocode,
          onSubmit: (form) => widget.state.api.createDelivery(form),
        ),
      ),
    );
    if (created == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(
        userName: widget.state.userName,
        deliveries: deliveries,
        loading: loading,
        onNewDelivery: _openNew,
        onOpenDelivery: _openDetail,
      ),
      DeliveriesScreen(
        deliveries: deliveries,
        loading: loading,
        onOpen: _openDetail,
        onRefresh: _load,
      ),
      ReportsScreen(deliveries: deliveries, finance: finance),
      SettingsScreen(
        userName: widget.state.userName,
        email: '${widget.state.session?.user['email'] ?? ''}',
        onLogout: widget.state.logout,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: const AquiLogBrand(),
        actions: [
          IconButton(
            onPressed: _load,
            icon: const Badge(
              smallSize: 7,
              child: Icon(Icons.notifications_none_rounded),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: pages[index],
      floatingActionButton: index == 1
          ? FloatingActionButton(
              onPressed: _openNew,
              child: const Icon(Icons.add),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
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
            icon: Icon(Icons.settings_outlined),
            label: 'Ajustes',
          ),
        ],
      ),
    );
  }
}
