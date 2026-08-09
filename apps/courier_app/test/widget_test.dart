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
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _noopProof({
  required Uint8List bytes,
  required String contentType,
  required String status,
  String? pickupCode,
}) async {}

/// O botão de confirmar fica no fim de uma `ListView`; com a seção do código de
/// recolhimento na tela ele nasce fora da viewport e a `ListView` sequer o
/// constrói, então é preciso rolar até ele antes de inspecioná-lo.
Finder _acharBotaoConfirmar() =>
    find.widgetWithText(FilledButton, 'Confirmar comprovante');

Future<FilledButton> _botaoConfirmar(WidgetTester tester) async {
  final finder = _acharBotaoConfirmar();
  for (var i = 0; i < 10 && finder.evaluate().isEmpty; i += 1) {
    await tester.drag(find.byType(ListView), const Offset(0, -200));
    await tester.pump();
  }
  await tester.ensureVisible(finder);
  await tester.pump();
  return tester.widget<FilledButton>(finder);
}

/// A captura passa pelo canal do `image_picker`, que só responde fora do
/// relógio virtual do teste; sem `runAsync` a foto nunca chega.
Future<void> _capturarFoto(WidgetTester tester) async {
  await tester.runAsync(() async {
    await tester.tap(find.text('Capturar foto'));
    await Future<void>.delayed(const Duration(milliseconds: 200));
  });
  await tester.pump();
}

