import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';

import 'session_store.dart';

/// URL da API usada pelo APK distribuído.
///
/// `OPS-01A`/`DEC-26`: o runtime de distribuição roda no PC `acer` atrás do
/// Cloudflare Tunnel, então o padrão precisa ser o domínio público — um APK
/// instalado num celular de verdade não enxerga `localhost` nem o `10.0.2.2`
/// do emulador. Para apontar para outro ambiente, compile com
/// `--dart-define=AQUI_LOG_API=http://10.0.2.2:3011/api/v1`.
const String kDefaultApiBaseUrl = String.fromEnvironment(
  'AQUI_LOG_API',
  defaultValue: 'https://aquilog-api.cursar.space/api/v1',
);

class CustomerAppState extends ChangeNotifier {
  CustomerAppState({AquiLogApiClient? client, SessionStore? store})
    : api = client ?? AquiLogApiClient(baseUrl: kDefaultApiBaseUrl),
      _store = store ?? PrefsSessionStore();

  final AquiLogApiClient api;
  final SessionStore _store;

  AuthSession? session;
  bool loading = false;
  String? error;

  /// Falso enquanto o app ainda está tentando restaurar a sessão guardada.
  /// Enquanto isso a UI mostra a abertura, não a tela de login — senão o
  /// usuário logado vê o login piscar em toda abertura.
  bool booted = false;

  bool get isAuthenticated => session != null && api.accessToken != null;

  /// B2C-04: a confirmação dá para pular no piloto (criar pedido ainda
  /// não exige telefone verificado em local). Quem confirma some a tela.
  bool phoneVerifySkipped = false;

  bool get phoneVerified => session?.user['phoneVerified'] == true;

  bool get needsPhoneVerify {
    if (phoneVerifySkipped) return false;
    final user = session?.user;
    if (user == null || !user.containsKey('phoneVerified')) return false;
    return user['phoneVerified'] != true;
  }

  String? get userPhone {
    final phone = session?.user['phone'];
    return phone is String && phone.isNotEmpty ? phone : null;
  }

  String get userName {
    final name = session?.user['name'];
    return name is String && name.isNotEmpty ? name : 'Cliente';
  }

  String get userEmail {
    final email = session?.user['email'];
    return email is String ? email : '';
  }

  /// Auto-login: restaura a sessão gravada e renova o par de tokens.
  ///
  /// O access token dura pouco (`JWT_EXPIRES_IN`), então restaurar só ele
  /// deixaria o app com um token vencido e todas as telas em erro. Por isso a
  /// abertura troca o refresh token por um par novo; se o refresh não valer
  /// mais (expirado, revogado no logout, servidor recriado), a sessão é
  /// descartada e o app cai no login normalmente.
  Future<void> bootstrap() async {
    try {
      final stored = await _store.read();
      if (stored != null) {
        api.accessToken = stored.accessToken;
        api.refreshToken = stored.refreshToken;
        session = stored.toAuthSession();
        if (stored.refreshToken != null) {
          try {
            final renovada = await api.refresh();
            session = AuthSession(
              accessToken: renovada.accessToken,
              refreshToken: api.refreshToken,
              user: renovada.user.isNotEmpty ? renovada.user : stored.user,
            );
            await _persist();
          } on ApiException {
            await _forgetSession();
          }
        }
      }
    } catch (_) {
      // Armazenamento indisponível não pode impedir o app de abrir.
      await _forgetSession();
    } finally {
      booted = true;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) async {
    return _authenticate(() => api.login(email, password));
  }

  /// Cadastro de cliente (B2C): cria a conta e já autentica.
  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String document,
    required String phone,
  }) {
    return _authenticate(
      () => api.registerCustomer({
        'name': name,
        'email': email,
        'password': password,
        'document': document,
        'phone': phone,
      }),
    );
  }

  Future<bool> _authenticate(Future<AuthSession> Function() call) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await call();
      await _persist();
      await _registerDevice();
      loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> _persist() async {
    final atual = session;
    final token = api.accessToken;
    if (atual == null || token == null) return;
    try {
      await _store.write(
        StoredSession(
          accessToken: token,
          refreshToken: api.refreshToken,
          user: atual.user,
        ),
      );
    } catch (_) {
      // Sem persistência o app segue funcionando nesta sessão.
    }
  }

  Future<Map<String, dynamic>> requestPhoneCode({String? phone}) =>
      api.phoneChallenge(phone: phone);

  Future<void> confirmPhone(String code) async {
    await api.verifyPhone(code);
    final atual = session;
    if (atual != null) {
      session = AuthSession(
        accessToken: atual.accessToken,
        refreshToken: atual.refreshToken,
        user: {...atual.user, 'phoneVerified': true},
      );
      await _persist();
    }
    phoneVerifySkipped = false;
    notifyListeners();
  }

  void skipPhoneVerify() {
    phoneVerifySkipped = true;
    notifyListeners();
  }

  Future<void> _forgetSession() async {
    session = null;
    api.accessToken = null;
    api.refreshToken = null;
    phoneVerifySkipped = false;
    try {
      await _store.clear();
    } catch (_) {}
  }

  Future<void> _registerDevice() async {
    try {
      await api.registerDevice(
        token:
            'local-dev-customer-${session!.user['id']}-${DateTime.now().millisecondsSinceEpoch}',
        platform: defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
      );
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      await api.logout();
    } catch (_) {}
    await _forgetSession();
    notifyListeners();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }
}
