import 'dart:convert';
import 'dart:io';

import 'package:aqui_log_cliente/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

const _runId = String.fromEnvironment('QA_RUN_ID');
const _api = String.fromEnvironment(
  'AQUI_LOG_API',
  defaultValue: 'http://10.0.2.2:3011/api/v1',
);
const _adminEmail = String.fromEnvironment('QA_ADMIN_EMAIL');
const _adminPassword = String.fromEnvironment('QA_ADMIN_PASSWORD');

String get _email => 'cliente.$_runId@aquilog.test';
const _password = 'TesteSeguro123!';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'QA-01 cliente: cadastrar → telefone → pedido → código → avaliar',
    (tester) async {
      expect(_runId, isNotEmpty, reason: 'QA_RUN_ID obrigatório');
      expect(_adminEmail, isNotEmpty, reason: 'QA_ADMIN_EMAIL obrigatório');

      await tester.pumpWidget(const CustomerApp());
      await _pumpUntil(tester, find.text('Criar conta de cliente'), timeout: 25);
      await _shot(binding, 'cliente-01-login');

      await tester.tap(find.text('Criar conta de cliente'));
      await _pumpUntil(tester, find.text('Cadastro rápido. Sem aprovação.'), timeout: 10);

      await tester.enterText(find.byKey(const ValueKey('qa-nome')), 'Cliente QA $_runId');
      await tester.enterText(find.byKey(const ValueKey('qa-email')), _email);
      await tester.enterText(
        find.byKey(const ValueKey('qa-celular')),
        '6599${_runId.substring(_runId.length - 7)}',
      );
      await tester.enterText(find.byKey(const ValueKey('qa-cpf')), _cpfFromRun(_runId));
      await tester.enterText(find.byKey(const ValueKey('qa-senha')), _password);
      await tester.pump();
      await tester.tap(find.widgetWithText(FilledButton, 'Criar conta'));
      await _pumpUntil(tester, find.text('Confirmar celular'), timeout: 30);
      await _shot(binding, 'cliente-02-telefone');

      await _pumpUntil(
        tester,
        find.textContaining('Codigo de teste:'),
        timeout: 20,
      );
      final codeText = tester
          .widget<Text>(find.textContaining('Codigo de teste:'))
          .data!;
      final code = RegExp(r'(\d{6})').firstMatch(codeText)!.group(1)!;
      await tester.enterText(find.byType(TextField).first, code);
      await tester.pump();
      await tester.tap(find.text('Confirmar'));
      await _pumpUntil(tester, find.text('Fazer pedido'), timeout: 30);
      await _shot(binding, 'cliente-03-home');

      final admin = await _login(_adminEmail, _adminPassword);
      final me = await _login(_email, _password);
      await _http(
        'POST',
        '/finance/accounts/customer/${me['id']}/adjust',
        {'amountCents': 1000000, 'reason': 'Credito QA-01'},
        token: admin['token'] as String,
      );
      final extrato = await _http(
        'GET',
        '/finance/statement',
        null,
        token: me['token'] as String,
      );
      expect(
        extrato['availableCents'],
        greaterThan(0),
        reason: 'crédito QA não caiu: $extrato',
      );

      await tester.tap(find.text('Fazer pedido'));
      await _pumpUntil(tester, find.text('Novo pedido'), timeout: 10);

      Future<void> fillKey(String key, String value) async {
        final finder = find.byKey(ValueKey(key));
        await tester.scrollUntilVisible(
          finder,
          220,
          scrollable: find.byType(Scrollable).last,
        );
        await tester.enterText(finder, value);
        await tester.pump();
      }

      await fillKey('qa-peso', '1.5');
      await fillKey('qa-retirada', 'Av. Historiador Rubens de Mendonca 1000 Cuiaba');
      await fillKey('qa-entrega', 'Rua das Flores 200 Cuiaba');
      await fillKey('qa-destinatario', 'Destinatario QA');
      await fillKey('qa-tel-dest', '65988887777');
      await tester.scrollUntilVisible(
        find.text('Publicar pedido'),
        220,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.text('Publicar pedido'));
      await tester.pump(const Duration(seconds: 2));
      if (find.text('Novo pedido').evaluate().isNotEmpty &&
          find.text('Fazer pedido').evaluate().isEmpty) {
        final textos = tester
            .widgetList<Text>(find.byType(Text))
            .map((t) => t.data)
            .whereType<String>()
            .where((s) => s.length > 6)
            .take(20)
            .toList();
        fail('Pedido não publicou. Textos na tela: $textos');
      }
      await _pumpUntil(tester, find.text('Fazer pedido'), timeout: 45);
      await _shot(binding, 'cliente-04-pedido-publicado');

      final deliveryId = await _firstDeliveryId(me['token'] as String);
      await _finishViaApi(admin, deliveryId);

      await tester.tap(find.textContaining('AL-').first);
      await tester.pump(const Duration(seconds: 2));
      expect(find.textContaining('Procurando um motoboy'), findsNothing);
      await _shot(binding, 'cliente-05-codigo-recolhimento');

      if (find.text('Enviar avaliacao').evaluate().isNotEmpty) {
        await tester.ensureVisible(find.text('Enviar avaliacao'));
        await tester.tap(find.text('Enviar avaliacao'));
        await tester.pump(const Duration(seconds: 2));
        await _shot(binding, 'cliente-06-avaliacao');
      }
    },
  );
}

