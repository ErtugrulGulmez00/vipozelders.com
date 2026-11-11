import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Sitedeki "Canlı" tema renkleri (src/app/globals.css): mercan ana renk, lacivert mürekkep, ayçiçeği sarısı vurgu.
class Brand {
  Brand._();

  // Mercan (düğmeler, bağlantılar, vurgu); 600 beyaz üzerinde 4.6:1
  static const b50 = Color(0xFFFFF3EF);
  static const b100 = Color(0xFFFFE3DA);
  static const b200 = Color(0xFFFFC6B3);
  static const b300 = Color(0xFFFFA184);
  static const b400 = Color(0xFFF77A57);
  static const b500 = Color(0xFFEC5A34);
  static const b600 = Color(0xFFD63F1C);
  static const b700 = Color(0xFFB23214);
  static const b800 = Color(0xFF8E2911);
  static const b900 = Color(0xFF6F2210);
  static const b950 = Color(0xFF3D1107);

  // Lacivert mürekkep (metin, koyu yüzeyler); 50 lavanta bölüm zemini
  static const ink50 = Color(0xFFF3F1FA);
  static const ink100 = Color(0xFFE8E6F4);
  static const ink200 = Color(0xFFC9CCE6);
  static const ink300 = Color(0xFFA3A7CC);
  static const ink400 = Color(0xFF7B80A8);
  static const ink500 = Color(0xFF5A5F80);
  static const ink600 = Color(0xFF464B6B);
  static const ink700 = Color(0xFF33385A);
  static const ink800 = Color(0xFF252A4A);
  static const ink900 = Color(0xFF1B1F3B);
  static const ink950 = Color(0xFF12152A);

  // Ayçiçeği sarısı (rozet, sayaç, ikincil düğme); 700 açık zeminde metin
  static const gold50 = Color(0xFFFFF8E6);
  static const gold100 = Color(0xFFFFF1D6);
  static const gold300 = Color(0xFFFFD873);
  static const gold400 = Color(0xFFFFC845);
  static const gold500 = Color(0xFFF5B014);
  static const gold600 = Color(0xFFC98A00);
  static const gold700 = Color(0xFF7A4A00);

  // Ders kutuları ve avatarlar için yardımcı renkler
  static const iris100 = Color(0xFFE3E6FF);
  static const iris500 = Color(0xFF5B6CFF);
  static const iris700 = Color(0xFF3B48C9);
  static const mint100 = Color(0xFFDDF6F3);
  static const mint400 = Color(0xFF2EC4B6);
  static const mint800 = Color(0xFF0D5C55);
  static const cream50 = Color(0xFFFFF6EE);

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

  /// Koyu yüzeyler (açılış, giriş, keşfet başlığı) düz lacivert; geçiş yok
  static const hero = ink900;

  /// Avatar renkleri (sitedeki Avatar ile aynı sıra): arka plan, yazı
  static const avatarTones = [
    (b600, Colors.white),
    (iris500, Colors.white),
    (mint400, ink950),
    (gold400, ink900),
    (ink800, Colors.white),
  ];

  /// Sitedeki gibi ada göre sabit avatar rengi
  static (Color, Color) avatarTone(String name) {
    var sum = 0;
    for (final unit in name.runes) {
      sum = (sum + unit) % 997;
    }
    return avatarTones[sum % avatarTones.length];
  }
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
        return dark ? const ToneColors(Color(0xFF4A1B10), Brand.b300) : const ToneColors(Brand.b50, Brand.b700);
      case Tone.green:
        return dark ? const ToneColors(Color(0xFF0B3B2E), Color(0xFF6EE7B7)) : const ToneColors(Color(0xFFECFDF5), Color(0xFF047857));
      case Tone.amber:
        return dark ? const ToneColors(Color(0xFF452B07), Color(0xFFFCD34D)) : const ToneColors(Color(0xFFFFFBEB), Color(0xFF92400E));
      case Tone.rose:
        return dark ? const ToneColors(Color(0xFF4C1424), Color(0xFFFDA4AF)) : const ToneColors(Color(0xFFFFF1F2), Color(0xFFBE123C));
      case Tone.sky:
        return dark ? const ToneColors(Color(0xFF0C3550), Color(0xFF7DD3FC)) : const ToneColors(Color(0xFFF0F9FF), Color(0xFF0369A1));
      case Tone.violet:
        return dark ? const ToneColors(Color(0xFF2A2F66), Color(0xFFC4CAFF)) : const ToneColors(Brand.iris100, Brand.iris700);
      case Tone.slate:
        return dark ? const ToneColors(Brand.ink800, Brand.ink200) : const ToneColors(Brand.slate100, Brand.slate700);
    }
  }
}

class AppTheme {
  AppTheme._();

  /// Gövde yazı tipi (sitede DM Sans)
  static const fontFamily = 'DMSans';

