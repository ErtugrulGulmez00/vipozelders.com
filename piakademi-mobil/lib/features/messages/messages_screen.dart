import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/dates.dart';
import '../../core/models/messages.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Konuşmalar: veli/öğrenci öğretmenleriyle, öğretmen velilerle yazışır.
class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teacher = ref.watch(sessionProvider).isTeacher;
    return Scaffold(
      appBar: AppBar(leading: AppBackButton(fallback: teacher ? Routes.teacherAccount : Routes.account), title: const Text('Mesajlar')),
      body: AsyncBody<List<ThreadSummary>>(
        value: ref.watch(threadsProvider),
        onRetry: () => ref.invalidate(threadsProvider),
        builder: (threads) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(threadsProvider),
          child: threads.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 60),
                    EmptyView(
                      icon: Icons.forum_outlined,
                      title: 'Henüz mesajınız yok',
                      message: teacher ? 'Veliler profilinizden size yazınca burada görünür.' : 'Öğretmen profilindeki “Mesaj gönder” ile ders öncesi sorularınızı sorabilirsiniz.',
                    ),
                  ],
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: threads.length,
                  separatorBuilder: (_, _) => const Divider(height: 1, indent: 76),
                  itemBuilder: (context, i) => _ThreadTile(thread: threads[i]),
                ),
        ),
      ),
    );
  }
}

class _ThreadTile extends StatelessWidget {
  const _ThreadTile({required this.thread});

  final ThreadSummary thread;

  @override
  Widget build(BuildContext context) {
    final t = thread;
    final scheme = Theme.of(context).colorScheme;
    final bold = t.unread ? FontWeight.w800 : FontWeight.w600;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Avatar(name: t.counterpart.name, photoUrl: t.counterpart.photoUrl, size: 48),
      title: Text(t.counterpart.name, style: TextStyle(fontWeight: bold)),
      subtitle: Text(
        t.lastBody == null ? '' : '${t.lastMine ? 'Siz: ' : ''}${t.lastBody}',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(fontWeight: t.unread ? FontWeight.w600 : FontWeight.normal, color: t.unread ? scheme.onSurface : scheme.onSurfaceVariant),
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (t.lastAt != null) Text(formatRelative(t.lastAt!), style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          if (t.unread) ...[
            const SizedBox(height: 6),
            Container(width: 10, height: 10, decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle)),
          ],
        ],
      ),
      onTap: () => context.push(Routes.thread(t.id)),
    );
  }
}