Future<void> _pumpUntil(
  WidgetTester tester,
  Finder finder, {
  int timeout = 15,
}) async {
  final end = DateTime.now().add(Duration(seconds: timeout));
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 300));
    if (finder.evaluate().isNotEmpty) return;
  }
  fail('Não apareceu $finder em ${timeout}s');
}

Future<void> _shot(
  IntegrationTestWidgetsFlutterBinding binding,
  String name,
) async {
  try {
    await binding.takeScreenshot(name);
  } catch (_) {}
}

String _cpfFromRun(String runId) {
  final digits = runId.replaceAll(RegExp(r'\D'), '').padLeft(11, '1');
  return digits.substring(digits.length - 11);
}

Future<Map<String, dynamic>> _login(String email, String password) async {
  final body = await _http('POST', '/auth/login', {
    'email': email,
    'password': password,
  });
  return {
    'token': body['accessToken'],
    'id': (body['user'] as Map)['customerId'] ?? (body['user'] as Map)['id'],
  };
}

Future<String> _firstDeliveryId(String token) async {
  final body = await _http('GET', '/deliveries', null, token: token);
  final items = body is List ? body : (body['items'] ?? body['data'] ?? []);
  return (items.first as Map)['id'] as String;
}

Future<void> _finishViaApi(
  Map<String, dynamic> admin,
  String deliveryId,
) async {
  final courierEmail = 'motoboy.api.$_runId@aquilog.test';
  final created = await _http('POST', '/auth/register/courier', {
    'name': 'Motoboy API $_runId',
    'email': courierEmail,
    'password': _password,
    'document': _cpfFromRun('${_runId}9'),
    'vehicleType': 'MOTORCYCLE',
    'vehiclePlate': 'QAA1A11',
  });
  final pending = await _http(
    'GET',
    '/couriers?status=PENDING',
    null,
    token: admin['token'] as String,
  );
  final items = pending is List ? pending : (pending['items'] ?? pending['data'] ?? []);
  final match = (items as List).cast<Map>().firstWhere(
    (c) => (c['email'] ?? c['user']?['email']) == courierEmail,
    orElse: () => {'id': created['id']},
  );
  final courierId = match['id'];
  await _http(
    'PATCH',
    '/couriers/$courierId/approve',
    null,
    token: admin['token'] as String,
  );
  final session = await _login(courierEmail, _password);
  final token = session['token'] as String;
  await _http(
    'PATCH',
    '/couriers/me/availability',
    {'available': true},
    token: token,
  );
  await _http('POST', '/couriers/me/location', {
    'latitude': -15.601,
    'longitude': -56.097,
  }, token: token);

  var offers = await _http('GET', '/deliveries/offers/mine', null, token: token);
  if (offers is! List || offers.isEmpty) {
    await _http(
      'POST',
      '/deliveries/$deliveryId/dispatch',
      null,
      token: admin['token'] as String,
    );
    offers = await _http('GET', '/deliveries/offers/mine', null, token: token);
  }
  final offerId = (offers as List).first['id'] as String;
  await _http('PATCH', '/deliveries/offers/$offerId/accept', null, token: token);

  final customer = await _login(_email, _password);
  final detail = await _http(
    'GET',
    '/deliveries/$deliveryId',
    null,
    token: customer['token'] as String,
  );
  final pickupCode = '${detail['pickupCode']}';
  await _http(
    'PATCH',
    '/deliveries/$deliveryId/status',
    {'status': 'AT_PICKUP'},
    token: token,
  );
  await _http(
    'PATCH',
    '/deliveries/$deliveryId/status',
    {'status': 'PICKED_UP', 'pickupCode': pickupCode},
    token: token,
  );
  await _http(
    'PATCH',
    '/deliveries/$deliveryId/status',
    {'status': 'DELIVERED'},
    token: token,
  );
}

Future<dynamic> _http(
  String method,
  String path,
  Map<String, dynamic>? body, {
  String? token,
}) async {
  final client = HttpClient();
  try {
    final req = await client.openUrl(method, Uri.parse('$_api$path'));
    req.headers.contentType = ContentType.json;
    if (token != null) {
      req.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    }
    if (body != null) req.add(utf8.encode(jsonEncode(body)));
    final res = await req.close();
    final text = await res.transform(utf8.decoder).join();
    if (res.statusCode >= 400) {
      throw Exception('$method $path → ${res.statusCode} $text');
    }
    if (text.isEmpty) return {};
    return jsonDecode(text);
  } finally {
    client.close();
  }
}
