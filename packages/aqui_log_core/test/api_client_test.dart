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
}
