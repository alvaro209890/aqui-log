import 'dart:convert';
import 'dart:io';

import 'package:aqui_log_entregador/main.dart';
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
const _seedCustomerEmail = String.fromEnvironment('QA_SEED_CUSTOMER_EMAIL');
const _seedCustomerPassword = String.fromEnvironment('QA_SEED_CUSTOMER_PASSWORD');
const _seedDeliveryId = String.fromEnvironment('QA_SEED_DELIVERY_ID');

String get _email => 'entregador.$_runId@aquilog.test';
const _password = 'TesteSeguro123!';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'QA-01 prestador: cadastrar → aprovar → disponível → aceitar → coletar → entregar',
    (tester) async {
      expect(_runId, isNotEmpty);
      expect(_adminEmail, isNotEmpty);
      expect(_seedDeliveryId, isNotEmpty);

      await tester.pumpWidget(const CourierApp());
      await _pumpUntil(tester, find.text('Quero ser entregador'), timeout: 20);
      await _shot(binding, 'prestador-01-login');

      await tester.tap(find.text('Quero ser entregador'));
      await tester.pump(const Duration(milliseconds: 400));

      await _fill(tester, 'Nome completo', 'Entregador QA $_runId');
      await _fill(tester, 'E-mail', _email);
      await _fill(tester, 'Senha', _password);
      await _fill(tester, 'CPF (somente números)', _cpfFromRun(_runId));
      await _fill(tester, 'Placa', 'QAB2B22');
      await tester.tap(find.text('Enviar cadastro').hitTestable().first);
      await _pumpUntil(tester, find.text('Cadastro enviado!'), timeout: 25);
      await _shot(binding, 'prestador-02-pendente');

      final admin = await _login(_adminEmail, _adminPassword);
      final courierId = await _findCourierId(admin['token'] as String, _email);
      await _http('PATCH', '/couriers/$courierId/approve', null,
          token: admin['token'] as String);

      await tester.tap(find.text('Voltar para o login'));
      await tester.pump(const Duration(milliseconds: 400));
      await _fill(tester, 'E-mail', _email);
      await _fill(tester, 'Senha', _password);
      await tester.tap(find.text('Entrar'));
      await _pumpUntil(tester, find.textContaining('disponivel'), timeout: 25);
      await _shot(binding, 'prestador-03-logado');

      final switchFinder = find.byType(Switch);
      if (switchFinder.evaluate().isNotEmpty) {
        final sw = tester.widget<Switch>(switchFinder.first);
        if (sw.value != true) {
          await tester.tap(switchFinder.first);
          await tester.pump(const Duration(seconds: 2));
        }
      }
      await _shot(binding, 'prestador-04-disponivel');

      final seedCustomer = await _login(_seedCustomerEmail, _seedCustomerPassword);
      final presign = await _http('POST', '/storage/presign',
          {'purpose': 'product', 'contentType': 'image/jpeg'},
          token: seedCustomer['token'] as String);
      final upUri = Uri.parse(presign['uploadUrl'] as String);
      final upReq = await HttpClient().putUrl(upUri);
      upReq.headers.contentType = ContentType('image', 'jpeg');
      upReq.add(utf8.encode('fake-product-qa'));
      await upReq.close();
      final delivery = await _http('POST', '/deliveries', {
        'pickupAddress': 'Av. Historiador Rubens de Mendonca 1000 Cuiaba',
        'pickupLatitude': -15.58,
        'pickupLongitude': -56.08,
        'deliveryAddress': 'Rua das Flores 200 Cuiaba',
        'deliveryLatitude': -15.60,
        'deliveryLongitude': -56.10,
        'recipientName': 'Destinatario QA',
        'recipientPhone': '65988887777',
        'fulfillmentMode': 'IMMEDIATE',
        'productType': 'OTHER',
        'packageSize': 'SMALL',
        'weightKg': 1.0,
        'deliveryScope': 'SAME_CITY',
        'productPhotoUrls': [presign['fileUrl']],
      }, token: seedCustomer['token'] as String);
      final courierLogin = await _login(_email, _password);
      await _http('PATCH', '/couriers/me/availability', {'available': true},
          token: courierLogin['token'] as String);
      await _http('PATCH', '/couriers/me/location',
          {'latitude': -15.601, 'longitude': -56.097},
          token: courierLogin['token'] as String);
      await _http('POST', '/deliveries/${delivery['id']}/dispatch', null,
          token: admin['token'] as String);

      // A tela de Ofertas só recarrega sob demanda; dispara o refresh.
      for (var i = 0; i < 3; i++) {
        try {
          await tester.tap(find.byIcon(Icons.notifications_none_rounded));
          await tester.pump(const Duration(seconds: 2));
        } catch (_) {}
      }
      // também força recarga trocando de aba e voltando
      try {
        await tester.tap(find.text('Corridas'));
        await tester.pump(const Duration(seconds: 1));
        await tester.tap(find.text('Ofertas'));
        await tester.pump(const Duration(seconds: 2));
      } catch (_) {}

      await _pumpUntil(tester, find.text('Aceitar'), timeout: 40);
      expect(find.textContaining(RegExp(r'R\$|repasse|Repasse')), findsWidgets);
      await tester.tap(find.text('Aceitar').first);
      await tester.pump(const Duration(seconds: 3));
      await _shot(binding, 'prestador-05-aceitou');

      final customer = await _login(_seedCustomerEmail, _seedCustomerPassword);
      final detail = await _http(
        'GET',
        '/deliveries/$_seedDeliveryId',
        null,
        token: customer['token'] as String,
      );
      final pickupCode = '${detail['pickupCode']}';

      if (find.text('Cheguei na coleta').evaluate().isNotEmpty) {
        await tester.tap(find.text('Cheguei na coleta'));
        await tester.pump(const Duration(seconds: 2));
      }
      if (find.text('Enviar comprovante').evaluate().isNotEmpty) {
        await tester.tap(find.text('Enviar comprovante'));
        await tester.pump(const Duration(seconds: 1));
      }
      if (find.text('Capturar foto').evaluate().isNotEmpty) {
        await tester.tap(find.text('Capturar foto'));
        await tester.pump(const Duration(seconds: 1));
      }
      if (find.byType(TextField).evaluate().isNotEmpty && pickupCode.length == 4) {
        await tester.enterText(find.byType(TextField).last, pickupCode);
        await tester.pump();
      }
      if (find.text('Confirmar comprovante').evaluate().isNotEmpty) {
        await tester.tap(find.text('Confirmar comprovante'));
        await tester.pump(const Duration(seconds: 3));
      }
      await _shot(binding, 'prestador-06-coleta');

      if (find.text('Enviar comprovante').evaluate().isNotEmpty) {
        await tester.tap(find.text('Enviar comprovante'));
        await tester.pump(const Duration(seconds: 1));
        if (find.text('Entrega final').evaluate().isNotEmpty) {
          await tester.tap(find.text('Entrega final'));
          await tester.pump();
        }
        if (find.text('Capturar foto').evaluate().isNotEmpty) {
          await tester.tap(find.text('Capturar foto'));
          await tester.pump(const Duration(seconds: 1));
        }
        if (find.text('Confirmar comprovante').evaluate().isNotEmpty) {
          await tester.tap(find.text('Confirmar comprovante'));
          await tester.pump(const Duration(seconds: 3));
        }
      }
      await _shot(binding, 'prestador-07-entregue');
    },
  );
}

