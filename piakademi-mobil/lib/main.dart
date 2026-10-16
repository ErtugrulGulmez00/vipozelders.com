import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/push/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
  // Firebase ayarı verilmişse push bildirimleri hazırlanır; yoksa uygulama bildirimsiz çalışır.
  await PushService.initializeFirebase();
  runApp(const ProviderScope(child: PiKampusApp()));
}
