import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'models.dart';

class AquiLogApiClient {
  AquiLogApiClient({required this.baseUrl, http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  String? accessToken;
  String? refreshToken;
  bool _refreshing = false;

  Future<AuthSession> login(String email, String password) async {
    final data = await _request(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
      auth: false,
    );
    final session = AuthSession.fromJson(data as Map<String, dynamic>);
    accessToken = session.accessToken;
    refreshToken = session.refreshToken;
    return session;
  }

  Future<AuthSession> refresh() async {
    if (refreshToken == null) {
      throw const ApiException('Sem refresh token', 401);
    }
    final data = await _request(
      'POST',
      '/auth/refresh',
      body: {'refreshToken': refreshToken},
      auth: false,
    );
    final session = AuthSession.fromJson(data as Map<String, dynamic>);
    accessToken = session.accessToken;
    refreshToken = session.refreshToken ?? refreshToken;
    return session;
  }

  Future<void> logout() async {
    if (refreshToken != null) {
      try {
        await _request(
          'POST',
          '/auth/logout',
          body: {'refreshToken': refreshToken},
          auth: false,
        );
      } catch (_) {}
    }
    accessToken = null;
    refreshToken = null;
  }

  Future<Map<String, dynamic>> registerCompany(
    Map<String, dynamic> form,
  ) async =>
      (await _request(
            'POST',
            '/auth/register/company',
            body: form,
            auth: false,
          ))
          as Map<String, dynamic>;

  Future<Map<String, dynamic>> registerCourier(
    Map<String, dynamic> form,
  ) async =>
      (await _request(
            'POST',
            '/auth/register/courier',
            body: form,
            auth: false,
          ))
          as Map<String, dynamic>;

  Future<List<DeliverySummary>> deliveries() async {
    final data = await _request('GET', '/deliveries') as List<dynamic>;
    return data
        .map((item) => DeliverySummary.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  Future<DeliverySummary> delivery(String id) async {
    final data = await _request('GET', '/deliveries/$id') as Map<String, dynamic>;
    return DeliverySummary.fromJson(data);
  }

  Future<List<dynamic>> deliveryHistory(String id) async =>
      await _request('GET', '/deliveries/$id/history') as List<dynamic>;

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
    body: {
      'status': status,
      if (proofUrl != null) 'proofUrl': proofUrl,
      if (note != null) 'note': note,
    },
  );

  Future<Map<String, dynamic>> rateDelivery(
    String deliveryId, {
    required int score,
    String? comment,
  }) async =>
      await _request(
            'POST',
            '/deliveries/$deliveryId/rating',
            body: {
              'score': score,
              if (comment != null) 'comment': comment,
            },
          )
          as Map<String, dynamic>;

  Future<List<dynamic>> notifications() async =>
      await _request('GET', '/notifications') as List<dynamic>;

  Future<Map<String, dynamic>> financeSummary() async =>
      await _request('GET', '/finance/summary') as Map<String, dynamic>;

  Future<Map<String, dynamic>> statement() async =>
      await _request('GET', '/finance/statement') as Map<String, dynamic>;

  Future<GeocodeResult> geocode(String address) async {
    final data =
        await _request('POST', '/geo/geocode', body: {'address': address})
            as Map<String, dynamic>;
    return GeocodeResult.fromJson(data);
  }

  Future<PresignResult> presign({
    required String purpose,
    required String contentType,
    String? deliveryId,
  }) async {
    final data =
        await _request(
              'POST',
              '/storage/presign',
              body: {
                'purpose': purpose,
                'contentType': contentType,
                if (deliveryId != null) 'deliveryId': deliveryId,
              },
            )
            as Map<String, dynamic>;
    return PresignResult.fromJson(data);
  }

  Future<String> uploadBytes({
    required Uint8List bytes,
    required String contentType,
    String purpose = 'proof',
    String? deliveryId,
  }) async {
    final signed = await presign(
      purpose: purpose,
      contentType: contentType,
      deliveryId: deliveryId,
    );
    final uri = Uri.parse(signed.uploadUrl);
    final headers = <String, String>{
      'Content-Type': contentType,
      if (accessToken != null) 'Authorization': 'Bearer $accessToken',
    };
    final response = await _client.put(uri, headers: headers, body: bytes);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        'Falha no upload (${response.statusCode})',
        response.statusCode,
      );
    }
    return signed.fileUrl;
  }

  Future<void> registerDevice({
    required String token,
    required String platform,
  }) => _request(
    'POST',
    '/devices',
    body: {'token': token, 'platform': platform},
  );

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    bool retried = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth && accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    final encodedBody = body == null ? null : jsonEncode(body);
    final response = switch (method) {
      'POST' => await _client.post(uri, headers: headers, body: encodedBody),
      'PATCH' => await _client.patch(uri, headers: headers, body: encodedBody),
      'PUT' => await _client.put(uri, headers: headers, body: encodedBody),
      _ => await _client.get(uri, headers: headers),
    };
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode == 401 &&
        auth &&
        !retried &&
        refreshToken != null &&
        !_refreshing) {
      _refreshing = true;
      try {
        await refresh();
      } finally {
        _refreshing = false;
      }
      return _request(method, path, body: body, auth: auth, retried: true);
    }
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
