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

class ExploreScreen extends ConsumerWidget {
  const ExploreScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(catalogProvider);
    ref.invalidate(featuredTeachersProvider);
    ref.invalidate(nextLessonProvider);
    await ref.read(featuredTeachersProvider.future).catchError((_) => <TeacherCard>[]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(catalogProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;
    // Açık başlık alanı: durum çubuğu simgeleri koyu (koyu temada açık).
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: (dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark).copyWith(statusBarColor: Colors.transparent),
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
          // Kaydırınca durum çubuğunun altı başlık renginde kalsın (simgeler okunur).
          Positioned(top: 0, left: 0, right: 0, height: MediaQuery.paddingOf(context).top, child: ColoredBox(color: Theme.of(context).colorScheme.surface)),
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
    final scheme = Theme.of(context).colorScheme;
    final top = MediaQuery.paddingOf(context).top;
    const headline = TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 40, height: 1.02, fontWeight: FontWeight.w800, letterSpacing: -1.2);
    return Container(
      color: scheme.surface,
      padding: EdgeInsets.fromLTRB(20, top + 10, 12, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              PiLogo(size: 34, name: catalog?.site.name ?? 'Pi Kampüs'),
              const Spacer(),
              const NotificationBell(),
            ],
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (me != null) ...[
                  Text('Merhaba ${me.firstName} 👋', style: TextStyle(color: scheme.onSurfaceVariant, fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 10),
                ],
                // Sitedeki sarı güvence etiketi
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Brand.gold100, borderRadius: BorderRadius.circular(999)),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.verified_rounded, size: 15, color: Brand.gold700),
                      SizedBox(width: 6),
                      Flexible(
                        child: Text('Onaylı öğretmenler · Güvenli ödeme · Ders olmazsa iade', style: TextStyle(color: Brand.gold700, fontWeight: FontWeight.w700, fontSize: 12)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Text('Doğru öğretmen,', style: headline.copyWith(color: scheme.onSurface)),
                const SizedBox(height: 6),
                // Mercan etiket: "doğru saatte."
                Transform.rotate(
                  angle: -0.02,
                  alignment: Alignment.centerLeft,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
                    decoration: BoxDecoration(color: Brand.b600, borderRadius: BorderRadius.circular(16)),
                    child: Text('doğru saatte.', style: headline.copyWith(color: Colors.white)),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  catalog?.site.tagline ?? 'Okul öncesinden üniversite sınavına, doğru öğretmen bir tık uzağında.',
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 15.5, height: 1.4),
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
                        return _LevelPill(label: level.name, onTap: () => context.push(Routes.teacherSearch(TeacherQuery(level: level.slug))));
                      },
                    ),
                  ),
                if (catalog != null) ...[
                  const SizedBox(height: 18),
                  _HeroTiles(catalog: catalog!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelPill extends StatelessWidget {
  const _LevelPill({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainer,
      shape: const StadiumBorder(),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(label, style: TextStyle(color: scheme.onTertiaryContainer, fontWeight: FontWeight.w600, fontSize: 13)),
        ),
      ),
    );
  }
}

/// Sitedeki renkli ders kutuları: katalogda varsa o dersin öğretmenlerine, yoksa öğretmen listesine gider.
class _HeroTiles extends StatelessWidget {
  const _HeroTiles({required this.catalog});

  final Catalog catalog;

