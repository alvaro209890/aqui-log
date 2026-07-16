import 'package:aqui_log_entregador/main.dart';
import 'package:aqui_log_entregador/screens/available_deliveries_screen.dart';
import 'package:aqui_log_entregador/screens/delivery_detail_screen.dart';
import 'package:aqui_log_entregador/screens/login_screen.dart';
import 'package:aqui_log_entregador/screens/my_deliveries_screen.dart';
import 'package:aqui_log_entregador/screens/profile_screen.dart';
import 'package:aqui_log_entregador/screens/proof_screen.dart';
import 'package:aqui_log_entregador/screens/wallet_screen.dart';
import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _noopProof(String url, String status) async {}

void main() {
  testWidgets('LoginScreen renders', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: LoginScreen(onSubmit: (e, p) async => true)),
    );
    expect(find.text('Acesso do entregador'), findsOneWidget);
  });

  testWidgets('AvailableDeliveriesScreen shows map and offers', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AvailableDeliveriesScreen(
            offers: const [
              {
                'id': 'offer-1',
                'delivery': {
                  'code': 'AQL-MAP',
                  'pickupAddress': 'A',
                  'deliveryAddress': 'B',
                },
              },
            ],
            loading: false,
            available: true,
            onToggleAvailable: (_) {},
            onAccept: (_) async {},
            onReject: (_) async {},
            onRefresh: () async {},
          ),
        ),
      ),
    );
    expect(find.textContaining('oferta'), findsOneWidget);
    expect(find.text('AQL-MAP'), findsOneWidget);
    expect(find.text('Aceitar'), findsOneWidget);
  });

  testWidgets('MyDeliveriesScreen lists deliveries', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MyDeliveriesScreen(
            deliveries: const [
              DeliverySummary(id: '1', code: 'AQL-C1', status: 'ACCEPTED'),
            ],
            loading: false,
            onOpen: (_) {},
            onRefresh: () async {},
          ),
        ),
      ),
    );
    expect(find.text('AQL-C1'), findsOneWidget);
  });

  testWidgets('DeliveryDetailScreen shows actions', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: const DeliverySummary(
            id: 'd1',
            code: 'AQL-D',
            status: 'ACCEPTED',
          ),
          onProof: () {},
          onStatus: (s, {proofUrl}) async {},
        ),
      ),
    );
    expect(find.text('Enviar comprovante'), findsOneWidget);
  });

  testWidgets('ProofScreen camera UI exists', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProofScreen(
          deliveryId: 'd1',
          onSubmit: _noopProof,
        ),
      ),
    );
    await tester.pump();
    expect(find.text('Capturar foto'), findsOneWidget);
    expect(find.text('Confirmar comprovante'), findsOneWidget);
    expect(find.text('Comprovante'), findsOneWidget);
  });

  testWidgets('WalletScreen and ProfileScreen render', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: WalletScreen(
            statement: const {
              'balanceCents': 1800,
              'entries': [
                {'description': 'Credito', 'amountCents': 1800},
              ],
            },
            loading: false,
            onRefresh: () async {},
          ),
        ),
      ),
    );
    expect(find.text('Carteira'), findsOneWidget);
    expect(find.textContaining('18'), findsWidgets);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProfileScreen(
            userName: 'Rafael',
            email: 'r@test.com',
            available: true,
            onToggleAvailable: (_) {},
            onLogout: () {},
          ),
        ),
      ),
    );
    expect(find.text('Perfil'), findsOneWidget);
    expect(find.text('Sair'), findsOneWidget);
  });

  testWidgets('CourierApp boots login', (tester) async {
    await tester.pumpWidget(const CourierApp());
    await tester.pump();
    expect(find.text('Acesso do entregador'), findsOneWidget);
  });
}
