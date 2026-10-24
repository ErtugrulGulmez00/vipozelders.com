import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/format/dates.dart';
import '../../core/models/booking.dart';
import '../../core/models/catalog.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/pi_logo.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

final featuredTeachersProvider = FutureProvider.autoDispose<List<TeacherCard>>((ref) async {
  final page = await ref.watch(apiProvider).teachers(const TeacherQuery(sort: 'onerilen'));
  return page.items.take(6).toList();
});

/// Velinin en yakın dersi (Keşfet'in üstünde gösterilir).
final nextLessonProvider = FutureProvider.autoDispose<BookingSummary?>((ref) async {
  final session = ref.watch(sessionProvider);
  ref.watch(bookingsRevisionProvider);
  if (!session.isStudent) return null;
  final page = await ref.watch(apiProvider).bookings('yaklasan');
  return page.items.isEmpty ? null : page.items.first;
});

const _serviceIcons = {'ozel-ders': Icons.school_rounded, 'soru-cozum': Icons.help_center_rounded, 'kocluk': Icons.track_changes_rounded};

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(catalogProvider);
    ref.invalidate(featuredTeachersProvider);
    ref.invalidate(nextLessonProvider);
    ref.invalidate(centerLinksProvider);
    await ref.read(featuredTeachersProvider.future).catchError((_) => <TeacherCard>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    // Koyu başlık alanı: durum çubuğu simgeleri açık renk.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
      child: Scaffold(
      body: Stack(
        children: [
          RefreshIndicator(
        onRefresh: () => _refresh(ref),
        edgeOffset: MediaQuery.paddingOf(context).top,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _Hero(catalog: catalog.valueOrNull)),
            const SliverToBoxAdapter(child: MaintenanceBanner()),
            const SliverToBoxAdapter(child: _NextLessonCard()),
            const SliverToBoxAdapter(child: _CenterShortcut()),
            if (catalog.hasError && !catalog.hasValue)
              SliverToBoxAdapter(child: ErrorView(error: catalog.error!, onRetry: () => ref.invalidate(catalogProvider), compact: true))
            else if (catalog.hasValue) ...[
              SliverToBoxAdapter(child: _Services(catalog: catalog.value!)),
              SliverToBoxAdapter(child: _Levels(catalog: catalog.value!)),
            ],
            const SliverToBoxAdapter(child: _Featured()),
            const SliverToBoxAdapter(child: _HowItWorks()),
            const SliverToBoxAdapter(child: _Trust()),
            const SliverToBoxAdapter(child: _CenterPromo()),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
          // Kaydırınca durum çubuğunun altı koyu kalsın (açık renkli simgeler okunur).
          Positioned(top: 0, left: 0, right: 0, height: MediaQuery.paddingOf(context).top, child: const ColoredBox(color: Brand.b950)),
        ],
      ),
      ),
    );
  }
}

class _Hero extends ConsumerWidget {
  const _Hero({required this.catalog});

  final Catalog? catalog;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(sessionProvider.select((s) => s.me));
    final top = MediaQuery.paddingOf(context).top;
    return Container(
      decoration: const BoxDecoration(gradient: Brand.heroGradient),
      padding: EdgeInsets.fromLTRB(20, top + 10, 12, 22),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Sitedeki gibi sağ üstte yumuşak altın ışıltı
          Positioned(
            right: -120,
            top: -140,
            child: IgnorePointer(
              child: Container(
                width: 340,
                height: 340,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [Brand.gold400.withValues(alpha: 0.28), Brand.gold400.withValues(alpha: 0)]),
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  PiLogo(light: true, size: 34, name: catalog?.site.name ?? 'Pi Kampüs'),
                  const Spacer(),
                  const NotificationBell(light: true),
                ],
              ),
              const SizedBox(height: 22),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (me != null)
                      Text('Merhaba ${me.firstName} 👋', style: const TextStyle(color: Brand.gold100, fontWeight: FontWeight.w700, fontSize: 15)),
                    if (me != null) const SizedBox(height: 6),
                    const Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: 'Doğru öğretmen, '),
                          TextSpan(text: 'doğru saatte.', style: TextStyle(color: Brand.gold300)),
                        ],
                      ),
                      style: TextStyle(color: Colors.white, fontSize: 29, height: 1.15, fontWeight: FontWeight.w800, letterSpacing: -0.6),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      catalog?.site.tagline ?? 'Okul öncesinden üniversite sınavına, doğru öğretmen bir tık uzağında.',
                      style: const TextStyle(color: Brand.b100, height: 1.4),
                    ),
                    const SizedBox(height: 18),
                    _SearchField(onTap: () => context.push(Uri(path: Routes.teachers, queryParameters: {'odak': '1'}).toString())),
                    const SizedBox(height: 14),
                    if (catalog != null)
                      SizedBox(
                        height: 36,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: catalog!.levels.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (context, i) {
                            final level = catalog!.levels[i];
                            return _HeroChip(label: level.name, onTap: () => context.push(Routes.teacherSearch(TeacherQuery(level: level.slug))));
                          },
                        ),
                      ),
                    const SizedBox(height: 14),
                    const Wrap(
                      spacing: 14,
                      runSpacing: 6,
                      children: [
                        _HeroPoint(icon: Icons.verified_rounded, text: 'Onaylı öğretmenler'),
                        _HeroPoint(icon: Icons.lock_rounded, text: 'Güvenli ödeme'),
                        _HeroPoint(icon: Icons.replay_rounded, text: 'Ders olmazsa iade'),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroChip extends StatelessWidget {
  const _HeroChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.1),
      shape: StadiumBorder(side: BorderSide(color: Colors.white.withValues(alpha: 0.22))),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
        ),
      ),
    );
  }
}

