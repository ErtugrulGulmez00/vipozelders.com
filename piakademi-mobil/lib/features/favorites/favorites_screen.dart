import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Favoriler')),
        body: const SignInPrompt(
          title: 'Favori öğretmenleriniz',
          message: 'Beğendiğiniz öğretmenleri kalp simgesiyle kaydedin, tek dokunuşla tekrar ulaşın.',
          icon: Icons.favorite_border_rounded,
          next: Routes.favorites,
        ),
      );
    }
    final favorites = ref.watch(favoritesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Favoriler'), actions: const [NotificationBell()]),
      body: AsyncBody(
        value: favorites,
        onRetry: () => ref.invalidate(favoritesProvider),
        builder: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(favoritesProvider.future),
          child: items.isEmpty
              ? RefreshableScroll(
                  onRefresh: () => ref.refresh(favoritesProvider.future),
                  child: EmptyView(
                    icon: Icons.favorite_border_rounded,
                    title: 'Henüz favori öğretmeniniz yok',
                    message: 'Öğretmen profilindeki kalp simgesine dokunarak favorilere ekleyebilirsiniz.',
                    action: FilledButton(onPressed: () => context.push(Routes.teachers), child: const Text('Öğretmen bul')),
                  ),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final teacher = items[i];
                    return TeacherTile(
                      teacher: teacher.toCard(),
                      trailing: IconButton(
                        tooltip: 'Favorilerden çıkar',
                        visualDensity: VisualDensity.compact,
                        icon: const Icon(Icons.favorite_rounded, color: Color(0xFFE11D48)),
                        onPressed: () async {
                          try {
                            await ref.read(apiProvider).setFavorite(teacher.userId, false);
                            ref.invalidate(favoritesProvider);
                            if (context.mounted) showSnack(context, '${teacher.name} favorilerden çıkarıldı.');
                          } on ApiException catch (error) {
                            if (context.mounted) showError(context, error);
                          }
                        },
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
