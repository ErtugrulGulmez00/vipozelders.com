import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Sitedeki marka renkleri (Tailwind brand / gold paleti).
class Brand {
  Brand._();

  static const b50 = Color(0xFFEEF2FF);
  static const b100 = Color(0xFFE0E7FF);
  static const b200 = Color(0xFFC7D2FE);
  static const b300 = Color(0xFFA5B4FC);
  static const b400 = Color(0xFF818CF8);
  static const b500 = Color(0xFF6366F1);
  static const b600 = Color(0xFF4F46E5);
  static const b700 = Color(0xFF4338CA);
  static const b800 = Color(0xFF3730A3);
  static const b900 = Color(0xFF312E81);
  static const b950 = Color(0xFF1E1B4B);

  static const gold50 = Color(0xFFFFFBEB);
  static const gold100 = Color(0xFFFEF3C7);
  static const gold300 = Color(0xFFFCD34D);
  static const gold400 = Color(0xFFFBBF24);
  static const gold500 = Color(0xFFF59E0B);
  static const gold700 = Color(0xFFB45309);

  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);

  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [b950, b900, b700],
  );

  static const logoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [b600, b800],
  );
}

/// Durum rozetleri için renk tonları (sitedeki Badge tonlarıyla aynı).
enum Tone { slate, brand, green, amber, rose, sky, violet }

class ToneColors {
  const ToneColors(this.background, this.foreground);

  final Color background;
  final Color foreground;

  static ToneColors of(Tone tone, Brightness brightness) {
    final dark = brightness == Brightness.dark;
    switch (tone) {
      case Tone.brand:
        return dark ? const ToneColors(Color(0xFF2E2A6B), Brand.b200) : const ToneColors(Brand.b50, Brand.b700);
      case Tone.green:
        return dark ? const ToneColors(Color(0xFF0B3B2E), Color(0xFF6EE7B7)) : const ToneColors(Color(0xFFECFDF5), Color(0xFF047857));
      case Tone.amber:
        return dark ? const ToneColors(Color(0xFF452B07), Color(0xFFFCD34D)) : const ToneColors(Color(0xFFFFFBEB), Color(0xFFB45309));
      case Tone.rose:
        return dark ? const ToneColors(Color(0xFF4C1424), Color(0xFFFDA4AF)) : const ToneColors(Color(0xFFFFF1F2), Color(0xFFBE123C));
      case Tone.sky:
        return dark ? const ToneColors(Color(0xFF0C3550), Color(0xFF7DD3FC)) : const ToneColors(Color(0xFFF0F9FF), Color(0xFF0369A1));
      case Tone.violet:
        return dark ? const ToneColors(Color(0xFF34195C), Color(0xFFC4B5FD)) : const ToneColors(Color(0xFFF5F3FF), Color(0xFF6D28D9));
      case Tone.slate:
        return dark ? const ToneColors(Color(0xFF273244), Color(0xFFCBD5E1)) : const ToneColors(Brand.slate100, Brand.slate700);
    }
  }
}

class AppTheme {
  AppTheme._();

  static const fontFamily = 'PlusJakartaSans';

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
      seedColor: Brand.b600,
      brightness: brightness,
    ).copyWith(
      primary: dark ? Brand.b400 : Brand.b600,
      onPrimary: Colors.white,
      primaryContainer: dark ? const Color(0xFF2E2A6B) : Brand.b50,
      onPrimaryContainer: dark ? Brand.b100 : Brand.b800,
      secondary: Brand.gold400,
      onSecondary: Brand.b950,
      secondaryContainer: dark ? const Color(0xFF452B07) : Brand.gold100,
      onSecondaryContainer: dark ? Brand.gold300 : Brand.gold700,
      surface: dark ? const Color(0xFF111827) : Colors.white,
      onSurface: dark ? const Color(0xFFE5E7EB) : Brand.slate900,
      onSurfaceVariant: dark ? Brand.slate400 : Brand.slate500,
      surfaceContainerLowest: dark ? const Color(0xFF0B1120) : Colors.white,
      surfaceContainerLow: dark ? const Color(0xFF0F172A) : Brand.slate50,
      surfaceContainer: dark ? const Color(0xFF1A2234) : Brand.slate100,
      surfaceContainerHigh: dark ? const Color(0xFF1F2937) : Brand.slate100,
      surfaceContainerHighest: dark ? const Color(0xFF273244) : Brand.slate200,
      outline: dark ? const Color(0xFF374151) : Brand.slate300,
      outlineVariant: dark ? const Color(0xFF1F2937) : Brand.slate200,
      error: dark ? const Color(0xFFFB7185) : const Color(0xFFE11D48),
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: dark ? const Color(0xFF0B1120) : Brand.slate50,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );

    final text = base.textTheme.apply(
      fontFamily: fontFamily,
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );

    final radius = BorderRadius.circular(14);

    return base.copyWith(
      textTheme: text.copyWith(
        headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.3),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.2),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? const Color(0xFF0B1120) : Brand.slate50,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 19, fontWeight: FontWeight.w800, color: scheme.onSurface, letterSpacing: -0.2),
        systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: scheme.outlineVariant)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 50),
          shape: RoundedRectangleBorder(borderRadius: radius),
          textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 50),
          shape: RoundedRectangleBorder(borderRadius: radius),
          side: BorderSide(color: scheme.outline),
          textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? const Color(0xFF111827) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.outline)),
        enabledBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.outline)),
        focusedBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.primary, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.error)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: scheme.error, width: 2)),
        errorMaxLines: 3,
        helperMaxLines: 3,
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, color: scheme.onSurface),
        secondaryLabelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, color: scheme.onPrimaryContainer),
        selectedColor: scheme.primaryContainer,
        secondarySelectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.primary,
        iconTheme: IconThemeData(color: scheme.primary, size: 18),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surface,
        indicatorColor: scheme.primaryContainer,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontFamily: fontFamily,
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: states.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(color: states.contains(WidgetState.selected) ? scheme.primary : scheme.onSurfaceVariant),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: scheme.primary,
        unselectedLabelColor: scheme.onSurfaceVariant,
        indicatorColor: scheme.primary,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: scheme.outlineVariant,
        labelStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, fontSize: 14),
        unselectedLabelStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, fontSize: 14),
        tabAlignment: TabAlignment.start,
      ),
      dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1, thickness: 1),
      listTileTheme: ListTileThemeData(
        iconColor: scheme.onSurfaceVariant,
        titleTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 15, fontWeight: FontWeight.w600, color: scheme.onSurface),
        subtitleTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 13, color: scheme.onSurfaceVariant),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: dark ? Brand.slate200 : Brand.slate900,
        contentTextStyle: TextStyle(fontFamily: fontFamily, color: dark ? Brand.slate900 : Colors.white, fontWeight: FontWeight.w500),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
    );
  }
}
