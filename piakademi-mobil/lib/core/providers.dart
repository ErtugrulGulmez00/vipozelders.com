import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/pi_api.dart';
import 'auth/session.dart';
import 'auth/token_store.dart';
import 'models/catalog.dart';

/// Oturum anahtarı deposu (testlerde bellek içi sürümle değiştirilir).
final keyValueStoreProvider = Provider<KeyValueStore>((ref) => SecureKeyValueStore());

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore(ref.watch(keyValueStoreProvider)));

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(tokens: ref.watch(tokenStoreProvider));
  ref.onDispose(client.dispose);
  return client;
});

final apiProvider = Provider<PiApi>((ref) => PiApi(ref.watch(apiClientProvider)));

final sessionProvider = NotifierProvider<SessionController, SessionState>(SessionController.new);

/// Oturumdaki kullanıcının kimliği; kullanıcıya özel veriler bunu izleyerek çıkışta sıfırlanır.
final currentUserIdProvider = Provider<String?>((ref) => ref.watch(sessionProvider.select((s) => s.me?.id)));

/// Kategoriler, iller, kurallar ve yasal sayfalar (uygulama açıkken bir kez alınır).
final catalogProvider = FutureProvider<Catalog>((ref) => ref.watch(apiProvider).catalog());
