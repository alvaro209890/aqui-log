import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';

class CompanyAppState extends ChangeNotifier {
  CompanyAppState({AquiLogApiClient? client})
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
    return name is String && name.isNotEmpty ? name : 'Empresa';
  }

  Future<bool> login(String email, String password) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await api.login(email, password);
      try {
        await api.registerDevice(
          token:
              'local-dev-company-${session!.user['id']}-${DateTime.now().millisecondsSinceEpoch}',
          platform: defaultTargetPlatform == TargetPlatform.iOS
              ? 'ios'
              : 'android',
        );
      } catch (_) {}
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
