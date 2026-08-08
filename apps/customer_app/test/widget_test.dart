import 'package:aqui_log_cliente/main.dart';
import 'package:aqui_log_cliente/screens/deliveries_screen.dart';
import 'package:aqui_log_cliente/screens/delivery_detail_screen.dart';
import 'package:aqui_log_cliente/screens/home_screen.dart';
import 'package:aqui_log_cliente/screens/login_screen.dart';
import 'package:aqui_log_cliente/screens/new_order_screen.dart';
import 'package:aqui_log_cliente/screens/register_screen.dart';
import 'package:aqui_log_cliente/screens/settings_screen.dart';
import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('LoginScreen renders form', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: LoginScreen(onSubmit: (e, p) async => true)),
    );
    expect(find.text('Acesso do cliente'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Entrar'), findsOneWidget);
  });

  testWidgets('HomeScreen shows client greeting and orders', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeScreen(
            userName: 'Alvaro',
            deliveries: const [
              DeliverySummary(id: '1', code: 'AQL-1', status: 'IN_TRANSIT'),
              DeliverySummary(id: '2', code: 'AQL-2', status: 'DELIVERED'),
            ],
            loading: false,
            onNewOrder: () {},
            onOpenDelivery: (_) {},
          ),
        ),
      ),
    );
    expect(find.textContaining('Olá, Alvaro'), findsOneWidget);
    expect(find.text('AQL-1'), findsOneWidget);
    expect(find.text('Fazer pedido'), findsOneWidget);
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
          loadHistory: () async => [],
          onRate: (score, comment) async {},
        ),
      ),
    );
    expect(find.text('AQL-DETAIL'), findsWidgets);
  });

  testWidgets('NewOrderScreen has B2C fields', (tester) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        home: NewOrderScreen(
          onSubmit: (_) async {},
          geocode: (address) async => GeocodeResult(
            latitude: -15.6,
            longitude: -56.1,
            formattedAddress: address,
          ),
          uploadPhoto: (_) async => 'http://storage/foto.jpg',
        ),
      ),
    );
    expect(find.text('Publicar pedido'), findsOneWidget);
    expect(find.text('Tipo de encomenda'), findsOneWidget);
    expect(find.text('Peso aproximado (kg)'), findsOneWidget);
    expect(find.text('Alcance'), findsOneWidget);
    // B2C-05 / DEC-01: a foto deixou de ser opcional.
    expect(find.text('Foto da encomenda (obrigatória)'), findsOneWidget);
  });

  // B2C-05 / DEC-01: o app não deve gastar uma chamada de API em um pedido que
  // o backend rejeitaria com 400.
  testWidgets('NewOrderScreen barra o envio sem foto', (tester) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    var submitted = false;
    await tester.pumpWidget(
      MaterialApp(
        home: NewOrderScreen(
          onSubmit: (_) async => submitted = true,
          geocode: (address) async => GeocodeResult(
            latitude: -15.6,
            longitude: -56.1,
            formattedAddress: address,
          ),
          uploadPhoto: (_) async => 'http://storage/foto.jpg',
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Peso aproximado (kg)'),
      '2',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Endereço de retirada'),
      'Rua A, 10',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Endereço de entrega'),
      'Rua B, 20',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome de quem recebe'),
      'Maria',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Telefone do destinatário'),
      '65999999999',
    );

    await tester.tap(find.text('Publicar pedido'));
    await tester.pumpAndSettle();

    expect(submitted, isFalse);
    expect(
      find.text('Anexe uma foto da encomenda para continuar.'),
      findsWidgets,
    );
  });

  testWidgets('SettingsScreen renders profile', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SettingsScreen(
            userName: 'Cliente',
            email: 'e@test.com',
            onLogout: () {},
          ),
        ),
      ),
    );
    expect(find.text('Meu perfil'), findsOneWidget);
    expect(find.text('Sair'), findsOneWidget);
  });

  testWidgets('RegisterScreen renders customer form', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: RegisterScreen(
          onSubmit:
              ({
                required name,
                required email,
                required password,
                required document,
                required phone,
              }) async => true,
        ),
      ),
    );
    expect(find.text('Criar conta'), findsNWidgets(2)); // AppBar + botão
    expect(find.text('CPF (somente números)'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(5));
  });

  testWidgets('CustomerApp boots login shell', (tester) async {
    await tester.pumpWidget(const CustomerApp());
    await tester.pump();
    expect(find.text('Acesso do cliente'), findsOneWidget);
  });

  group('OrderMeta encode/decode', () {
    test('round-trip with all fields', () {
      const meta = OrderMeta(
        productType: 'Eletrônico',
        size: 'Médio',
        weightKg: 2.5,
        scope: 'Outra cidade ou município',
        photoUrls: ['http://storage/foto.jpg'],
        notes: 'Frágil, manusear com cuidado',
      );
      final decoded = OrderMeta.fromNotes(meta.encodeNotes());
      expect(decoded, isNotNull);
      expect(decoded!.productType, 'Eletrônico');
      expect(decoded.size, 'Médio');
      expect(decoded.weightKg, 2.5);
      expect(decoded.scope, 'Outra cidade ou município');
      expect(decoded.photoUrl, 'http://storage/foto.jpg');
      expect(decoded.notes, 'Frágil, manusear com cuidado');
    });

    test('null when notes are empty', () {
      expect(OrderMeta.fromNotes(null), isNull);
      expect(OrderMeta.fromNotes(''), isNull);
      expect(OrderMeta.fromNotes('só um texto'), isNull);
    });
  });
}
