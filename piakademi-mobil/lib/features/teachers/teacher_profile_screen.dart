import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/api/api_exception.dart';
import '../../core/config.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/rating.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import 'teacher_offers.dart';

class TeacherProfileScreen extends ConsumerWidget {
  const TeacherProfileScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(teacherProfileProvider(slug));
    return profile.when(
      loading: () => Scaffold(appBar: AppBar(leading: const AppBackButton()), body: const LoadingView()),
      error: (error, _) => Scaffold(appBar: AppBar(leading: const AppBackButton()), body: ErrorView(error: error, onRetry: () => ref.invalidate(teacherProfileProvider(slug)))),
      data: (teacher) => _ProfileView(teacher: teacher),
    );
  }
}

class _ProfileView extends ConsumerStatefulWidget {
  const _ProfileView({required this.teacher});

  final TeacherProfile teacher;

  @override
  ConsumerState<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends ConsumerState<_ProfileView> {
  late bool _favorite = widget.teacher.isFavorite;
  bool _favoriteBusy = false;
  bool _bioExpanded = false;

  TeacherProfile get t => widget.teacher;

  Future<void> _toggleFavorite() async {
    final session = ref.read(sessionProvider);
    if (!session.isSignedIn) {
      context.push(Uri(path: Routes.login, queryParameters: {'devam': Routes.teacher(t.slug)}).toString());
      return;
    }
    setState(() => _favoriteBusy = true);
    try {
      final value = await ref.read(apiProvider).setFavorite(t.userId, !_favorite);
      if (!mounted) return;
      setState(() => _favorite = value);
      ref.invalidate(favoritesProvider);
      showSnack(context, value ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _favoriteBusy = false);
    }
  }

  void _book({bool question = false}) {
    final location = question ? Routes.question(t.slug) : Routes.booking(t.slug);
    context.push(location);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final maintenance = ref.watch(catalogProvider).valueOrNull?.maintenance.on ?? false;
    final scheme = Theme.of(context).colorScheme;
    final canBook = !session.isTeacher;
    final hasLessons = t.offerings.any((o) => o.durations.isNotEmpty);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            leading: const AppBackButton(),
            pinned: true,
            expandedHeight: 0,
            title: Text(t.name),
            actions: [
              IconButton(
                tooltip: 'Paylaş',
                onPressed: () => SharePlus.instance.share(ShareParams(text: '${t.name} — Pi Kampüs\n${AppConfig.siteUrl}/ogretmen/${t.slug}')),
                icon: const Icon(Icons.ios_share_rounded),
              ),
              if (!session.isTeacher)
                IconButton(
                  tooltip: _favorite ? 'Favorilerden çıkar' : 'Favorilere ekle',
                  onPressed: _favoriteBusy ? null : _toggleFavorite,
                  icon: Icon(_favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: _favorite ? const Color(0xFFE11D48) : null),
                ),
            ],
          ),
          SliverToBoxAdapter(child: _Header(teacher: t)),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            sliver: SliverList.list(
              children: [
                if (t.bio != null && t.bio!.isNotEmpty)
                  SectionCard(
                    title: 'Hakkında',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.bio!, maxLines: _bioExpanded ? null : 6, overflow: _bioExpanded ? null : TextOverflow.fade, style: const TextStyle(height: 1.55)),
                        if (t.bio!.length > 280)
                          TextButton(
                            style: TextButton.styleFrom(padding: EdgeInsets.zero),
                            onPressed: () => setState(() => _bioExpanded = !_bioExpanded),
                            child: Text(_bioExpanded ? 'Daha az göster' : 'Devamını oku'),
                          ),
                      ],
                    ),
                  ),
                if (t.education != null || t.videoUrl != null) ...[
                  const SizedBox(height: 12),
                  SectionCard(
                    title: 'Eğitim ve tanıtım',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (t.education != null) InfoRow(label: 'Eğitim', value: t.education!, icon: Icons.school_outlined),
                        if (t.experienceYears != null) InfoRow(label: 'Deneyim', value: '${t.experienceYears} yıl', icon: Icons.workspace_premium_outlined),
                        if (t.videoUrl != null) ...[
                          const SizedBox(height: 8),
                          OutlinedButton.icon(
                            onPressed: () => openExternal(context, t.videoUrl!),
                            icon: const Icon(Icons.play_circle_outline_rounded),
                            label: const Text('Tanıtım videosunu izle'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                if (t.offersIntro && canBook && hasLessons) ...[
                  const SizedBox(height: 12),
                  NoticeBox(
                    tone: Tone.green,
                    icon: Icons.waving_hand_rounded,
                    title: 'Ücretsiz 15 dakika tanışma',
                    message: 'Ders almadan önce öğretmenle online tanışın, hedefinizi konuşun. Ücret alınmaz.',
                    action: TextButton(onPressed: () => context.push(Routes.intro(t.slug)), child: const Text('Tanışma iste')),
                  ),
                ],
                const SizedBox(height: 12),
                _Offerings(teacher: t, onBook: canBook ? (offering, question) => context.push(question ? Routes.question(t.slug, offeringId: offering.id) : Routes.booking(t.slug, offeringId: offering.id)) : null),
                TeacherOffers(teacher: t, canBuy: canBook),
                const SizedBox(height: 12),
                _Modes(teacher: t),
                const SizedBox(height: 12),
                _Reviews(teacher: t),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: !canBook
          ? null
          : SafeArea(
              top: false,
              child: Container(
                decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                child: maintenance
                    ? const Text('Site bakımda olduğu için randevu alma geçici olarak kapalı.', textAlign: TextAlign.center)
                    : Row(
                        children: [
                          if (t.minHourlyPrice != null)
                            Expanded(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(formatMoney(t.minHourlyPrice!), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                                  Text('saatlik, başlayan', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                                ],
                              ),
                            ),
                          IconButton.outlined(
                            tooltip: 'Mesaj gönder',
                            onPressed: () => context.push(Uri(path: Routes.messageTeacher(t.slug), queryParameters: {'ad': t.name}).toString()),
                            icon: const Icon(Icons.chat_bubble_outline_rounded),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: t.minHourlyPrice != null ? 1 : 2,
                            child: FilledButton.icon(
                              onPressed: hasLessons ? () => _book() : null,
                              icon: const Icon(Icons.event_available_rounded),
                              label: const Text('Randevu al'),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.teacher});

  final TeacherProfile teacher;

  @override
  Widget build(BuildContext context) {
    final t = teacher;
    final location = [t.district?.name, t.city?.name].whereType<String>().join(', ');
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: Brand.heroGradient,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(28), border: Border.all(color: Colors.white24, width: 3)),
                child: Avatar(name: t.name, photoUrl: t.photoUrl, size: 84, radius: 25),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t.name, style: const TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                    if (t.verified) ...[
                      const SizedBox(height: 6),
                      const ToneBadge(label: 'Onaylı öğretmen', tone: Tone.green, icon: Icons.verified_rounded),
                    ],
                    const SizedBox(height: 8),
                    DefaultTextStyle.merge(
                      style: const TextStyle(color: Colors.white),
                      child: t.ratingCount > 0
                          ? Row(
                              children: [
                                const Icon(Icons.star_rounded, color: Brand.gold400, size: 20),
                                const SizedBox(width: 3),
                                Text(formatRating(t.ratingAvg), style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                                Text(' (${t.ratingCount} yorum)', style: const TextStyle(color: Brand.b100)),
                              ],
                            )
                          : const Text('Yeni öğretmen', style: TextStyle(color: Brand.b100, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (t.headline != null) ...[
            const SizedBox(height: 14),
            Text(t.headline!, style: const TextStyle(color: Brand.b50, fontSize: 15, height: 1.4, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (t.experienceYears != null) _HeaderChip(icon: Icons.workspace_premium_rounded, text: '${t.experienceYears} yıl deneyim'),
              _HeaderChip(icon: Icons.check_circle_rounded, text: '${t.completedLessons} ders'),
              if (t.avgResponseMinutes != null) _HeaderChip(icon: Icons.bolt_rounded, text: 'Ortalama ${_response(t.avgResponseMinutes!)} içinde yanıt'),
              if (location.isNotEmpty) _HeaderChip(icon: Icons.place_rounded, text: location),
            ],
          ),
        ],
      ),
    );
  }

  static String _response(int minutes) => minutes < 60 ? '$minutes dk' : formatDuration(Duration(minutes: minutes));
}

class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999), border: Border.all(color: Colors.white24)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Brand.gold300),
          const SizedBox(width: 5),
          Flexible(child: Text(text, style: const TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _Offerings extends StatelessWidget {
  const _Offerings({required this.teacher, required this.onBook});

  final TeacherProfile teacher;
  final void Function(Offering offering, bool question)? onBook;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    if (teacher.offerings.isEmpty) {
      return const SectionCard(title: 'Dersler ve ücretler', child: Text('Öğretmen henüz ders eklemedi.'));
    }
    return SectionCard(
      title: 'Dersler ve ücretler',
      subtitle: 'KDV dahil; öğretmen onaylamazsa ücretin tamamı iade edilir.',
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Column(
        children: [
          for (final o in teacher.offerings) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(o.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                      ToneBadge(label: o.service.name, tone: Tone.brand),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final d in o.durations)
                        _PriceChip(
                          label: durationLabel(d.minutes),
                          price: formatMoney(d.price),
                          onTap: onBook == null ? null : () => onBook!(o, false),
                        ),
                      if (o.acceptsQuestions)
                        _PriceChip(
                          label: 'Fotoğrafla soru',
                          price: formatMoney(o.questionPrice!),
                          icon: Icons.photo_camera_outlined,
                          onTap: onBook == null ? null : () => onBook!(o, true),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (o != teacher.offerings.last) Divider(color: scheme.outlineVariant),
          ],
        ],
      ),
    );
  }
}

class _PriceChip extends StatelessWidget {
  const _PriceChip({required this.label, required this.price, this.onTap, this.icon});

  final String label;
  final String price;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: scheme.outlineVariant)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 16, color: scheme.primary), const SizedBox(width: 6)],
              Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              const SizedBox(width: 8),
              Text(price, style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}

class _Modes extends StatelessWidget {
  const _Modes({required this.teacher});

  final TeacherProfile teacher;

  @override
  Widget build(BuildContext context) {
    final t = teacher;
    final places = [
      if (t.inPersonAtStudentHome) 'öğrencinin adresinde',
      if (t.inPersonAtTeacherPlace) 'öğretmenin yerinde',
    ];
    return SectionCard(
      title: 'Ders şekli',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ModeRow(icon: Icons.videocam_rounded, enabled: t.offersOnline, title: 'Online ders', detail: 'Uygulamadaki sanal sınıfta: görüntü, ses, sohbet ve ortak beyaz tahta.'),
          const SizedBox(height: 10),
          _ModeRow(
            icon: Icons.place_rounded,
            enabled: t.offersInPerson,
            title: 'Yüz yüze ders',
            detail: t.offersInPerson
                ? [
                    if (places.isNotEmpty) 'Ders ${places.join(' veya ')}.',
                    if (t.serviceDistricts.isNotEmpty) 'Hizmet bölgeleri: ${t.serviceDistricts.map((d) => d.name).join(', ')}.',
                  ].join(' ')
                : 'Bu öğretmen yüz yüze ders vermiyor.',
          ),
        ],
      ),
    );
  }
}

class _ModeRow extends StatelessWidget {
  const _ModeRow({required this.icon, required this.enabled, required this.title, required this.detail});

  final IconData icon;
  final bool enabled;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(enabled ? icon : Icons.block_rounded, color: enabled ? scheme.primary : scheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                if (detail.isNotEmpty) Text(detail, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13.5, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Reviews extends StatelessWidget {
  const _Reviews({required this.teacher});

  final TeacherProfile teacher;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      title: 'Yorumlar',
      subtitle: teacher.ratingCount > 0 ? '${formatRating(teacher.ratingAvg)} ortalama · ${teacher.ratingCount} değerlendirme' : null,
      child: teacher.reviews.isEmpty
          ? Text('Henüz yorum yok. İlk dersi siz alın, ilk yorumu siz yazın.', style: TextStyle(color: scheme.onSurfaceVariant))
          : Column(
              children: [
                for (final r in teacher.reviews)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: ReviewItem(review: r, teacherName: teacher.name),
                  ),
              ],
            ),
    );
  }
}

class ReviewItem extends StatelessWidget {
  const ReviewItem({super.key, required this.review, this.teacherName});

  final Review review;
  final String? teacherName;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Stars(rating: review.rating, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text('${review.studentName} · ${review.lesson}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12.5)),
            ),
            Text(formatDate(review.createdAt), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
          ],
        ),
        if (review.comment != null && review.comment!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(review.comment!, style: const TextStyle(height: 1.45)),
        ],
        if (review.teacherReply != null) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: scheme.surfaceContainerLow, borderRadius: BorderRadius.circular(12), border: Border(left: BorderSide(color: scheme.primary, width: 3))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(teacherName == null ? 'Öğretmenin cevabı' : '$teacherName cevapladı', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: scheme.primary)),
                const SizedBox(height: 2),
                Text(review.teacherReply!, style: const TextStyle(height: 1.4)),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
