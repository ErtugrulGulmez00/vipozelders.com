/// Derleme anında verilen ayarlar.
///
/// `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/mobil/v1`
/// Verilmezse canlı site kullanılır.
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://pikampus.com/api/mobil/v1',
  );

  /// Sitenin kök adresi (ör. https://pikampus.com). Davet ve ders bağlantıları bununla eşleştirilir.
  static String get siteUrl {
    final uri = Uri.parse(apiBaseUrl);
    return uri.replace(path: '', query: null, fragment: null).toString().replaceAll(RegExp(r'/$'), '');
  }

  static String get siteHost => Uri.parse(apiBaseUrl).host;

  /// Firebase (push bildirimi) ayarları. Boşsa bildirimler kapalı çalışır.
  static const String firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const String firebaseAppIdAndroid = String.fromEnvironment('FIREBASE_APP_ID_ANDROID');
  static const String firebaseAppIdIos = String.fromEnvironment('FIREBASE_APP_ID_IOS');
  static const String firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const String firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get pushConfigured =>
      firebaseApiKey.isNotEmpty && firebaseSenderId.isNotEmpty && firebaseProjectId.isNotEmpty;
}
