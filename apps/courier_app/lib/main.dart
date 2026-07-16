import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';

import 'app_state.dart';
import 'screens/available_deliveries_screen.dart';
import 'screens/delivery_detail_screen.dart';
import 'screens/login_screen.dart';
import 'screens/my_deliveries_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/proof_screen.dart';
import 'screens/wallet_screen.dart';

void main() => runApp(const CourierApp());

class CourierApp extends StatefulWidget {
  const CourierApp({super.key, this.state});

  final CourierAppState? state;

  @override
  State<CourierApp> createState() => _CourierAppState();
}

class _CourierAppState extends State<CourierApp> {
  late final CourierAppState state = widget.state ?? CourierAppState();

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
        title: 'Aqui Log Entregador',
        debugShowCheckedModeBanner: false,
        theme: AquiLogTheme.light(),
        home: state.isAuthenticated
            ? CourierShell(state: state)
            : LoginScreen(
                loading: state.loading,
                error: state.error,
                onSubmit: state.login,
              ),
      ),
    );
  }
}

class CourierShell extends StatefulWidget {
  const CourierShell({super.key, required this.state});
  final CourierAppState state;

  @override
  State<CourierShell> createState() => _CourierShellState();
}

class _CourierShellState extends State<CourierShell> {
  int index = 0;
  List<Map<String, dynamic>> offers = [];
  List<DeliverySummary> deliveries = [];
  Map<String, dynamic>? statement;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    widget.state.startLocationUpdates();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final offerRaw = await widget.state.api.offers();
      offers = offerRaw
          .map(
            (e) => e is Map<String, dynamic>
                ? e
                : Map<String, dynamic>.from(e as Map),
          )
          .toList();
      deliveries = await widget.state.api.deliveries();
      statement = await widget.state.api.statement().catchError(
        (_) => <String, dynamic>{},
      );
    } catch (_) {
      // keep previous
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
          onProof: () async {
            await Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProofScreen(
                  deliveryId: d.id,
                  onSubmit: ({
                    required bytes,
                    required contentType,
                    required status,
                  }) async {
                    final url = await widget.state.api.uploadBytes(
                      bytes: bytes,
                      contentType: contentType,
                      purpose: 'proof',
                      deliveryId: d.id,
                    );
                    await widget.state.api.updateDeliveryStatus(
                      d.id,
                      status,
                      proofUrl: url,
                    );
                  },
                ),
              ),
            );
            await _load();
          },
          onStatus: (status, {proofUrl}) => widget.state.api
              .updateDeliveryStatus(d.id, status, proofUrl: proofUrl),
        ),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      AvailableDeliveriesScreen(
        offers: offers,
        loading: loading,
        available: widget.state.available,
        onToggleAvailable: widget.state.setAvailable,
        onAccept: (id) async {
          await widget.state.api.acceptOffer(id);
          await _load();
        },
        onReject: (id) async {
          await widget.state.api.rejectOffer(id);
          await _load();
        },
        onRefresh: _load,
      ),
      MyDeliveriesScreen(
        deliveries: deliveries,
        loading: loading,
        onOpen: _openDetail,
        onRefresh: _load,
      ),
      WalletScreen(
        statement: statement,
        loading: loading,
        onRefresh: _load,
      ),
      ProfileScreen(
        userName: widget.state.userName,
        email: '${widget.state.session?.user['email'] ?? ''}',
        available: widget.state.available,
        onToggleAvailable: widget.state.setAvailable,
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Ofertas',
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
}
