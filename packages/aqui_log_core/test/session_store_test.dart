import 'dart:convert';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:test/test.dart';

void main() {
  group('StoredSession', () {
    test('sobrevive ao round-trip de JSON', () {
      const original = StoredSession(
        accessToken: 'a',
        refreshToken: 'r',
        user: {'id': 'u1', 'name': 'Álvaro', 'email': 'alvaro@teste.com'},
      );

      // O caminho real passa por texto: é assim que o `shared_preferences`
      // guarda a sessão nos dois apps.
      final decoded = StoredSession.fromJson(
        jsonDecode(jsonEncode(original.toJson())) as Map<String, dynamic>,
      );

      expect(decoded, isNotNull);
      expect(decoded!.accessToken, 'a');
      expect(decoded.refreshToken, 'r');
      expect(decoded.user['name'], 'Álvaro');
    });

    test('sessao sem token de acesso nao vale', () {
      // Sem isso o app subiria "autenticado" com um token vazio e todas as
      // telas voltariam 401 sem cair no login.
      expect(StoredSession.fromJson(const {'user': {}}), isNull);
      expect(StoredSession.fromJson(const {'accessToken': ''}), isNull);
      expect(StoredSession.fromJson(const {'accessToken': 42}), isNull);
    });

    test('sessao sem refresh token continua valendo', () {
      final s = StoredSession.fromJson(const {'accessToken': 'a'});
      expect(s, isNotNull);
      expect(s!.refreshToken, isNull);
      expect(s.user, isEmpty);
    });

    test('vira AuthSession preservando os dois tokens', () {
      const stored = StoredSession(
        accessToken: 'a',
        refreshToken: 'r',
        user: {'name': 'Rafael'},
      );
      final session = stored.toAuthSession();
      expect(session.accessToken, 'a');
      expect(session.refreshToken, 'r');
      expect(session.user['name'], 'Rafael');
    });
  });

  group('MemorySessionStore', () {
    test('grava, le e limpa', () async {
      final store = MemorySessionStore();
      expect(await store.read(), isNull);

      await store.write(
        const StoredSession(accessToken: 'a', refreshToken: null, user: {}),
      );
      expect((await store.read())?.accessToken, 'a');

      await store.clear();
      expect(await store.read(), isNull);
    });
  });

  group('formatCents', () {
    test('formata no padrao brasileiro', () {
      expect(formatCents(0), r'R$ 0,00');
      expect(formatCents(1104), r'R$ 11,04');
      expect(formatCents(123456789), r'R$ 1.234.567,89');
      expect(formatCents(-1380), r'-R$ 13,80');
    });
  });
}
