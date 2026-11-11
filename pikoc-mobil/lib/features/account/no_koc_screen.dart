import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/session.dart';

/// Pi Koç'ta koç ya da öğrenci kaydı olmayan hesap (ör. yalnızca özel ders veli/öğretmeni).
class NoKocScreen extends StatelessWidget {
  const NoKocScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Pi Koç')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Bu hesapla Pi Koç kaydınız yok', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text('Öğrenciyseniz koçunuzun size verdiği kullanıcı adıyla girin. Koçsanız sitede ücretsiz denemeyi başlatabilirsiniz; özel ders ve kurum hesapları Pi Kampüs uygulamasındadır.'),
            const SizedBox(height: 20),
            FilledButton(onPressed: () => launchUrl(Uri.parse('${AppConfig.siteUrl}/pi-koc'), mode: LaunchMode.externalApplication), child: const Text('Pi Koç ile ücretsiz başla')),
            const SizedBox(height: 8),
            OutlinedButton(onPressed: session.logout, child: const Text('Başka hesapla gir')),
          ],
        ),
      ),
    );
  }
}
