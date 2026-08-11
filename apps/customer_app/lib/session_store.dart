import 'dart:convert';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Guarda a sessão do cliente entre aberturas do app (auto-login).
///
/// É uma interface para que os testes de widget não dependam do canal de
/// plataforma do `shared_preferences` — o app real usa [PrefsSessionStore] e o
/// teste injeta [MemorySessionStore].
abstract class SessionStore {
  Future<StoredSession?> read();
  Future<void> write(StoredSession session);
  Future<void> clear();
}

/// O que precisa sobreviver ao fechamento do app: os dois tokens e os dados de
/// exibição do usuário (nome/e-mail). Nenhuma senha é guardada.
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

class PrefsSessionStore implements SessionStore {
  static const _key = 'aqui_log_cliente.sessao';

  @override
  Future<StoredSession?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return StoredSession.fromJson(
        jsonDecode(raw) as Map<String, dynamic>,
      );
    } catch (_) {
      // Sessão corrompida (formato antigo, escrita interrompida): descarta em
      // vez de travar o app numa tela de erro.
      await prefs.remove(_key);
      return null;
    }
  }

  @override
  Future<void> write(StoredSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(session.toJson()));
  }

  @override
  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

/// Implementação de memória — usada nos testes e como fallback quando o
/// armazenamento do aparelho falha.
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
