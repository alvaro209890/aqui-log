import 'dart:convert';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Contrato, modelo e implementação de memória vivem no `aqui_log_core` (Dart
// puro, testável em `dart test`); aqui fica só a ligação com o armazenamento
// do aparelho, que é plugin Flutter.
export 'package:aqui_log_core/aqui_log_core.dart'
    show SessionStore, StoredSession, MemorySessionStore;

class PrefsSessionStore implements SessionStore {
  // Chave própria do app do entregador: cliente e entregador podem estar
  // instalados no mesmo aparelho e não podem trocar de sessão entre si.
  static const _key = 'aqui_log_entregador.sessao';

  @override
  Future<StoredSession?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return StoredSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
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