class _HeroPoint extends StatelessWidget {
  const _HeroPoint({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: Brand.gold300),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(color: Brand.b100, fontSize: 12.5, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Öğretmen, ders ya da konu ara',
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        elevation: 6,
        shadowColor: Brand.b950.withValues(alpha: 0.4),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            child: Row(
              children: [
                Icon(Icons.search_rounded, color: Brand.b600),
                SizedBox(width: 10),
                Expanded(child: Text('Öğretmen, ders ya da konu ara', style: TextStyle(color: Brand.slate500, fontSize: 15))),
                Icon(Icons.tune_rounded, color: Brand.slate400, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NextLessonCard extends ConsumerWidget {
  const _NextLessonCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lesson = ref.watch(nextLessonProvider).valueOrNull;
    if (lesson == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final pending = lesson.status == BookingStatus.pendingPayment;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Card(
        color: scheme.primaryContainer,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push(Routes.lesson(lesson.id)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(14)),
                  child: Icon(pending ? Icons.credit_card_rounded : (lesson.isQuestion ? Icons.photo_camera_rounded : Icons.event_available_rounded), color: Colors.white),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pending ? 'Ödemesi tamamlanmayan ders' : (lesson.isQuestion ? 'Sorunuz' : 'Sıradaki dersiniz'),
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: scheme.onPrimaryContainer),
                      ),
                      const SizedBox(height: 2),
                      Text(lesson.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5)),
                      Text(
                        lesson.isQuestion ? lesson.statusLabel : '${formatLessonRange(lesson.startAt, lesson.endAt)} · ${lesson.counterpart.name}',
                        style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
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
    );
  }
}

class _CenterShortcut extends ConsumerWidget {
  const _CenterShortcut();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final links = ref.watch(centerLinksProvider).valueOrNull ?? const [];
    if (links.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        children: [
          for (final link in links.take(3))
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: ListTile(
                  leading: const CircleAvatar(backgroundColor: Brand.gold100, child: Icon(Icons.school_rounded, color: Brand.gold700)),
                  title: Text(link.student.fullName),
                  subtitle: Text('${link.center.name}${link.student.gradeName != null ? ' · ${link.student.gradeName}' : ''}'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => context.push(Routes.centerChild(link.id)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _Services extends StatelessWidget {
  const _Services({required this.catalog});

  final Catalog catalog;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Hizmetlerimiz', subtitle: 'Sanal dershanemizde ihtiyacınıza uygun çalışma şeklini seçin.'),
        // Soru kredisi: fotoğrafla soru gönder, havuzdaki öğretmen çözsün
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Material(
            borderRadius: BorderRadius.circular(20),
            clipBehavior: Clip.antiAlias,
            child: Ink(
              decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF312E81), Color(0xFF4F46E5)])),
              child: InkWell(
                onTap: () => context.push(Routes.ask),
                child: const Padding(
                  padding: EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(radius: 24, backgroundColor: Color(0xFFFBBF24), child: Icon(Icons.photo_camera_rounded, color: Color(0xFF1E1B4B))),
                      SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Takıldığın soruyu sor', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17)),
                            SizedBox(height: 2),
                            Text('Fotoğrafını çek, branş öğretmeni adım adım çözsün. Çözülmezse kredin iade.', style: TextStyle(color: Colors.white70, height: 1.3)),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 150,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: catalog.services.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final service = catalog.services[i];
              return SizedBox(
                width: 220,
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => context.push(Routes.teacherSearch(TeacherQuery(service: service.slug))),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
                            child: Icon(_serviceIcons[service.slug] ?? Icons.menu_book_rounded, color: scheme.primary),
                          ),
                          const SizedBox(height: 12),
                          Text(service.name, style: Theme.of(context).textTheme.titleMedium),
                          if (service.description != null)
                            Text(service.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _Levels extends StatelessWidget {
  const _Levels({required this.catalog});

  final Catalog catalog;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final groups = ['SCHOOL', 'EXAM', 'OTHER'].map((g) => (g, catalog.levels.where((l) => l.group == g).toList())).where((e) => e.$2.isNotEmpty);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Kademeye göre öğretmen bul'),
        for (final (group, levels) in groups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 16, 8),
            child: Text(levelGroupLabels[group] ?? group, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: scheme.onSurfaceVariant)),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                for (final level in levels)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Card(
                      clipBehavior: Clip.antiAlias,
                      child: ListTile(
                        title: Text(level.name),
                        subtitle: Text(
                          catalog.subjectsFor(level).map((s) => s.name).join(' · '),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => context.push(Routes.teacherSearch(TeacherQuery(level: level.slug))),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Featured extends ConsumerWidget {
  const _Featured();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featured = ref.watch(featuredTeachersProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Öne çıkan öğretmenler',
          subtitle: 'Velilerin en çok tercih ettiği, yüksek puanlı öğretmenler.',
          action: TextButton(onPressed: () => context.push(Routes.teachers), child: const Text('Tümü')),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: featured.when(
            loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            error: (error, _) => ErrorView(error: error, compact: true, onRetry: () => ref.invalidate(featuredTeachersProvider)),
            data: (teachers) => Column(
              children: [
                for (final t in teachers) Padding(padding: const EdgeInsets.only(bottom: 10), child: TeacherTile(teacher: t)),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(Routes.teachers),
                    icon: const Icon(Icons.search_rounded),
                    label: const Text('Tüm öğretmenleri gör'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _HowItWorks extends ConsumerWidget {
  const _HowItWorks();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(catalogProvider).valueOrNull?.rules;
    final scheme = Theme.of(context).colorScheme;
    final steps = [
      (Icons.menu_book_rounded, 'Öğretmenini seç', 'Kademe, ders, fiyat ve yorumlara göre karşılaştır.'),
      (Icons.event_available_rounded, 'Saati seç, öde', 'Takvimdeki boş saatlerden birini seç; ödeme güvenle alınır.'),
      (Icons.verified_rounded, 'Öğretmen onaylar', '${rules?.approvalWindowHours ?? 12} saat içinde onaylanmazsa ücretin tamamı iade edilir.'),
      (Icons.videocam_rounded, 'Derse katıl', 'Online dersler uygulamadaki sanal sınıfta; kurulum gerekmez.'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'Nasıl çalışır?'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: [
              for (var i = 0; i < steps.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: scheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
                            child: Icon(steps[i].$1, color: scheme.primary),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${i + 1}. ${steps[i].$2}', style: const TextStyle(fontWeight: FontWeight.w800)),
                                const SizedBox(height: 2),
                                Text(steps[i].$3, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13.5, height: 1.35)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Trust extends ConsumerWidget {
  const _Trust();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(catalogProvider).valueOrNull?.rules;
    final items = [
      (Icons.shield_rounded, 'Onaylı öğretmenler', 'Kimlik ve diploma kontrolünden geçen öğretmenler “Onaylı” rozetiyle gösterilir.'),
      (Icons.credit_card_rounded, 'Paranız güvende', 'Ödeme ders gerçekleşip ${rules?.disputeWindowHours ?? 48} saatlik itiraz süresi dolana kadar öğretmene aktarılmaz.'),
      (Icons.reviews_rounded, 'Gerçek yorumlar', 'Yalnızca dersini tamamlamış öğrenciler ve veliler değerlendirme yapabilir.'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(
            children: [
              for (final item in items)
                ListTile(
                  leading: Icon(item.$1, color: const Color(0xFF059669)),
                  title: Text(item.$2),
                  subtitle: Text(item.$3),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CenterPromo extends StatelessWidget {
  const _CenterPromo();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Brand.b700, Brand.b900]),
          borderRadius: BorderRadius.circular(22),
        ),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.apartment_rounded, color: Brand.gold300, size: 18),
                SizedBox(width: 6),
                Text('Kurumlar için', style: TextStyle(color: Brand.gold100, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            const Text('Etüt merkezi ya da dershane mi yönetiyorsunuz?', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800, height: 1.25)),
            const SizedBox(height: 6),
            const Text(
              'Yoklama ve devamsızlık SMS’i, deneme analizi, ödeme planı ve veli portalı tek panelde.',
              style: TextStyle(color: Brand.b100, height: 1.4),
            ),
            const SizedBox(height: 14),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Brand.gold400, foregroundColor: Brand.b950, minimumSize: const Size(0, 44)),
              onPressed: () => openExternal(context, '${AppConfig.siteUrl}/kurumlar-icin'),
              child: const Text('Kurum panelini inceleyin'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Keşfet bölüm başlığı.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.subtitle, this.action});

  final String title;
  final String? subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13.5)),
                ],
              ],
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}