/// A tela de corridas vive dentro de um `Scaffold` no app; as abas precisam
/// desse ancestral de Material para desenhar.
Widget _telaCorridas(List<DeliverySummary> deliveries) => MaterialApp(
  home: Scaffold(
    body: MyDeliveriesScreen(
      deliveries: deliveries,
      loading: false,
      onOpen: (_) {},
      onRefresh: () async {},
    ),
  ),
);

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
                  'productType': 'ELECTRONICS',
                  'packageSize': 'MEDIUM',
                  'weightKg': 2.5,
                  'deliveryScope': 'SAME_CITY',
                  'productPhotoUrls': <String>[],
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
    expect(find.text('Eletrônico · Mesma cidade'), findsOneWidget);
    expect(find.text('Médio · 2,5 kg'), findsOneWidget);
    expect(find.text('Aceitar'), findsOneWidget);
  });

  testWidgets('MyDeliveriesScreen lists deliveries', (tester) async {
    await tester.pumpWidget(
      _telaCorridas(const [
        DeliverySummary(id: '1', code: 'AQL-C1', status: 'ACCEPTED'),
      ]),
    );
    await tester.pump();
    expect(find.text('AQL-C1'), findsOneWidget);
  });

  // COUR-01 / DEC-21: as duas seções do prestador. O critério é a janela, não
  // o modo: agendado com a janela já aberta é trabalho de agora.
  testWidgets('MyDeliveriesScreen separa Agenda de Em andamento', (
    tester,
  ) async {
    final futura = DateTime.now().add(const Duration(hours: 5));
    final passada = DateTime.now().subtract(const Duration(minutes: 20));
    await tester.pumpWidget(
      _telaCorridas([
        const DeliverySummary(
          id: 'imediata',
          code: 'AQL-AGORA',
          status: 'PICKED_UP',
        ),
        DeliverySummary(
          id: 'agendada-futura',
          code: 'AQL-DEPOIS',
          status: 'ACCEPTED',
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: futura,
          pickupWindowEnd: futura.add(const Duration(hours: 1)),
        ),
        DeliverySummary(
          id: 'agendada-aberta',
          code: 'AQL-ABERTA',
          status: 'ACCEPTED',
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: passada,
          pickupWindowEnd: passada.add(const Duration(hours: 1)),
        ),
        const DeliverySummary(
          id: 'entregue',
          code: 'AQL-FEITA',
          status: 'DELIVERED',
        ),
      ]),
    );
    await tester.pump();

    // Aba "Em andamento": a imediata em execução e a agendada cuja janela abriu.
    expect(find.text('Em andamento (2)'), findsOneWidget);
    expect(find.text('Agenda (1)'), findsOneWidget);
    expect(find.text('Concluídas (1)'), findsOneWidget);
    expect(find.text('AQL-AGORA'), findsOneWidget);
    expect(find.text('AQL-ABERTA'), findsOneWidget);
    expect(find.text('AQL-DEPOIS'), findsNothing);
    expect(find.text('AQL-FEITA'), findsNothing);

    // Aba "Agenda": só a agendada com janela no futuro.
    await tester.tap(find.text('Agenda (1)'));
    await tester.pumpAndSettle();
    expect(find.text('AQL-DEPOIS'), findsOneWidget);
    expect(find.text('AQL-AGORA'), findsNothing);
    expect(
      find.textContaining(formatPickupWindow(futura, null).split(' a partir')[0]),
      findsWidgets,
    );
    expect(
      find.textContaining('Na agenda. A coleta so abre'),
      findsOneWidget,
    );
  });

  testWidgets('MyDeliveriesScreen mostra modo, repasse e encomenda no card', (
    tester,
  ) async {
    await tester.pumpWidget(
      _telaCorridas([
        DeliverySummary.fromJson(const {
          'id': 'c1',
          'code': 'AQL-CARD',
          'status': 'ACCEPTED',
          'pickupAddress': 'Rua A, 10',
          'deliveryAddress': 'Rua B, 20',
          'courierFeeCents': 1104,
          'fulfillmentMode': 'IMMEDIATE',
          'productType': 'ELECTRONICS',
          'packageSize': 'MEDIUM',
          'weightKg': 2.5,
          'deliveryScope': 'SAME_CITY',
          'productPhotoUrls': <String>[],
        }),
      ]),
    );
    await tester.pump();

    expect(find.text('AQL-CARD'), findsOneWidget);
    expect(find.text('Imediato'), findsOneWidget);
    expect(find.text('Rua A, 10'), findsOneWidget);
    expect(find.text('Rua B, 20'), findsOneWidget);
    expect(find.text('Eletrônico · Médio · 2,5 kg'), findsOneWidget);
    expect(find.text('Seu repasse'), findsOneWidget);
    expect(find.text(r'R$ 11,04'), findsOneWidget);
    // COUR-02 ainda não existe: nada de botão de cancelar na tela.
    expect(find.textContaining('Cancelar'), findsNothing);
  });

  testWidgets('MyDeliveriesScreen abre o detalhe existente ao tocar no card', (
    tester,
  ) async {
    String? aberta;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MyDeliveriesScreen(
            deliveries: const [
              DeliverySummary(id: 'd9', code: 'AQL-TAP', status: 'ACCEPTED'),
            ],
            loading: false,
            onOpen: (d) => aberta = d.id,
            onRefresh: () async {},
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('AQL-TAP'));
    await tester.pump();
    expect(aberta, 'd9');
  });

  testWidgets('MyDeliveriesScreen mostra vazio proprio de cada secao', (
    tester,
  ) async {
    await tester.pumpWidget(_telaCorridas(const []));
    await tester.pump();

    expect(find.text('Nenhuma corrida em andamento agora.'), findsOneWidget);
    await tester.tap(find.text('Agenda'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Nada agendado.'), findsOneWidget);
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

  // SCHED-01 / DEC-20: o agendado aparece na mesma lista de ofertas e pode ser
  // aceito antes da janela — mas a janela tem de estar visível antes do aceite.
  testWidgets('AvailableDeliveriesScreen mostra a janela do agendado', (
    tester,
  ) async {
    final start = DateTime.now().add(const Duration(hours: 3));
    final end = start.add(const Duration(hours: 1));
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AvailableDeliveriesScreen(
            offers: [
              {
                'id': 'offer-agendada',
                'delivery': {
                  'id': 'd-agendada',
                  'code': 'AQL-AGEND',
                  'status': 'OFFERED',
                  'pickupAddress': 'A',
                  'deliveryAddress': 'B',
                  'fulfillmentMode': 'SCHEDULED',
                  'pickupWindowStart': start.toUtc().toIso8601String(),
                  'pickupWindowEnd': end.toUtc().toIso8601String(),
                  'productPhotoUrls': <String>[],
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
    await tester.pump();

    expect(
      find.textContaining(formatPickupWindow(start, end)),
      findsOneWidget,
    );
    // O aceite antecipado continua disponível.
    expect(find.text('Aceitar'), findsOneWidget);
  });

  testWidgets('DeliveryDetailScreen trava a coleta antes da janela', (
    tester,
  ) async {
    final start = DateTime.now().add(const Duration(hours: 3));
    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: DeliverySummary(
            id: 'd2',
            code: 'AQL-AG',
            status: 'ACCEPTED',
            fulfillmentMode: 'SCHEDULED',
            pickupWindowStart: start,
            pickupWindowEnd: start.add(const Duration(hours: 1)),
          ),
          onProof: () {},
          onStatus: (s, {proofUrl}) async {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Cheguei na coleta'), findsNothing);
    expect(
      find.textContaining('Na agenda. A coleta so abre'),
      findsOneWidget,
    );
  });

  testWidgets('DeliveryDetailScreen libera a coleta dentro da janela', (
    tester,
  ) async {
    final start = DateTime.now().subtract(const Duration(minutes: 10));
    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: DeliverySummary(
            id: 'd3',
            code: 'AQL-AG2',
            status: 'ACCEPTED',
            fulfillmentMode: 'SCHEDULED',
            pickupWindowStart: start,
            pickupWindowEnd: start.add(const Duration(hours: 1)),
          ),
          onProof: () {},
          onStatus: (s, {proofUrl}) async {},
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Cheguei na coleta'), findsOneWidget);
  });

  testWidgets('ProofScreen camera UI exists', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProofScreen(deliveryId: 'd1', onSubmit: _noopProof),
      ),
    );
    await tester.pump();
    expect(find.text('Capturar foto'), findsOneWidget);
    expect(find.text('Confirmar comprovante'), findsOneWidget);
    expect(find.text('Comprovante'), findsOneWidget);
  });

  // PICK-01 / DEC-24: na coleta o app pede o código de 4 dígitos e só libera o
  // envio quando ele está completo. O app nunca exibe o código: quem tem o
  // número é o cliente.
  testWidgets('ProofScreen pede o codigo de recolhimento na coleta', (
    tester,
  ) async {
    String? enviado;
    await tester.pumpWidget(
      MaterialApp(
        home: ProofScreen(
          deliveryId: 'd1',
          pickupCodeRequired: true,
          pickupCodeAttemptsLeft: 5,
          onSubmit:
              ({
                required bytes,
                required contentType,
                required status,
                String? pickupCode,
              }) async {
                enviado = pickupCode;
              },
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Código de recolhimento'), findsOneWidget);
    expect(find.text('Tentativas restantes: 5'), findsOneWidget);

    // Sem foto e sem código, o botão fica travado.
    expect((await _botaoConfirmar(tester)).onPressed, isNull);

    await _capturarFoto(tester);
    // Com foto, mas código incompleto: continua travado.
    await tester.enterText(find.byType(TextField), '42');
    await tester.pump();
    expect((await _botaoConfirmar(tester)).onPressed, isNull);

    await tester.enterText(find.byType(TextField), '4207');
    await tester.pump();
    expect((await _botaoConfirmar(tester)).onPressed, isNotNull);

    await tester.ensureVisible(_acharBotaoConfirmar());
    await tester.tap(_acharBotaoConfirmar());
    await tester.pumpAndSettle();
    expect(enviado, '4207');
  });

  testWidgets('ProofScreen de pedido legado nao pede codigo', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ProofScreen(deliveryId: 'd1', onSubmit: _noopProof),
      ),
    );
    await tester.pump();

    expect(find.text('Código de recolhimento'), findsNothing);
    await _capturarFoto(tester);
    expect((await _botaoConfirmar(tester)).onPressed, isNotNull);
  });

  testWidgets('ProofScreen bloqueado nao deixa tentar de novo', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ProofScreen(
          deliveryId: 'd1',
          pickupCodeRequired: true,
          pickupCodeAttemptsLeft: 0,
          pickupCodeBlockedUntil: DateTime.now().add(
            const Duration(minutes: 10),
          ),
          onSubmit: _noopProof,
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('Coleta bloqueada'), findsOneWidget);
    await _capturarFoto(tester);
    expect((await _botaoConfirmar(tester)).onPressed, isNull);
  });

  testWidgets('Detalhe avisa o entregador que a coleta exige codigo', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: DeliverySummary.fromJson(const {
            'id': 'd1',
            'code': 'AQL-PICK',
            'status': 'AT_PICKUP',
            'pickupAddress': 'Rua A',
            'deliveryAddress': 'Rua B',
            'pickupCodeRequired': true,
            'pickupCodeAttemptsLeft': 5,
          }),
          onProof: () {},
          onStatus: (status, {proofUrl}) async {},
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('código de 4 dígitos'), findsOneWidget);
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
