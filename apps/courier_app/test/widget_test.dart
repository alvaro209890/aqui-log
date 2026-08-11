import 'package:aqui_log_entregador/app_state.dart';
import 'package:aqui_log_entregador/main.dart';
import 'package:aqui_log_entregador/screens/available_deliveries_screen.dart';
import 'package:aqui_log_entregador/screens/delivery_detail_screen.dart';
import 'package:aqui_log_entregador/screens/login_screen.dart';
import 'package:aqui_log_entregador/screens/my_deliveries_screen.dart';
import 'package:aqui_log_entregador/screens/profile_screen.dart';
import 'package:aqui_log_entregador/screens/proof_screen.dart';
import 'package:aqui_log_entregador/screens/register_screen.dart';
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
            statement: const WalletStatement(
              availableCents: 1800,
              reservedCents: 0,
              balanceCents: 1800,
              entries: [
                WalletEntry(
                  id: 't1',
                  type: 'SETTLEMENT',
                  amountCents: 1800,
                  description: 'Credito da entrega AQL-1',
                ),
              ],
            ),
            loading: false,
            onRefresh: () async {},
          ),
        ),
      ),
    );
    expect(find.text('Carteira'), findsOneWidget);
    // Valor em real brasileiro: antes a tela imprimia "R$ 18.00" com ponto.
    expect(find.text(r'R$ 18,00'), findsWidgets);
    expect(find.text('Credito da entrega AQL-1'), findsOneWidget);

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
    // Sem sessão gravada, a abertura termina no login.
    final state = CourierAppState(store: MemorySessionStore());
    await tester.pumpWidget(CourierApp(state: state));
    await tester.pumpAndSettle();
    expect(find.text('Acesso do entregador'), findsOneWidget);
  });

  // Auto-login: quem já entrou não vê a tela de login de novo ao reabrir.
  testWidgets('CourierApp restaura a sessao gravada (auto-login)', (
    tester,
  ) async {
    final state = CourierAppState(
      store: MemorySessionStore(
        const StoredSession(
          accessToken: 'token-guardado',
          // Sem refresh token o bootstrap não chama a rede: o teste cobre a
          // restauração, não o servidor.
          refreshToken: null,
          user: {'id': 'u1', 'name': 'Rafael', 'email': 'rafael@teste.com'},
        ),
      ),
    );

    // O shell autenticado liga o envio periódico de localização (15 s), e um
    // timer periódico nunca "assenta" — por isso `pump()` em vez de
    // `pumpAndSettle()`, e o timer é desligado no fim.
    addTearDown(state.stopLocationUpdates);
    await tester.pumpWidget(CourierApp(state: state));
    await tester.pump();
    await tester.pump();

    expect(find.text('Acesso do entregador'), findsNothing);
    expect(state.isAuthenticated, isTrue);
    expect(state.api.accessToken, 'token-guardado');
    expect(state.userName, 'Rafael');
    state.stopLocationUpdates();
  });

  test('logout apaga a sessao gravada do entregador', () async {
    final store = MemorySessionStore(
      const StoredSession(
        accessToken: 'token-guardado',
        refreshToken: null,
        user: {'id': 'u1', 'name': 'Rafael'},
      ),
    );
    final state = CourierAppState(store: store);
    await state.bootstrap();
    expect(state.isAuthenticated, isTrue);

    await state.logout();

    expect(state.isAuthenticated, isFalse);
    expect(await store.read(), isNull);
  });

  // OPS-01A / DEC-26: um APK instalado num celular de verdade não enxerga
  // localhost nem o 10.0.2.2 do emulador.
  test('a URL padrao da API e o dominio publico', () {
    expect(kDefaultApiBaseUrl, 'https://aquilog-api.cursar.space/api/v1');
  });

  // O cadastro do entregador NÃO faz auto-login: a API cria a conta como
  // PENDING e o login só passa depois da aprovação do admin.
  testWidgets('RegisterScreen coleta os dados e confirma a analise', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    Map<String, String?>? enviado;
    await tester.pumpWidget(
      MaterialApp(
        home: RegisterScreen(
          onSubmit:
              ({
                required name,
                required email,
                required password,
                required document,
                required vehicleType,
                String? vehiclePlate,
              }) async {
                enviado = {
                  'name': name,
                  'email': email,
                  'document': document,
                  'vehicleType': vehicleType,
                  'vehiclePlate': vehiclePlate,
                };
                return const CourierRegistration(
                  courierId: 'c1',
                  status: 'PENDING',
                );
              },
        ),
      ),
    );

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Nome completo'),
      'Rafael Entregador',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'E-mail'),
      'rafael@teste.com',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Senha'),
      'SenhaForte123',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'CPF (somente números)'),
      '123.456.789-09',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Placa'),
      'abc1d23',
    );
    await tester.tap(find.text('Enviar cadastro'));
    await tester.pumpAndSettle();

    // CPF vai só com dígitos, como o servidor guarda.
    expect(enviado?['document'], '12345678909');
    expect(enviado?['vehicleType'], 'MOTORCYCLE');
    // A confirmação diz que a conta está em análise — não finge que entrou.
    expect(find.text('Cadastro enviado!'), findsOneWidget);
    expect(find.textContaining('em análise'), findsOneWidget);
  });

  // Bicicleta não tem placa; exigir uma travaria o cadastro.
  testWidgets('RegisterScreen nao pede placa para bicicleta', (tester) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: RegisterScreen(
          onSubmit:
              ({
                required name,
                required email,
                required password,
                required document,
                required vehicleType,
                String? vehiclePlate,
              }) async =>
                  const CourierRegistration(courierId: 'c1', status: 'PENDING'),
        ),
      ),
    );

    expect(find.widgetWithText(TextFormField, 'Placa'), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bicicleta').last);
    await tester.pumpAndSettle();

    expect(find.widgetWithText(TextFormField, 'Placa'), findsNothing);
  });

  // O repasse é o número que decide o aceite; ele já vinha no payload da
  // oferta mas o card não mostrava.
  testWidgets('AvailableDeliveriesScreen mostra o repasse da oferta', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AvailableDeliveriesScreen(
            offers: const [
              {
                'id': 'o1',
                'delivery': {
                  'id': 'd1',
                  'code': 'AQL-REPASSE',
                  'courierFeeCents': 1104,
                  'priceCents': 1380,
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

    expect(find.text('Você recebe'), findsOneWidget);
    expect(find.text(r'R$ 11,04'), findsOneWidget);
  });

  // Oferta expirada / já aceita por outro: 409 e 404 viram uma frase que o
  // entregador entende, em vez de sumir sem explicação.
  testWidgets('AvailableDeliveriesScreen explica oferta que sumiu', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AvailableDeliveriesScreen(
            offers: const [
              {
                'id': 'o1',
                'delivery': {'id': 'd1', 'code': 'AQL-SUMIU'},
              },
            ],
            loading: false,
            available: true,
            onToggleAvailable: (_) {},
            onAccept: (_) async =>
                throw const ApiException('Oferta nao encontrada', 404),
            onReject: (_) async {},
            onRefresh: () async {},
          ),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Aceitar'));
    await tester.pumpAndSettle();

    expect(
      find.text('Essa oferta não está mais disponível.'),
      findsWidgets,
    );
  });

  // Offline o servidor não oferta nada; o app precisa dizer por quê.
  testWidgets('AvailableDeliveriesScreen avisa quando esta offline', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AvailableDeliveriesScreen(
            offers: const [],
            loading: false,
            available: false,
            onToggleAvailable: (_) {},
            onAccept: (_) async {},
            onReject: (_) async {},
            onRefresh: () async {},
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.textContaining('Offline você não recebe ofertas'), findsOneWidget);
  });

  // O servidor recusa AT_PICKUP fora da janela com 409; até esta rodada a
  // recusa não aparecia em lugar nenhum.
  testWidgets('DeliveryDetailScreen mostra a recusa do servidor', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        home: DeliveryDetailScreen(
          delivery: DeliverySummary.fromJson(const {
            'id': 'd1',
            'code': 'AQL-409',
            'status': 'ACCEPTED',
          }),
          onProof: () {},
          onStatus: (status, {proofUrl}) async =>
              throw const ApiException('Fora da janela combinada', 409),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('Sai para entrega'));
    await tester.pumpAndSettle();

    expect(find.text('Fora da janela combinada'), findsOneWidget);
  });

  // PICK-01 / DEC-24 — trava de contrato: o app do entregador nunca deve
  // conseguir ler o código da coleta, mesmo que o servidor volte a mandá-lo.
  test('o app do entregador nao expoe o codigo de recolhimento', () {
    final d = DeliverySummary.fromJson(const {
      'id': 'd1',
      'code': 'AQL-PICK',
      'status': 'AT_PICKUP',
      'pickupCodeRequired': true,
      'pickupCodeAttemptsLeft': 3,
    });
    expect(d.pickupCodeRequired, isTrue);
    expect(d.pickupCode, isNull);
  });
}
