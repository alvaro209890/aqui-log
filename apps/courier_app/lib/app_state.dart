import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';

class CourierAppState extends ChangeNotifier {
  CourierAppState({AquiLogApiClient? client})
    : api = client ??
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
  bool available = true;

  bool get isAuthenticated => session != null && api.accessToken != null;

  String get userName {
    final name = session?.user['name'];
    return name is String && name.isNotEmpty ? name : 'Entregador';
  }

  Future<bool> login(String email, String password) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      session = await api.login(email, password);
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

  Future<void> setAvailable(bool value) async {
    available = value;
    notifyListeners();
    try {
      await api.setAvailability(value);
    } catch (_) {
      // keep local toggle for offline UX
    }
  }

  void logout() {
    session = null;
    api.accessToken = null;
    notifyListeners();
  }

  @override
  void dispose() {
    api.close();
    super.dispose();
  }
}
