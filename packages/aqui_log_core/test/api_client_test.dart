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
}
