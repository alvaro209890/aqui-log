import 'dart:convert';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

void main() {
  test('autentica e guarda o token e refresh', () async {
    final client = MockClient(
      (request) async => http.Response(
        '{"accessToken":"token-local","refreshToken":"refresh-local","user":{"id":"1","name":"Teste"}}',
        200,
        headers: {'content-type': 'application/json'},
      ),
    );
    final api = AquiLogApiClient(
      baseUrl: 'http://localhost/api/v1',
      client: client,
    );
    final session = await api.login('teste@aquilog.com.br', 'Senha123!');
    expect(session.accessToken, 'token-local');
    expect(session.refreshToken, 'refresh-local');
    expect(api.accessToken, 'token-local');
    expect(api.refreshToken, 'refresh-local');
  });

  test('traduz erros da API', () async {
    final client = MockClient(
      (request) async => http.Response('{"message":"Acesso negado"}', 403),
    );
    final api = AquiLogApiClient(
      baseUrl: 'http://localhost/api/v1',
      client: client,
    );
    expect(() => api.deliveries(), throwsA(isA<ApiException>()));
  });

  test('DeliverySummary parseia enderecos e coords', () {
    final d = DeliverySummary.fromJson({
      'id': '1',
      'code': 'AQL-1',
      'status': 'REQUESTED',
      'pickupAddress': 'Rua A',
      'deliveryAddress': 'Rua B',
      'pickupLatitude': -15.6,
      'pickupLongitude': -56.1,
    });
    expect(d.pickupAddress, 'Rua A');
    expect(d.pickupLatitude, -15.6);
    expect(d.courierCancelAllowed, isFalse);
  });

  test('DeliverySummary parseia a janela de cancelamento do prestador', () {
    final d = DeliverySummary.fromJson({
      'id': '9',
      'code': 'AQL-C02',
      'status': 'ACCEPTED',
      'courierCancelFeeCents': 300,
      'courierCancelAllowed': true,
      'courierCancelUntil': '2026-08-19T15:05:00.000Z',
    });
    expect(d.courierCancelAllowed, isTrue);
    expect(d.courierCancelFeeCents, 300);
    expect(d.courierCancelUntil, isNotNull);
  });

  test('OrderMeta serializa codigos estaveis para a API', () {
    const meta = OrderMeta(
      productType: 'Eletrônico',
      size: 'Médio',
      weightKg: 2.5,
      scope: 'Outra cidade ou município',
      photoUrls: ['http://storage/foto.jpg'],
      notes: 'Frágil, manusear com cuidado',
    );

    expect(meta.toApiJson(), {
      'productType': 'ELECTRONICS',
      'packageSize': 'MEDIUM',
      'weightKg': 2.5,
      'deliveryScope': 'OTHER_CITY',
      'productPhotoUrls': ['http://storage/foto.jpg'],
      'notes': 'Frágil, manusear com cuidado',
    });
  });

  test('DeliverySummary prefere campos estruturados', () {
    final delivery = DeliverySummary.fromJson({
      'id': '2',
      'code': 'AQL-2',
      'status': 'OFFERED',
      'productType': 'FRAGILE',
      'packageSize': 'LARGE',
      'weightKg': '8.250',
      'deliveryScope': 'SAME_CITY',
      'productPhotoUrls': ['http://storage/novo.jpg'],
      'notes': 'Manter na vertical',
    });

    expect(delivery.orderMeta, isNotNull);
    expect(delivery.orderMeta!.productType, 'Frágil');
    expect(delivery.orderMeta!.size, 'Grande');
    expect(delivery.orderMeta!.weightKg, 8.25);
    expect(delivery.orderMeta!.photoUrl, 'http://storage/novo.jpg');
    expect(delivery.orderMeta!.notes, 'Manter na vertical');
  });

  test('DeliverySummary le o codigo de recolhimento do cliente (PICK-01)', () {
    final delivery = DeliverySummary.fromJson({
      'id': '4',
      'code': 'AQL-4',
      'status': 'AT_PICKUP',
      'pickupCode': '4207',
      'pickupCodeRequired': true,
      'pickupCodeAttemptsLeft': 3,
    });

    expect(delivery.pickupCode, '4207');
    expect(delivery.pickupCodeRequired, isTrue);
    expect(delivery.pickupCodeAttemptsLeft, 3);
    expect(delivery.pickupCodeBlocked, isFalse);
  });

  test('DeliverySummary do entregador nao traz o codigo, so a exigencia', () {
    final delivery = DeliverySummary.fromJson({
      'id': '5',
      'code': 'AQL-5',
      'status': 'AT_PICKUP',
      'pickupCodeRequired': true,
      'pickupCodeAttemptsLeft': 0,
      'pickupCodeBlockedUntil': DateTime.now()
          .toUtc()
          .add(const Duration(minutes: 10))
          .toIso8601String(),
    });

    expect(delivery.pickupCode, isNull);
    expect(delivery.pickupCodeRequired, isTrue);
    expect(delivery.pickupCodeBlocked, isTrue);
  });

  test('pedido legado nao passa a exigir codigo (PICK-01)', () {
    final delivery = DeliverySummary.fromJson({
      'id': '6',
      'code': 'AQL-6',
      'status': 'AT_PICKUP',
    });

    expect(delivery.pickupCodeRequired, isFalse);
    expect(delivery.pickupCodeAttemptsLeft, isNull);
    expect(delivery.pickupCodeBlocked, isFalse);
  });

  test('envia o codigo de recolhimento na transicao de coleta', () async {
    Map<String, dynamic>? sent;
    final client = MockClient((request) async {
      sent = jsonDecode(request.body) as Map<String, dynamic>;
      return http.Response('{}', 200);
    });
    final api = AquiLogApiClient(
      baseUrl: 'http://localhost/api/v1',
      client: client,
    );

    await api.updateDeliveryStatus(
      'delivery-1',
      'PICKED_UP',
      proofUrl: 'http://localhost/api/v1/storage/files/proof.jpg',
      pickupCode: '4207',
    );

    expect(sent!['pickupCode'], '4207');
    expect(sent!['status'], 'PICKED_UP');

    await api.updateDeliveryStatus('delivery-1', 'IN_TRANSIT');
    expect(sent!.containsKey('pickupCode'), isFalse);
  });

  test('DeliverySummary mantem fallback para notes legado', () {
    final delivery = DeliverySummary.fromJson({
      'id': '3',
      'code': 'AQL-3',
      'status': 'REQUESTED',
      'notes':
          'ENCOMENDA | Tipo: Documento | Tamanho: Pequeno | Peso: 0,5 kg | Alcance: Mesma cidade\nOBS: Envelope pardo',
    });

    expect(delivery.orderMeta, isNotNull);
    expect(delivery.orderMeta!.productType, 'Documento');
    expect(delivery.orderMeta!.weightKg, 0.5);
    expect(delivery.orderMeta!.notes, 'Envelope pardo');
  });

  // SCHED-01 / DEC-18 — modo e janela.
  test('DeliverySummary le modo agendado e janela', () {
    final start = DateTime.now().add(const Duration(hours: 2));
    final end = start.add(const Duration(hours: 1));
    final delivery = DeliverySummary.fromJson({
      'id': '4',
      'code': 'AQL-4',
      'status': 'ACCEPTED',
      'fulfillmentMode': 'SCHEDULED',
      'pickupWindowStart': start.toUtc().toIso8601String(),
      'pickupWindowEnd': end.toUtc().toIso8601String(),
      'kmRateCents': 180,
    });

    expect(delivery.isScheduled, isTrue);
    expect(delivery.scheduledAhead, isTrue);
    expect(delivery.kmRateCents, 180);
    expect(
      delivery.pickupWindowStart!.difference(start).inSeconds.abs() < 2,
      isTrue,
    );
  });

  test('pedido legado sem modo continua valendo como imediato', () {
    final delivery = DeliverySummary.fromJson({
      'id': '5',
      'code': 'AQL-5',
      'status': 'DELIVERED',
    });

    expect(delivery.fulfillmentMode, 'IMMEDIATE');
    expect(delivery.isScheduled, isFalse);
    expect(delivery.scheduledAhead, isFalse);
    expect(delivery.pickupWindowStart, isNull);
  });

  test('agendado cuja janela ja comecou sai da agenda', () {
    final start = DateTime.now().subtract(const Duration(minutes: 5));
    final delivery = DeliverySummary.fromJson({
      'id': '6',
      'code': 'AQL-6',
      'status': 'ACCEPTED',
      'fulfillmentMode': 'SCHEDULED',
      'pickupWindowStart': start.toUtc().toIso8601String(),
      'pickupWindowEnd':
          start.add(const Duration(hours: 1)).toUtc().toIso8601String(),
    });

    expect(delivery.isScheduled, isTrue);
    expect(delivery.scheduledAhead, isFalse);
  });

  test('formatPickupWindow resume a janela do mesmo dia', () {
    final start = DateTime(2026, 8, 10, 14, 0);
    final end = DateTime(2026, 8, 10, 15, 30);

    expect(formatPickupWindow(start, end), '10/08 das 14:00 às 15:30');
    expect(formatPickupWindow(null, null), 'Sem janela definida');
  });
}
