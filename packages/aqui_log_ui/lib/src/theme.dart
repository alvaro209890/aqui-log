import 'package:flutter/material.dart';

/// Tokens semânticos compartilhados pelos dois apps móveis.
abstract final class AquiLogColors {
  // Marca — identidade laranja inspirada no AquiResolve.
  static const primary = Color(0xFFF97316);
  static const primaryHover = Color(0xFFEA580C);
  static const primaryDark = Color(0xFFC2410C);
  static const primarySoft = Color(0xFFFFF7ED);

  // Bases neutras.
  static const surface = Color(0xFFF9FAFB);
  static const ink = Color(0xFF111827);
  static const muted = Color(0xFF6B7280);
  static const line = Color(0xFFE5E7EB);

  // Estados — não usar laranja de marca como substituto destes papéis.
  static const success = Color(0xFF10B981);
  static const successText = Color(0xFF047857);
  static const warning = Color(0xFFF59E0B);
  static const warningText = Color(0xFF92400E);
  static const error = Color(0xFFEF4444);
  static const errorText = Color(0xFFB91C1C);
  static const info = Color(0xFF3B82F6);
  static const infoText = Color(0xFF1D4ED8);

  // Fundos suaves dos estados — usados em cards de aviso (DISP-02).
  static const successSoft = Color(0xFFECFDF5);
  static const warningSoft = Color(0xFFFFFBEB);
  static const errorSoft = Color(0xFFFEF2F2);
  static const infoSoft = Color(0xFFEFF6FF);
}

abstract final class AquiLogTheme {
  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AquiLogColors.primary,
      primary: AquiLogColors.primary,
      secondary: AquiLogColors.primaryHover,
      surface: Colors.white,
      error: AquiLogColors.error,
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
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AquiLogColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AquiLogColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AquiLogColors.primary, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: AquiLogColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: AquiLogColors.line,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AquiLogColors.primarySoft,
        labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 11)),
      ),
    );
  }
}
