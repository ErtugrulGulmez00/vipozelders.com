import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/booking.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/pi_logo.dart';
import '../../core/widgets/rating.dart';
import '../../core/widgets/states.dart';

/// Geri düğmesi: geri gidilecek sayfa yoksa (bağlantıyla ya da girişten sonra açıldıysa) ana sayfaya döner.
class AppBackButton extends ConsumerWidget {
  const AppBackButton({super.key, this.fallback});

  final String? fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return BackButton(
      onPressed: () {
        if (context.canPop()) {
          context.pop();
        } else {
          context.go(fallback ?? (ref.read(sessionProvider).isTeacher ? Routes.teacherHome : Routes.explore));
        }
      },
    );
  }
}

/// Uygulama çubuğundaki bildirim zili (okunmamış sayısıyla).
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key, this.light = false});

  final bool light;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) return const SizedBox.shrink();
    final unread = session.me!.unreadNotifications;
    return IconButton(
      tooltip: unread > 0 ? 'Bildirimler ($unread okunmamış)' : 'Bildirimler',
      color: light ? Colors.white : null,
      onPressed: () => context.push(Routes.notifications),
      icon: Badge(
        isLabelVisible: unread > 0,
        label: Text(unread > 99 ? '99+' : '$unread'),
        child: Icon(unread > 0 ? Icons.notifications_rounded : Icons.notifications_none_rounded),
      ),
    );
  }
}

/// Giriş gerektiren sekmelerde misafire gösterilir.
class SignInPrompt extends StatelessWidget {
  const SignInPrompt({super.key, required this.title, required this.message, this.icon = Icons.lock_outline_rounded, this.next});

  final String title;
  final String message;
  final IconData icon;
  final String? next;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const PiBadge(size: 64),
            const SizedBox(height: 20),
            Text(title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: scheme.onSurfaceVariant, height: 1.45)),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => context.push(Uri(path: Routes.login, queryParameters: next == null ? null : {'devam': next}).toString()),
                child: const Text('Giriş yap'),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => context.push(Uri(path: Routes.register, queryParameters: next == null ? null : {'devam': next}).toString()),
                child: const Text('Ücretsiz hesap oluştur'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Site bakımdaysa üstte gösterilir.
class MaintenanceBanner extends ConsumerWidget {
  const MaintenanceBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final maintenance = ref.watch(catalogProvider).valueOrNull?.maintenance;
    if (maintenance == null || !maintenance.on) return const SizedBox.shrink();
    final colors = ToneColors.of(Tone.amber, Theme.of(context).brightness);
    return Container(
      width: double.infinity,
      color: colors.background,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(Icons.construction_rounded, color: colors.foreground, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              maintenance.message ?? 'Sitemiz kısa bir bakımda; kayıt ve randevu alma birazdan yeniden açılacak.',
              style: TextStyle(color: colors.foreground, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Öğretmen kartı (arama sonuçları, öne çıkanlar, favoriler).
class TeacherTile extends StatelessWidget {
  const TeacherTile({super.key, required this.teacher, this.onTap, this.trailing});

  final TeacherCard teacher;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final modes = [if (teacher.offersOnline) 'Online', if (teacher.offersInPerson) 'Yüz yüze'];
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap ?? () => context.push(Routes.teacher(teacher.slug)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Avatar(name: teacher.name, photoUrl: teacher.photoUrl, size: 64),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(teacher.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleMedium),
                        ),
                        if (teacher.verified) ...[const SizedBox(width: 4), const VerifiedBadge(compact: true)],
                        if (trailing != null) ...[const Spacer(), trailing!],
                      ],
                    ),
                    if (teacher.headline != null) ...[
                      const SizedBox(height: 2),
                      Text(teacher.headline!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13.5, height: 1.35)),
                    ],
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 10,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        RatingLine(average: teacher.ratingAvg, count: teacher.ratingCount, size: 13),
                        if (teacher.cityName != null || modes.isNotEmpty)
                          Text(
                            [if (teacher.cityName != null) teacher.cityName!, ...modes].join(' · '),
                            style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant),
                          ),
                      ],
                    ),
                    if (teacher.subjects.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [for (final s in teacher.subjects.take(4)) _Pill(text: s)],
                      ),
                    ],
                    if (teacher.minHourlyPrice != null) ...[
                      const SizedBox(height: 10),
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: formatMoney(teacher.minHourlyPrice!), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: scheme.onSurface)),
                            TextSpan(text: ' / saat’ten başlayan', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(999)),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: scheme.onPrimaryContainer)),
    );
  }
}

/// Ders listesi kartı.
class BookingTile extends StatelessWidget {
  const BookingTile({super.key, required this.booking, this.teacherView = false, this.onTap});

