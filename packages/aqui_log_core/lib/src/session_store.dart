import 'models.dart';

/// Contrato de persistência da sessão entre aberturas do app (auto-login).
///
/// Fica no core porque os dois apps precisam exatamente do mesmo contrato, mas
/// **sem** a implementação de plataforma: `shared_preferences` é plugin Flutter
/// e este pacote é Dart puro (roda em `dart test`). Cada app liga o contrato ao
/// armazenamento do aparelho com o próprio `PrefsSessionStore`.
abstract class SessionStore {
  Future<StoredSession?> read();
  Future<void> write(StoredSession session);
  Future<void> clear();
}

/// O que precisa sobreviver ao fechamento do app: os dois tokens e os dados de
/// exibição do usuário (nome/e-mail). **Nenhuma senha é guardada.**
class StoredSession {
  const StoredSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String? refreshToken;
  final Map<String, dynamic> user;

  AuthSession toAuthSession() => AuthSession(
    accessToken: accessToken,
    refreshToken: refreshToken,
    user: user,
  );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'user': user,
  };

  /// Devolve `null` quando o que estava gravado não serve para autenticar —
  /// o app precisa cair no login em vez de subir com uma sessão pela metade.
  static StoredSession? fromJson(Map<String, dynamic> json) {
    final access = json['accessToken'];
    if (access is! String || access.isEmpty) return null;
    return StoredSession(
      accessToken: access,
      refreshToken: json['refreshToken'] as String?,
      user: (json['user'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }
}

/// Implementação de memória — usada nos testes e como rede de segurança quando
/// o armazenamento do aparelho falha.
class MemorySessionStore implements SessionStore {
  MemorySessionStore([this._session]);

  StoredSession? _session;

  @override
  Future<StoredSession?> read() async => _session;

  @override
  Future<void> write(StoredSession session) async => _session = session;

  @override
  Future<void> clear() async => _session = null;
}
