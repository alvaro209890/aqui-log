import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'app_state.dart';
import 'screens/deliveries_screen.dart';
import 'screens/delivery_detail_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/new_order_screen.dart';
import 'screens/phone_verify_screen.dart';
import 'screens/register_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/wallet_screen.dart';

void main() => runApp(const CustomerApp());

class CustomerApp extends StatefulWidget {
  const CustomerApp({super.key, this.state});

  final CustomerAppState? state;

  @override
  State<CustomerApp> createState() => _CustomerAppState();
}

class _CustomerAppState extends State<CustomerApp> {
  late final CustomerAppState state = widget.state ?? CustomerAppState();

  @override
  void initState() {
    super.initState();
    // Auto-login: tenta restaurar a sessão gravada antes de decidir qual tela
    // mostrar. Enquanto isso a `home` é a abertura, não o login.
    if (!state.booted) state.bootstrap();
  }

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
        title: 'Aqui Log Cliente',
        debugShowCheckedModeBanner: false,
        theme: AquiLogTheme.light(),
        home: !state.booted
            ? const _SplashScreen()
            : state.isAuthenticated
            ? (state.needsPhoneVerify
                  ? PhoneVerifyScreen(
                      maskedPhone: state.userPhone,
                      onChallenge: state.requestPhoneCode,
                      onVerify: state.confirmPhone,
                      onSkip: state.skipPhoneVerify,
                    )
                  : CustomerShell(state: state))
            : LoginScreen(
                loading: state.loading,
                error: state.error,
                onSubmit: state.login,
                onCreateAccount: _openRegister,
              ),
      ),
    );
  }

  void _openRegister() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RegisterScreen(
          loading: state.loading,
          error: state.error,
          onSubmit: state.register,
        ),
      ),
    );
  }
}

/// Abertura do app enquanto a sessão gravada é restaurada (auto-login).
class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AquiLogBrand(),
          SizedBox(height: 28),
          SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ],
      ),
    ),
  );
}

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.state});

  final CustomerAppState state;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int index = 0;
  List<DeliverySummary> deliveries = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      deliveries = await widget.state.api.deliveries();
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
    // DISP-02: as ações da busca esgotada/atrasada voltam atualizadas para a
    // tela de detalhe fechar e a lista recarregar com o estado novo.
    final result = await Navigator.of(context).push<DeliverySummary>(
      MaterialPageRoute(
        builder: (_) => DeliveryDetailScreen(
          delivery: full,
          loadHistory: () => widget.state.api.deliveryHistory(d.id),
          onRate: (score, comment) => widget.state.api.rateDelivery(
            d.id,
            score: score,
            comment: comment,
          ),
          onRetry: () => widget.state.api.retryDelivery(d.id),
          onUpdate: (form) => widget.state.api.updateDelivery(d.id, form),
          onConsentBoost: () => widget.state.api.consentPriceBoost(d.id),
          onCancel: (reason) => widget.state.api.updateDeliveryStatus(
            d.id,
            'CANCELED',
            note: reason ?? 'Cancelado pelo cliente',
          ),
        ),
      ),
    );
    if (result != null) full = result;
    if (!mounted) return;
    setState(() {
      final idx = deliveries.indexWhere((item) => item.id == full.id);
      if (idx >= 0) {
        deliveries[idx] = full;
      } else {
        deliveries.add(full);
      }
    });
    await _load();
  }

  Future<void> _openNewOrder() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => NewOrderScreen(
          geocode: widget.state.api.geocode,
          onSubmit: (form) => widget.state.api.createDelivery(form),
          uploadPhoto: (photo) => _uploadPhoto(photo),
        ),
      ),
    );
    if (created == true) await _load();
  }

  void _openPhoneVerify() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PhoneVerifyScreen(
          maskedPhone: widget.state.userPhone,
          onChallenge: widget.state.requestPhoneCode,
          onVerify: widget.state.confirmPhone,
        ),
      ),
    );
  }

  void _openWallet() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            WalletScreen(loadStatement: widget.state.api.walletStatement),
      ),
    );
  }

  Future<String> _uploadPhoto(XFile photo) async {
    final bytes = await photo.readAsBytes();
    final contentType = photo.mimeType ?? 'image/jpeg';
    return widget.state.api.uploadBytes(
      bytes: bytes,
      contentType: contentType,
      purpose: 'product',
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(
        userName: widget.state.userName,
        deliveries: deliveries,
        loading: loading,
        onNewOrder: _openNewOrder,
        onOpenDelivery: _openDetail,
      ),
      NewOrderScreen(
        geocode: widget.state.api.geocode,
        onSubmit: (form) => widget.state.api.createDelivery(form),
        uploadPhoto: _uploadPhoto,
      ),
      DeliveriesScreen(
        deliveries: deliveries,
        loading: loading,
        onOpen: _openDetail,
        onRefresh: _load,
      ),
      SettingsScreen(
        userName: widget.state.userName,
        email: widget.state.userEmail,
        onLogout: widget.state.logout,
        onOpenWallet: _openWallet,
        phoneVerified: widget.state.phoneVerified,
        onVerifyPhone: _openPhoneVerify,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: const AquiLogBrand(),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
          const SizedBox(width: 8),
        ],
      ),
      body: pages[index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Início',
          ),
          NavigationDestination(
            icon: Icon(Icons.add_box_outlined),
            selectedIcon: Icon(Icons.add_box_rounded),
            label: 'Pedir',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping_rounded),
            label: 'Entregas',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
