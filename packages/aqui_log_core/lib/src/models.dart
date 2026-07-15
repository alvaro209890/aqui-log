class AuthSession {
  const AuthSession({required this.accessToken, required this.user});

  final String accessToken;
  final Map<String, dynamic> user;

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
    accessToken: json['accessToken'] as String,
    user: json['user'] as Map<String, dynamic>,
  );
}

class DeliverySummary {
  const DeliverySummary({
    required this.id,
    required this.code,
    required this.status,
  });

  final String id;
  final String code;
  final String status;

  factory DeliverySummary.fromJson(Map<String, dynamic> json) =>
      DeliverySummary(
        id: json['id'] as String,
        code: json['code'] as String,
        status: json['status'] as String,
      );
}

class ApiException implements Exception {
  const ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;

  @override
  String toString() => message;
}
