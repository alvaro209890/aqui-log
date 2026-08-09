import 'order_meta.dart';

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
    this.notes,
    this.orderMeta,
    this.pickupCode,
    this.pickupCodeRequired = false,
    this.pickupCodeAttemptsLeft,
    this.pickupCodeBlockedUntil,
    this.fulfillmentMode = 'IMMEDIATE',
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.deliveryWindowStart,
    this.deliveryWindowEnd,
    this.kmRateCents,
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

  /// Observação livre. Em pedidos antigos também pode conter o bloco legado.
  final String? notes;

  /// Dados estruturados da encomenda, com fallback automático para `notes`.
  final OrderMeta? orderMeta;

  /// PICK-01 / DEC-24: código de recolhimento. O servidor só manda para o
  /// cliente e para admin/suporte — no app do entregador vem sempre nulo, e é
  /// ele quem digita o que o cliente mostrar.
  final String? pickupCode;

  /// Se a coleta deste pedido exige código. Falso em pedido legado.
  final bool pickupCodeRequired;

  /// Tentativas restantes antes do bloqueio temporário (`FLOW-DEC-03`).
  final int? pickupCodeAttemptsLeft;

  /// Fim do bloqueio temporário por tentativas erradas, quando houver.
  final DateTime? pickupCodeBlockedUntil;

  /// SCHED-01 / DEC-18: `IMMEDIATE` ou `SCHEDULED`. Pedido legado, criado antes
  /// do modo existir, é lido como `IMMEDIATE` — é o default da coluna.
  final String fulfillmentMode;

  /// Janela de coleta combinada. Nula fora do modo agendado.
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;

  /// Janela de entrega — opcional mesmo no agendado.
  final DateTime? deliveryWindowStart;
  final DateTime? deliveryWindowEnd;

  /// Tarifa por km congelada na criação (`DEC-19`).
  final int? kmRateCents;

  bool get isScheduled => fulfillmentMode == 'SCHEDULED';

  /// DEC-20: aceito, mas a janela ainda não começou — está na agenda, não em
  /// execução. É o que separa "Agenda" de "Em andamento" (`COUR-01`).
  bool get scheduledAhead =>
      isScheduled &&
      pickupWindowStart != null &&
      pickupWindowStart!.isAfter(DateTime.now());

  /// Bloqueio ainda em vigor neste instante.
  bool get pickupCodeBlocked =>
      pickupCodeBlockedUntil != null &&
      pickupCodeBlockedUntil!.isAfter(DateTime.now());

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
        notes: json['notes'] as String?,
        orderMeta: OrderMeta.fromDeliveryJson(json),
        pickupCode: json['pickupCode'] as String?,
        pickupCodeRequired: json['pickupCodeRequired'] == true,
        pickupCodeAttemptsLeft: (json['pickupCodeAttemptsLeft'] as num?)
            ?.toInt(),
        pickupCodeBlockedUntil: _toDate(json['pickupCodeBlockedUntil']),
        fulfillmentMode:
            (json['fulfillmentMode'] as String?) ?? 'IMMEDIATE',
        pickupWindowStart: _toDate(json['pickupWindowStart']),
        pickupWindowEnd: _toDate(json['pickupWindowEnd']),
        deliveryWindowStart: _toDate(json['deliveryWindowStart']),
        deliveryWindowEnd: _toDate(json['deliveryWindowEnd']),
        kmRateCents: (json['kmRateCents'] as num?)?.toInt(),
      );
}

DateTime? _toDate(dynamic value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
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
