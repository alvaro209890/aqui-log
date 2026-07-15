import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:test/test.dart';

void main() {
  test('autentica e guarda o token', () async {
    final client = MockClient(
      (request) async => http.Response(
        '{"accessToken":"token-local","user":{"id":"1","name":"Teste"}}',
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
    expect(api.accessToken, 'token-local');
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
}
