import 'package:flutter_test/flutter_test.dart';
import 'package:pikoc/core/remote_config.dart';

void main() {
  test('sürüm karşılaştırması', () {
    expect(compareVersions('1.0.0', '1.0.0'), 0);
    expect(compareVersions('1.2.10', '1.2.9'), 1);
    expect(compareVersions('1.0.0', '1.1.0'), -1);
    expect(compareVersions('2.0', '1.9.9'), 1);
    expect(compareVersions('1.0.0+5', '1.0.0'), 0);
  });

  test('ayar yoksa güvenli varsayılanlar', () {
    const config = RemoteConfig({});
    expect(config.appName, 'Pi Kampüs');
    expect(config.minVersion, '0.0.0');
    expect(config.pages, isEmpty);
    expect(config.page('paketler'), isNull);
  });

  test('sayfa listesi okunur', () {
    const config = RemoteConfig({
      'pages': [
        {'key': 'paketler', 'title': 'Paketler', 'path': '/koc/abonelik', 'url': 'https://pikampus.com/koc/abonelik', 'auth': true},
      ],
    });
    expect(config.page('paketler')?['auth'], true);
  });
}
