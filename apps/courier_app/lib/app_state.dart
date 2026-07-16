import 'dart:async';

import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

class CourierAppState extends ChangeNotifier {
  CourierAppState({AquiLogApiClient? client})
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
  bool available = true;
  Timer? _locationTimer;

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
      try {
        await api.registerDevice(
          token: 'local-dev-${session!.user['id']}-${DateTime.now().millisecondsSinceEpoch}',
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

  Future<void> setAvailable(bool value) async {
    available = value;
    notifyListeners();
    try {
      await api.setAvailability(value);
    } catch (_) {}
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
    session = null;
    api.accessToken = null;
    api.refreshToken = null;
    notifyListeners();
  }

  @override
  void dispose() {
    stopLocationUpdates();
    api.close();
    super.dispose();
  }
}