  @override
  Widget build(BuildContext context) {
    Subject? subject(String slug) => catalog.subjects.where((s) => s.slug == slug).firstOrNull;
    String search(String slug) => subject(slug) == null ? Routes.teachers : Routes.teacherSearch(TeacherQuery(subject: slug));
    final tiles = [
      (subject('matematik')?.name ?? 'Matematik', 'LGS · YKS', search('matematik'), Brand.b600, Colors.white, -0.035),
      (subject('fen-bilimleri')?.name ?? 'Fen Bilimleri', 'Ortaokul · Lise', search('fen-bilimleri'), Brand.gold400, Brand.ink900, 0.0),
      (subject('ingilizce')?.name ?? 'İngilizce', 'Her kademe', search('ingilizce'), Brand.iris500, Colors.white, 0.0),
      ('Soru çöz', 'Fotoğrafla', Routes.ask, Brand.mint400, Brand.ink950, 0.035),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      // Padding verilmezse GridView durum çubuğu payını ekler
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.45,
      children: [
        for (final (title, label, route, background, foreground, angle) in tiles)
          Transform.rotate(
            angle: angle,
            child: Material(
              color: background,
              borderRadius: BorderRadius.circular(28),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.push(route),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(label, style: TextStyle(color: foreground.withValues(alpha: 0.85), fontWeight: FontWeight.w700, fontSize: 12)),
                      Text(title, maxLines: 2, style: TextStyle(fontFamily: AppTheme.displayFamily, color: foreground, fontWeight: FontWeight.w800, fontSize: 21, height: 1.05)),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Sitedeki arama kutusu: lacivert çerçeve içinde beyaz alan ve mercan düğme.
class _SearchField extends StatelessWidget {
  const _SearchField({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Öğretmen, ders ya da konu ara',
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Brand.ink900,
          borderRadius: BorderRadius.circular(28),
          boxShadow: [BoxShadow(color: Brand.ink900.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8))],
        ),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 6, 6),
              child: Row(
                children: [
                  const Expanded(child: Text('Öğretmen, ders ya da konu ara', style: TextStyle(color: Brand.ink500, fontSize: 15, fontWeight: FontWeight.w600))),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: Brand.b600, borderRadius: BorderRadius.circular(16)),
                    child: const Icon(Icons.search_rounded, color: Colors.white),
                  ),
                ],
              ),
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

/// Sitedeki hizmet kutularının renkleri: simge zemini, simge rengi.
const _serviceStyles = {
  'ozel-ders': (Icons.school_rounded, Brand.b100, Brand.b700),
  'soru-cozum': (Icons.help_center_rounded, Brand.gold100, Brand.gold700),
  'kocluk': (Icons.track_changes_rounded, Brand.mint100, Brand.mint800),
};
const _fallbackServiceStyle = (Icons.menu_book_rounded, Brand.iris100, Brand.iris700);

class _Services extends StatelessWidget {
  const _Services({required this.catalog});

  final Catalog catalog;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rules = catalog.rules;
    return Container(
      color: scheme.surfaceContainer,
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(title: 'Size nasıl yardımcı olalım?', subtitle: 'Sanal dershanemizde ihtiyacınıza uygun çalışma şeklini seçin.'),
          SizedBox(
            height: 196,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: catalog.services.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, i) {
                final service = catalog.services[i];
                final (icon, tile, ink) = _serviceStyles[service.slug] ?? _fallbackServiceStyle;
                return SizedBox(
                  width: 230,
                  child: Material(
                    color: scheme.surface,
                    borderRadius: BorderRadius.circular(28),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => context.push(Routes.teacherSearch(TeacherQuery(service: service.slug))),
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(color: tile, borderRadius: BorderRadius.circular(16)),
                              child: Icon(icon, color: ink),
                            ),
                            const SizedBox(height: 12),
                            Text(service.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleLarge),
                            if (service.description != null)
                              Flexible(child: Text(service.description!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13))),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          // Soru çözüm: fotoğrafla soru gönder, havuzdaki öğretmen çözsün
          _ColorCard(
            background: Brand.gold400,
            foreground: Brand.ink900,
            icon: Icons.photo_camera_rounded,
            iconBackground: Colors.white.withValues(alpha: 0.7),
            title: 'Takıldığınız sorunun fotoğrafını gönderin',
            text: 'Branş öğretmeni ${rules.questionAnswerHours} saat içinde çözsün; çözülmezse krediniz iade.',
            action: 'Soru sor',
            actionBackground: Brand.ink900,
            actionForeground: Colors.white,
            onTap: () => context.push(Routes.ask),
          ),
          if (rules.groupsEnabled)
            _ColorCard(
              background: Brand.ink900,
              foreground: Colors.white,
              icon: Icons.groups_2_rounded,
              iconForeground: Brand.gold400,
              iconBackground: Colors.white.withValues(alpha: 0.1),
              title: 'Grup dersleri: sanal dershane',
              text: '4–10 kişilik online sınıflar, birebir dersten çok daha uygun. En az kişi dolmazsa ücretin tamamı iade.',
              action: 'Programlar',
              actionBackground: Brand.gold400,
              actionForeground: Brand.ink900,
              onTap: () => context.push(Routes.groups),
            ),
          if (rules.subscriptionsEnabled)
            _ColorCard(
              background: Brand.iris500,
              foreground: Colors.white,
              icon: Icons.repeat_rounded,
              iconBackground: Colors.white.withValues(alpha: 0.15),
              title: 'Aylık soru aboneliği',
              text: 'Kendi öğretmeninize ${rules.subscriptionDays} gün boyunca her gün soru gönderin; otomatik çekim yok, kendiliğinden yenilenmez.',
              action: 'Öğretmenler',
              actionBackground: Colors.white,
              actionForeground: Brand.ink900,
              onTap: () => context.push(Routes.teacherSearch(const TeacherQuery(subscription: true))),
            ),
        ],
      ),
    );
  }
}

/// Sitedeki renkli tanıtım kartları (soru çözüm, grup dersi, abonelik).
class _ColorCard extends StatelessWidget {
  const _ColorCard({
    required this.background,
    required this.foreground,
    required this.icon,
    required this.iconBackground,
    this.iconForeground,
    required this.title,
    required this.text,
    required this.action,
    required this.actionBackground,
    required this.actionForeground,
    required this.onTap,
  });

  final Color background;
  final Color foreground;
  final IconData icon;
  final Color iconBackground;
  final Color? iconForeground;
  final String title;
  final String text;
  final String action;
  final Color actionBackground;
  final Color actionForeground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Material(
        color: background,
        borderRadius: BorderRadius.circular(28),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(color: iconBackground, borderRadius: BorderRadius.circular(16)),
                      child: Icon(icon, color: iconForeground ?? foreground),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: TextStyle(fontFamily: AppTheme.displayFamily, color: foreground, fontWeight: FontWeight.w800, fontSize: 18, height: 1.15)),
                          const SizedBox(height: 4),
                          Text(text, style: TextStyle(color: foreground.withValues(alpha: 0.85), fontSize: 13.5, height: 1.35)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                  decoration: BoxDecoration(color: actionBackground, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(action, style: TextStyle(color: actionForeground, fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(width: 4),
                      Icon(Icons.arrow_forward_rounded, size: 18, color: actionForeground),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
          color: Brand.ink900,
          borderRadius: BorderRadius.circular(28),
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
              'Yoklama ve devamsızlık bildirimi, etüt, deneme analizi, ödeme planı ve veli portalı tek panelde.',
              style: TextStyle(color: Brand.ink200, height: 1.4),
            ),
            const SizedBox(height: 14),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Brand.gold400, foregroundColor: Brand.ink900, minimumSize: const Size(0, 44)),
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
