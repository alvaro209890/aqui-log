import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class AquiLogApiClient {
  AquiLogApiClient({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? accessToken;

  Future<AuthSession> login(String email, String password) async {
    final data = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
    );
    final session = AuthSession.fromJson(data as Map<String, dynamic>);
    accessToken = session.accessToken;
    return session;
  }

  Future<Map<String, dynamic>> registerCompany(
    Map<String, dynamic> form,
  ) async =>
      (await _request('POST', '/auth/register/company', body: form))
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> registerCourier(
    Map<String, dynamic> form,
  ) async =>
      (await _request('POST', '/auth/register/courier', body: form))
          as Map<String, dynamic>;

  Future<List<DeliverySummary>> deliveries() async {
    final data = await _request('GET', '/deliveries') as List<dynamic>;
    return data
        .map((item) => DeliverySummary.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<List<dynamic>> offers() async =>
      await _request('GET', '/deliveries/offers/mine') as List<dynamic>;

  Future<void> acceptOffer(String offerId) =>
      _request('PATCH', '/deliveries/offers/$offerId/accept');

  Future<void> rejectOffer(String offerId) =>
      _request('PATCH', '/deliveries/offers/$offerId/reject');

  Future<void> setAvailability(bool available) => _request(
    'PATCH',
    '/couriers/me/availability',
    body: {'available': available},
  );

  Future<void> sendLocation(double latitude, double longitude) => _request(
    'PATCH',
    '/couriers/me/location',
    body: {'latitude': latitude, 'longitude': longitude},
  );

  Future<Map<String, dynamic>> createDelivery(
    Map<String, dynamic> form,
  ) async =>
      await _request('POST', '/deliveries', body: form) as Map<String, dynamic>;

  Future<void> updateDeliveryStatus(
    String deliveryId,
    String status, {
    String? proofUrl,
    String? note,
  }) => _request(
    'PATCH',
    '/deliveries/$deliveryId/status',
    body: {'status': status, 'proofUrl': ?proofUrl, 'note': ?note},
  );

  Future<List<dynamic>> notifications() async =>
      await _request('GET', '/notifications') as List<dynamic>;

  Future<Map<String, dynamic>> financeSummary() async =>
      await _request('GET', '/finance/summary') as Map<String, dynamic>;

  Future<Map<String, dynamic>> statement() async =>
      await _request('GET', '/finance/statement') as Map<String, dynamic>;

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (accessToken != null) headers['Authorization'] = 'Bearer $accessToken';
    final encodedBody = body == null ? null : jsonEncode(body);
    final response = switch (method) {
      'POST' => await _client.post(uri, headers: headers, body: encodedBody),
      'PATCH' => await _client.patch(uri, headers: headers, body: encodedBody),
      _ => await _client.get(uri, headers: headers),
    };
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final rawMessage = decoded is Map<String, dynamic>
          ? decoded['message']
          : null;
      final message = rawMessage is List
          ? rawMessage.join(', ')
          : rawMessage?.toString();
      throw ApiException(
        message ?? 'Erro ao comunicar com a Aqui Log',
        response.statusCode,
      );
    }
    return decoded;
  }

  void close() => _client.close();
}
