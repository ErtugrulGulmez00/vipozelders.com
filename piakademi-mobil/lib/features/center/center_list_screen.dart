import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import 'invite_screen.dart';

/// Kurumum: kuruma (etüt merkezi / dershane) bağlı öğrenciler (kurum portalı alt menüsünün ilk sekmesi).
class CenterListScreen extends ConsumerWidget {
  const CenterListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kurumum')),
        body: const SignInPrompt(
          title: 'Kurum veli portalı',
          message: 'Çocuğunuzun etüt merkezindeki devamını, deneme sonuçlarını ve ödemelerini takip etmek için giriş yapın.',
          icon: Icons.school_outlined,
          next: Routes.center,
        ),
      );
    }
    final links = ref.watch(centerLinksProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kurumum'),
        actions: [
          IconButton(tooltip: 'Davet bağlantısı gir', onPressed: () => showInviteCodeSheet(context), icon: const Icon(Icons.add_link_rounded)),
        ],
      ),
      body: AsyncBody(
        value: links,
        onRetry: () => ref.invalidate(centerLinksProvider),
        builder: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(centerLinksProvider.future),
          child: items.isEmpty
              ? RefreshableScroll(
                  onRefresh: () => ref.refresh(centerLinksProvider.future),
                  child: EmptyView(
                    icon: Icons.school_outlined,
                    title: 'Bağlı öğrenci yok',
                    message:
                        'Çocuğunuzun etüt merkezi ya da dershanesi Pi Kampüs kullanıyorsa, kurumun e-postayla gönderdiği davet bağlantısına dokunarak ya da bağlantıyı buraya yapıştırarak bağlanabilirsiniz.',
                    action: FilledButton.icon(onPressed: () => showInviteCodeSheet(context), icon: const Icon(Icons.add_link_rounded), label: const Text('Davet bağlantısı gir')),
                  ),
                )
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    for (final link in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Card(
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            onTap: () => context.push(Routes.centerChild(link.id)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Row(
                                children: [
                                  Avatar(name: link.student.fullName, size: 56),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(link.isStudentAccount ? 'Bilgilerim' : link.student.fullName, style: Theme.of(context).textTheme.titleMedium),
                                        const SizedBox(height: 2),
                                        Text(
                                          [link.student.gradeName, ...link.student.groups].whereType<String>().join(' · '),
                                          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Icon(Icons.apartment_rounded, size: 16, color: Brand.gold500),
                                            const SizedBox(width: 6),
                                            Expanded(child: Text(link.center.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5))),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right_rounded),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(onPressed: () => showInviteCodeSheet(context), icon: const Icon(Icons.add_link_rounded), label: const Text('Başka bir öğrenci bağla')),
                  ],
                ),
        ),
      ),
    );
  }
}
