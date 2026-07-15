import 'package:flutter/material.dart';

abstract final class AquiLogColors {
  static const forest = Color(0xFF123A31);
  static const forestDark = Color(0xFF0D2A24);
  static const mint = Color(0xFF62D6A9);
  static const surface = Color(0xFFF4F6F3);
  static const ink = Color(0xFF192A25);
  static const muted = Color(0xFF71827B);
  static const line = Color(0xFFE2E8E4);
  static const warning = Color(0xFFE39A45);
}

abstract final class AquiLogTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AquiLogColors.forest,
      primary: AquiLogColors.forest,
      secondary: AquiLogColors.mint,
      surface: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AquiLogColors.surface,
      fontFamily: 'sans-serif',
      appBarTheme: const AppBarTheme(
        backgroundColor: AquiLogColors.surface,
        foregroundColor: AquiLogColors.ink,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: const CardThemeData(
        color: Colors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(18)),
          side: BorderSide(color: AquiLogColors.line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: AquiLogColors.forest,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: Color(0xFFDFF5EC),
        labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11)),
      ),
    );
  }
}
