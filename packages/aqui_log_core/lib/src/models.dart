class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.user,
    this.refreshToken,
  });

  final String accessToken;
  final String? refreshToken;
  final Map<String, dynamic> user;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken'] as String,
    refreshToken: json['refreshToken'] as String?,
    user: json['user'] as Map<String, dynamic>,
  );
}

class DeliverySummary {
  const DeliverySummary({
    required this.id,
    required this.code,
    required this.status,
    this.pickupAddress,
    this.deliveryAddress,
    this.pickupLatitude,
    this.pickupLongitude,
    this.deliveryLatitude,
    this.deliveryLongitude,
    this.recipientName,
    this.priceCents,
    this.courierFeeCents,
  });

  final String id;
  final String code;
  final String status;
  final String? pickupAddress;
  final String? deliveryAddress;
  final double? pickupLatitude;
  final double? pickupLongitude;
  final double? deliveryLatitude;
  final double? deliveryLongitude;
  final String? recipientName;
  final int? priceCents;
  final int? courierFeeCents;

  factory DeliverySummary.fromJson(Map<String, dynamic> json) =>
      DeliverySummary(
        id: json['id'] as String,
        code: json['code'] as String,
        status: json['status'] as String,
        pickupAddress: json['pickupAddress'] as String?,
        deliveryAddress: json['deliveryAddress'] as String?,
        pickupLatitude: _toDouble(json['pickupLatitude']),
        pickupLongitude: _toDouble(json['pickupLongitude']),
        deliveryLatitude: _toDouble(json['deliveryLatitude']),
        deliveryLongitude: _toDouble(json['deliveryLongitude']),
        recipientName: json['recipientName'] as String?,
        priceCents: json['priceCents'] as int?,
        courierFeeCents: json['courierFeeCents'] as int?,
      );
}

double? _toDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

class GeocodeResult {
  const GeocodeResult({
    required this.latitude,
    required this.longitude,
    required this.formattedAddress,
  });

  final double latitude;
  final double longitude;
  final String formattedAddress;

  factory GeocodeResult.fromJson(Map<String, dynamic> json) => GeocodeResult(
    latitude: _toDouble(json['latitude']) ?? 0,
    longitude: _toDouble(json['longitude']) ?? 0,
    formattedAddress: (json['formattedAddress'] as String?) ?? '',
  );
}

class PresignResult {
  const PresignResult({
    required this.uploadUrl,
    required this.fileUrl,
    required this.key,
  });

  final String uploadUrl;
  final String fileUrl;
  final String key;

  factory PresignResult.fromJson(Map<String, dynamic> json) => PresignResult(
    uploadUrl: json['uploadUrl'] as String,
    fileUrl: json['fileUrl'] as String,
    key: json['key'] as String,
  );
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => message;
}