  final BookingSummary booking;
  final bool teacherView;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final when = booking.isQuestion ? 'Fotoğrafla soru · gönderildi ${formatCompact(booking.startAt)}' : formatLessonRange(booking.startAt, booking.endAt);
    final who = teacherView ? '${booking.learnerName} · ${booking.counterpart.name}' : booking.counterpart.name;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap ?? () => context.push(Routes.lesson(booking.id)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ModeIcon(mode: booking.mode),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(booking.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 15)),
                    const SizedBox(height: 3),
                    Text(when, style: TextStyle(color: scheme.onSurface, fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(
                      '$who · ${booking.serviceName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        StatusBadge(status: booking.status, label: booking.isQuestion && booking.status == 'PENDING_APPROVAL' ? 'Çözüm bekleniyor' : booking.statusLabel),
                        if (booking.isTest) const ToneBadge(label: 'Test dersi', tone: Tone.sky),
                        if (booking.approvalDeadline != null && booking.status == 'PENDING_APPROVAL')
                          Text(
                            'Son: ${formatCompact(booking.approvalDeadline!)}',
                            style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(formatMoney(booking.amount), style: const TextStyle(fontWeight: FontWeight.w800)),
                  if (teacherView) Text('kazancınız', style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModeIcon extends StatelessWidget {
  const _ModeIcon({required this.mode});

  final String mode;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final icon = switch (mode) {
      'IN_PERSON' => Icons.place_rounded,
      'QUESTION' => Icons.photo_camera_rounded,
      _ => Icons.videocam_rounded,
    };
    return Container(
      width: 42,
      height: 42,
      decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
      child: Icon(icon, color: scheme.primary, size: 22),
    );
  }
}

/// Sayfalı liste: aşağı kaydırdıkça sonraki sayfa yüklenir, aşağı çekince yenilenir.
class PagedListView<T> extends StatefulWidget {
  const PagedListView({
    super.key,
    required this.load,
    required this.itemBuilder,
    required this.empty,
    this.header,
    this.padding = const EdgeInsets.fromLTRB(16, 8, 16, 24),
    this.separator = 10,
  });

  /// Sayfa yükler; dönen ikinci değer sonraki sayfa (yoksa null).
  final Future<(List<T>, int?)> Function(int page) load;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final Widget empty;
  final Widget? header;
  final EdgeInsetsGeometry padding;
  final double separator;

  @override
  State<PagedListView<T>> createState() => PagedListViewState<T>();
}

class PagedListViewState<T> extends State<PagedListView<T>> {
  final _items = <T>[];
  int? _next = 1;
  bool _loading = false;
  Object? _error;
  bool _initialized = false;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _loadMore();
  }

  Future<void> refresh() async {
    _generation++;
    setState(() {
      _items.clear();
      _next = 1;
      _error = null;
      _initialized = false;
      _loading = false;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    if (_loading || _next == null) return;
    final generation = _generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final (items, next) = await widget.load(_next!);
      if (!mounted || generation != _generation) return;
      setState(() {
        _items.addAll(items);
        _next = next;
        _initialized = true;
      });
    } catch (error) {
      if (!mounted || generation != _generation) return;
      setState(() {
        _error = error;
        _initialized = true;
      });
    } finally {
      if (mounted && generation == _generation) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized && _loading) return const LoadingView();
    if (_items.isEmpty && _error != null) {
      return RefreshableScroll(onRefresh: refresh, child: ErrorView(error: _error!, onRetry: refresh));
    }
    if (_items.isEmpty) {
      return RefreshableScroll(
        onRefresh: refresh,
        child: Column(children: [if (widget.header != null) widget.header!, Padding(padding: const EdgeInsets.only(top: 24), child: widget.empty)]),
      );
    }
    final hasHeader = widget.header != null;
    final count = _items.length + (hasHeader ? 1 : 0) + 1;
    return RefreshIndicator(
      onRefresh: refresh,
      child: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification.metrics.pixels > notification.metrics.maxScrollExtent - 400) _loadMore();
          return false;
        },
        child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: widget.padding.add(EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom)),
          itemCount: count,
          itemBuilder: (context, index) {
            if (hasHeader && index == 0) return widget.header!;
            final i = index - (hasHeader ? 1 : 0);
            if (i == _items.length) {
              if (_error != null) {
                return Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Text(errorMessage(_error!), textAlign: TextAlign.center),
                      TextButton(onPressed: _loadMore, child: const Text('Tekrar dene')),
                    ],
                  ),
                );
              }
              if (_next != null) {
                return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator(strokeWidth: 2.5)));
              }
              return const SizedBox(height: 8);
            }
            return Padding(
              padding: EdgeInsets.only(bottom: widget.separator),
              child: widget.itemBuilder(context, _items[i]),
            );
          },
        ),
      ),
    );
  }
}
