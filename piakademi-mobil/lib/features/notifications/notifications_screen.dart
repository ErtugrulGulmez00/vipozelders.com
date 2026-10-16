import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/notification.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/widgets.dart';

/// Bildirimler: dokununca ilgili ekran açılır ve bildirim okundu sayılır.
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final _listKey = GlobalKey<PagedListViewState<AppNotification>>();
  final _read = <String>{};

  Future<void> _markAll() async {
    try {
      final unread = await ref.read(apiProvider).markNotificationsRead();
      ref.read(sessionProvider.notifier).setUnread(unread);
      await _listKey.currentState?.refresh();
      if (mounted) showSnack(context, 'Tüm bildirimler okundu olarak işaretlendi.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    }
  }

  Future<void> _open(AppNotification n) async {
    if (!n.isRead && !_read.contains(n.id)) {
      setState(() => _read.add(n.id));
      ref.read(apiProvider).markNotificationsRead([n.id]).then((unread) => ref.read(sessionProvider.notifier).setUnread(unread)).catchError((_) {});
    }
    final target = n.target;
    if (target != null) {
      context.push(routeForTarget(target.screen, target.id));
    } else if (n.link != null) {
      final mapped = mapWebPath(Uri.parse(n.link!));
      if (mapped != null) context.push(mapped);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(apiProvider);
    final unread = ref.watch(sessionProvider.select((s) => s.me?.unreadNotifications ?? 0));
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Bildirimler'),
        actions: [if (unread > 0) TextButton(onPressed: _markAll, child: const Text('Tümünü okundu say'))],
      ),
      body: PagedListView<AppNotification>(
        key: _listKey,
        padding: const EdgeInsets.symmetric(vertical: 8),
        separator: 0,
        load: (page) async {
          final result = await api.notifications(page: page);
          if (page == 1) ref.read(sessionProvider.notifier).setUnread(result.unread);
          return (result.items, result.nextPage);
        },
        empty: const EmptyView(icon: Icons.notifications_none_rounded, title: 'Bildiriminiz yok', message: 'Ders talepleri, onaylar, hatırlatmalar ve kurum duyuruları burada görünür.'),
        itemBuilder: (context, n) {
          final read = n.isRead || _read.contains(n.id);
          return Material(
            color: read ? Colors.transparent : scheme.primaryContainer.withValues(alpha: 0.45),
            child: InkWell(
              onTap: () => _open(n),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: scheme.surfaceContainer, borderRadius: BorderRadius.circular(12)),
                      child: Icon(_iconFor(n.type), color: scheme.primary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(child: Text(n.title, style: TextStyle(fontWeight: read ? FontWeight.w600 : FontWeight.w800))),
                              if (!read) Container(width: 8, height: 8, decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle)),
                            ],
                          ),
                          if (n.body != null) ...[
                            const SizedBox(height: 3),
                            Text(n.body!, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13.5, height: 1.35)),
                          ],
                          const SizedBox(height: 4),
                          Text(formatRelative(n.createdAt), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  static IconData _iconFor(String type) {
    if (type.startsWith('center.')) return Icons.school_rounded;
    if (type.startsWith('question.')) return Icons.photo_camera_rounded;
    if (type.contains('payment') || type.contains('paid') || type.contains('refund')) return Icons.payments_rounded;
    if (type.contains('review')) return Icons.star_rounded;
    if (type.contains('reminder')) return Icons.alarm_rounded;
    if (type.contains('payout') || type.contains('earning')) return Icons.account_balance_wallet_rounded;
    if (type.startsWith('booking.')) return Icons.event_note_rounded;
    return Icons.notifications_rounded;
  }
}
