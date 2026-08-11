import 'dart:convert';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

// `SessionStore`, `StoredSession` e `MemorySessionStore` moraram aqui até
// 2026-08-11, quando o app do entregador passou a precisar do mesmo contrato.
// A parte comum (contrato + modelo + implementação de memória) foi para o
// `aqui_log_core`, que é Dart puro e roda em `dart test`; aqui fica só a
// ligação com o armazenamento do aparelho. O reexport mantém os imports
// existentes do app funcionando sem mudança.
export 'package:aqui_log_core/aqui_log_core.dart'
    show SessionStore, StoredSession, MemorySessionStore;

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