Future<void> _fill(WidgetTester tester, String label, String value) async {
  final finder = find.widgetWithText(TextField, label);
  expect(finder, findsWidgets, reason: 'campo "$label" não encontrado');
  await tester.enterText(finder.first, value);
  await tester.pump();
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

Future<void> _shot(IntegrationTestWidgetsFlutterBinding binding, String name) async {
  try {
    await binding.takeScreenshot(name);
  } catch (_) {}
}

String _cpfFromRun(String runId) {
  final n = int.parse(runId.replaceAll(RegExp(r'\D'), '').padLeft(11, '2'));
  return (n % 100000000000).toString().padLeft(11, '2');
}

Future<Map<String, dynamic>> _login(String email, String password) async {
  final body = await _http('POST', '/auth/login', {
    'email': email,
    'password': password,
  });
  return {
    'token': body['accessToken'],
    'id': (body['user'] as Map)['id'],
  };
}

Future<String> _findCourierId(String adminToken, String email) async {
  final body = await _http('GET', '/couriers?status=PENDING', null, token: adminToken);
  final items = body is List ? body : (body['items'] ?? body['data'] ?? []);
  for (final raw in items) {
    final item = raw as Map;
    final mail = item['email'] ?? item['user']?['email'];
    if (mail == email) return item['id'] as String;
  }
  throw Exception('Courier $email não apareceu na fila PENDING');
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
