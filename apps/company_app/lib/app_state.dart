import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';

class CustomerAppState extends ChangeNotifier {
  CustomerAppState({AquiLogApiClient? client})
    : api =
          client ??
          AquiLogApiClient(
            baseUrl: const String.fromEnvironment(
              'AQUI_LOG_API',
              defaultValue: 'http://10.0.2.2:3001/api/v1',
            ),
          );

  final AquiLogApiClient api;
  AuthSession? session;
  bool loading = false;
  String? error;

  bool get isAuthenticated => session != null && api.accessToken != null;

  String get userName {
    final name = session?.user['name'];
    return name is String && name.isNotEmpty ? name : 'Cliente';
  }

  Future<bool> login(String email, String password) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await api.login(email, password);
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

  /// Cadastro de cliente (B2C): cria a conta e já autentica.
  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String document,
    required String phone,
  }) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await api.registerCustomer({
        'name': name,
        'email': email,
        'password': password,
        'document': document,
        'phone': phone,
      });
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
    session = null;
    api.accessToken = null;
    api.refreshToken = null;
    notifyListeners();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }
}