  /// Başlık yazı tipi (sitede Bricolage Grotesque)
  static const displayFamily = 'BricolageGrotesque';

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
      primaryContainer: dark ? const Color(0xFF4A1B10) : Brand.b50,
      onPrimaryContainer: dark ? Brand.b100 : Brand.b800,
      secondary: Brand.gold400,
      onSecondary: Brand.ink900,
      secondaryContainer: dark ? const Color(0xFF452B07) : Brand.gold100,
      onSecondaryContainer: dark ? Brand.gold300 : Brand.gold700,
      // Lacivert "ink" düğme ve vurgular
      tertiary: dark ? Brand.ink100 : Brand.ink900,
      onTertiary: dark ? Brand.ink900 : Colors.white,
      tertiaryContainer: dark ? Brand.ink800 : Brand.ink50,
      onTertiaryContainer: dark ? Brand.ink100 : Brand.ink900,
      surface: dark ? Brand.ink900 : Colors.white,
      onSurface: dark ? Brand.ink100 : Brand.ink900,
      onSurfaceVariant: dark ? Brand.ink300 : Brand.ink500,
      surfaceContainerLowest: dark ? Brand.ink950 : Colors.white,
      surfaceContainerLow: dark ? const Color(0xFF161A33) : Brand.slate50,
      surfaceContainer: dark ? Brand.ink800 : Brand.ink50,
      surfaceContainerHigh: dark ? Brand.ink800 : Brand.slate100,
      surfaceContainerHighest: dark ? Brand.ink700 : Brand.ink100,
      outline: dark ? Brand.ink600 : Brand.slate300,
      outlineVariant: dark ? Brand.ink800 : Brand.ink100,
      error: dark ? const Color(0xFFFB7185) : const Color(0xFFE11D48),
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: dark ? Brand.ink950 : Brand.slate50,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );

    final text = base.textTheme.apply(
      fontFamily: fontFamily,
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    );

    TextStyle? display(TextStyle? style, FontWeight weight, [double letterSpacing = -0.3]) =>
        style?.copyWith(fontFamily: displayFamily, fontWeight: weight, letterSpacing: letterSpacing);

    // Alanlar sitede rounded-xl, kartlar rounded-3xl, düğmeler hap
    final fieldRadius = BorderRadius.circular(14);
    const pill = StadiumBorder();
    const buttonText = TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, fontSize: 15);

    return base.copyWith(
      textTheme: text.copyWith(
        displayLarge: display(text.displayLarge, FontWeight.w800, -1),
        displayMedium: display(text.displayMedium, FontWeight.w800, -0.8),
        displaySmall: display(text.displaySmall, FontWeight.w800, -0.6),
        headlineLarge: display(text.headlineLarge, FontWeight.w800, -0.6),
        headlineMedium: display(text.headlineMedium, FontWeight.w800, -0.5),
        headlineSmall: display(text.headlineSmall, FontWeight.w800, -0.3),
        titleLarge: display(text.titleLarge, FontWeight.w800, -0.2),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        titleSmall: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: dark ? Brand.ink950 : Brand.slate50,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(fontFamily: displayFamily, fontSize: 20, fontWeight: FontWeight.w800, color: scheme.onSurface, letterSpacing: -0.3),
        systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: scheme.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: scheme.outlineVariant)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size(64, 50), shape: pill, padding: const EdgeInsets.symmetric(horizontal: 24), textStyle: buttonText),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(minimumSize: const Size(64, 50), shape: pill, textStyle: buttonText),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 50),
          shape: pill,
          padding: const EdgeInsets.symmetric(horizontal: 22),
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: dark ? Brand.ink600 : Brand.ink900.withValues(alpha: 0.15), width: 2),
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(shape: pill, textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? Brand.ink900 : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: scheme.outline)),
        enabledBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: scheme.outline)),
        focusedBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: scheme.primary, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: scheme.error)),
        focusedErrorBorder: OutlineInputBorder(borderRadius: fieldRadius, borderSide: BorderSide(color: scheme.error, width: 2)),
        errorMaxLines: 3,
        helperMaxLines: 3,
      ),
      chipTheme: base.chipTheme.copyWith(
        shape: const StadiumBorder(),
        labelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, color: scheme.onSurface),
        secondaryLabelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, color: scheme.onPrimaryContainer),
        selectedColor: scheme.primaryContainer,
        secondarySelectedColor: scheme.primaryContainer,
        checkmarkColor: scheme.primary,
        iconTheme: IconThemeData(color: scheme.primary, size: 18),
        side: BorderSide(color: scheme.outlineVariant),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: scheme.primaryContainer,
          selectedForegroundColor: scheme.onPrimaryContainer,
          side: BorderSide(color: scheme.outline),
          textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        ),
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
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        titleTextStyle: TextStyle(fontFamily: displayFamily, fontSize: 20, fontWeight: FontWeight.w800, color: scheme.onSurface),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: dark ? Brand.ink100 : Brand.ink900,
        contentTextStyle: TextStyle(fontFamily: fontFamily, color: dark ? Brand.ink900 : Colors.white, fontWeight: FontWeight.w500),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
    );
  }
}
