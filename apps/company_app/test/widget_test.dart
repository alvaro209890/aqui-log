import 'package:aqui_log_empresa/main.dart';
import 'package:aqui_log_empresa/screens/dashboard_screen.dart';
import 'package:aqui_log_empresa/screens/deliveries_screen.dart';
import 'package:aqui_log_empresa/screens/delivery_detail_screen.dart';
import 'package:aqui_log_empresa/screens/login_screen.dart';
import 'package:aqui_log_empresa/screens/new_delivery_screen.dart';
import 'package:aqui_log_empresa/screens/reports_screen.dart';
import 'package:aqui_log_empresa/screens/settings_screen.dart';
import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('LoginScreen renders form', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(onSubmit: (e, p) async => true),
      ),
    );
    expect(find.text('Acesso da empresa'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets('DashboardScreen shows metrics and deliveries', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DashboardScreen(
            userName: 'Alvaro',
            deliveries: const [
              DeliverySummary(id: '1', code: 'AQL-1', status: 'IN_TRANSIT'),
              DeliverySummary(id: '2', code: 'AQL-2', status: 'DELIVERED'),
            ],
            loading: false,
            onNewDelivery: () {},
            onOpenDelivery: (_) {},
          ),
        ),
      ),
    );
    expect(find.textContaining('Bom dia, Alvaro'), findsOneWidget);
    expect(find.text('AQL-1'), findsOneWidget);
    expect(find.text('Nova entrega'), findsOneWidget);
  });

  testWidgets('DeliveriesScreen lists items', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DeliveriesScreen(
            deliveries: const [
              DeliverySummary(id: '1', code: 'AQL-9', status: 'REQUESTED'),
            ],
            loading: false,
            onOpen: (_) {},
            onRefresh: () async {},
          ),
        ),
      ),
    );
    expect(find.text('AQL-9'), findsOneWidget);
  });

  testWidgets('DeliveryDetailScreen shows code', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: const DeliverySummary(
            id: 'abc',
            code: 'AQL-DETAIL',
            status: 'DELIVERED',
          ),
        ),
      ),
    );
    expect(find.text('AQL-DETAIL'), findsWidgets);
  });

  testWidgets('NewDeliveryScreen has fields', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: NewDeliveryScreen(onSubmit: (_) async {}),
      ),
    );
    expect(find.text('Solicitar entrega'), findsOneWidget);
  });

  testWidgets('ReportsScreen and SettingsScreen render', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ReportsScreen(
            deliveries: const [
              DeliverySummary(id: '1', code: 'A', status: 'DELIVERED'),
            ],
            finance: const {'grossCents': 3500},
          ),
        ),
      ),
    );
    expect(find.text('Relatorios'), findsOneWidget);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SettingsScreen(
            userName: 'Empresa',
            email: 'e@test.com',
            onLogout: () {},
          ),
        ),
      ),
    );
    expect(find.text('Configuracoes'), findsOneWidget);
    expect(find.text('Sair'), findsOneWidget);
  });

  testWidgets('CompanyApp boots login shell', (tester) async {
    await tester.pumpWidget(const CompanyApp());
    await tester.pump();
    expect(find.text('Acesso da empresa'), findsOneWidget);
  });
}
