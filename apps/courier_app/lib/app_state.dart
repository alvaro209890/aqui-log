import 'dart:async';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import 'session_store.dart';

/// URL da API usada pelo APK distribuído.
///
/// `OPS-01A`/`DEC-26`: o runtime roda no PC `acer` atrás do Cloudflare Tunnel,
/// então o padrão precisa ser o domínio público — um APK instalado num celular
/// de verdade não enxerga `localhost` nem o `10.0.2.2` do emulador. Para outro
/// ambiente, compile com
/// `--dart-define=AQUI_LOG_API=http://10.0.2.2:3011/api/v1`.
const String kDefaultApiBaseUrl = String.fromEnvironment(
  'AQUI_LOG_API',
  defaultValue: 'https://aquilog-api.cursar.space/api/v1',
);

/// Resultado do cadastro de entregador.
///
/// Diferente do cliente, o entregador **não** entra direto: `POST
/// /auth/register/courier` devolve `status: PENDING` e sem tokens, e o login só
/// passa depois que um admin aprova (`PATCH /couriers/:id/approve`). O app
/// precisa dessa distinção para dizer "aguarde a aprovação" em vez de fingir
/// que deu errado.
class CourierRegistration {
  const CourierRegistration({required this.courierId, required this.status});

  final String courierId;
  final String status;

  bool get pending => status.toUpperCase() != 'ACTIVE';
}

class CourierAppState extends ChangeNotifier {
  CourierAppState({AquiLogApiClient? client, SessionStore? store})
    : api = client ?? AquiLogApiClient(baseUrl: kDefaultApiBaseUrl),
      _store = store ?? PrefsSessionStore();

  final AquiLogApiClient api;
  final SessionStore _store;

  AuthSession? session;
  bool loading = false;
  String? error;
  bool available = true;
  Timer? _locationTimer;

  /// Falso enquanto o app ainda tenta restaurar a sessão gravada. Enquanto
  /// isso a UI mostra a abertura, não o login — senão o entregador logado vê o
  /// login piscar em toda abertura.
  bool booted = false;

  bool get isAuthenticated => session != null && api.accessToken != null;

  String get userName {
    final name = session?.user['name'];
    return name is String && name.isNotEmpty ? name : 'Entregador';
  }

  String get userEmail {
    final email = session?.user['email'];
    return email is String ? email : '';
  }

  /// Auto-login: restaura a sessão gravada e renova o par de tokens.
  ///
  /// O access token dura pouco (`JWT_EXPIRES_IN`), então restaurar só ele
  /// deixaria o app com um token vencido e todas as telas em erro. Se o refresh
  /// não valer mais (expirado, revogado no logout, **conta suspensa pelo
  /// admin**), a sessão é descartada e o app cai no login.
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
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await api.login(email, password);
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

  /// Cadastro de entregador. Devolve `null` quando falha (o motivo fica em
  /// [error]); em caso de sucesso devolve o estado da conta, que é `PENDING`
  /// até um admin aprovar.
  Future<CourierRegistration?> register({
    required String name,
    required String email,
    required String password,
    required String document,
    required String vehicleType,
    String? vehiclePlate,
  }) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.registerCourier({
        'name': name,
        'email': email,
        'password': password,
        'document': document,
        'vehicleType': vehicleType,
        if (vehiclePlate != null && vehiclePlate.isNotEmpty)
          'vehiclePlate': vehiclePlate,
      });
      loading = false;
      notifyListeners();
      return CourierRegistration(
        courierId: '${data['courierId'] ?? ''}',
        status: '${data['status'] ?? 'PENDING'}',
      );
    } on ApiException catch (e) {
      error = e.message;
      loading = false;
      notifyListeners();
      return null;
    } catch (e) {
      error = e.toString();
      loading = false;
      notifyListeners();
      return null;
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

  Future<void> _forgetSession() async {
    session = null;
    api.accessToken = null;
    api.refreshToken = null;
    try {
      await _store.clear();
    } catch (_) {}
  }

  Future<void> _registerDevice() async {
    try {
      await api.registerDevice(
        token:
            'local-dev-${session!.user['id']}-${DateTime.now().millisecondsSinceEpoch}',
        platform: defaultTargetPlatform == TargetPlatform.iOS
            ? 'ios'
            : 'android',
      );
    } catch (_) {}
  }

  Future<void> setAvailable(bool value) async {
    available = value;
    notifyListeners();
    try {
      await api.setAvailability(value);
    } catch (e) {
      // O servidor é a autoridade: se a troca não foi aceita, o switch não
      // pode continuar mostrando um estado que a operação não conhece.
      available = !value;
      error = e is ApiException
          ? e.message
          : 'Não foi possível mudar a disponibilidade.';
      notifyListeners();
      return;
    }
    if (value) {
      startLocationUpdates();
    } else {
      stopLocationUpdates();
    }
  }

  void startLocationUpdates() {
    _locationTimer?.cancel();
    _locationTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      unawaited(_pushLocation());
    });
    unawaited(_pushLocation());
  }

  void stopLocationUpdates() {
    _locationTimer?.cancel();
    _locationTimer = null;
  }

  Future<void> _pushLocation() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      await api.sendLocation(pos.latitude, pos.longitude);
    } catch (_) {
      // device/tests without GPS
    }
  }

  Future<void> logout() async {
    stopLocationUpdates();
    try {
      await api.logout();
    } catch (_) {}
    await _forgetSession();
    notifyListeners();
  }

  @override
  void dispose() {
    stopLocationUpdates();
    api.close();
    super.dispose();
  }
}
