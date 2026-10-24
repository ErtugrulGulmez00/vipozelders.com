import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/format/money.dart';
import '../../core/models/commerce.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../booking/booking_screen.dart';
import '../shared/coupon_field.dart';
import '../shared/data.dart';
import '../shared/purchase_status_screen.dart';
import '../shared/widgets.dart';

Tone _courseTone(String status) => switch (status) {
      'OPEN' => Tone.sky,
      'CONFIRMED' => Tone.green,
      'CANCELLED' => Tone.rose,
      _ => Tone.slate,
    };

/// Grup dersleri (sanal dershane): 4–10 kişilik programlar, kişi başı ücret.
class GroupListScreen extends ConsumerWidget {
  const GroupListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final signedIn = ref.watch(sessionProvider.select((s) => s.isStudent));
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        title: const Text('Grup dersleri'),
        actions: [if (signedIn) TextButton(onPressed: () => context.push(Routes.myGroups), child: const Text('Kayıtlarım'))],
      ),
      body: AsyncBody<(bool, List<GroupCourse>)>(
        value: ref.watch(groupCoursesProvider),
        onRetry: () => ref.invalidate(groupCoursesProvider),
        builder: (data) {
          final (enabled, items) = data;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(groupCoursesProvider),
            child: items.isEmpty
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      const SizedBox(height: 60),
                      EmptyView(
                        icon: Icons.groups_2_outlined,
                        title: enabled ? 'Şu an kayıt alan grup dersi yok' : 'Grup dersleri şu an kapalı',
                        message: enabled ? 'Yeni programlar açıldıkça burada görünecek.' : null,
                      ),
                    ],
                  )
                : ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: items.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => i == 0
                        ? Text('Küçük gruplarla canlı ders: öğretmen haftalık program açar, kişi başı ücret ödenir. En az katılımcı sayısına ulaşılmazsa ders iptal olur, ücretin tamamı iade edilir.',
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.4))
                        : GroupCourseTile(course: items[i - 1]),
                  ),
          );
        },
      ),
    );
  }
}

class GroupCourseTile extends StatelessWidget {
  const GroupCourseTile({super.key, required this.course, this.trailing});

  final GroupCourse course;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = course;
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: scheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: scheme.outlineVariant)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(Routes.group(c.code)),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(c.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
                  ToneBadge(label: c.statusLabel, tone: _courseTone(c.status)),
                ],
              ),
              const SizedBox(height: 4),
              Text('${c.levelName} · ${c.subjectName}${c.teacher == null ? '' : ' · ${c.teacher!.name}'}', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _Info(Icons.event_rounded, c.firstStartAt == null ? '${c.sessionCount} oturum' : '${formatShortDate(c.firstStartAt!)} başlar · ${c.sessionCount} oturum'),
                  _Info(Icons.timer_outlined, durationLabel(c.durationMinutes)),
                  _Info(Icons.people_alt_outlined, '${c.seatsTaken}/${c.capacity} kişi'),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Text(formatMoney(c.price), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  Text(' kişi başı', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                  const Spacer(),
                  ?trailing,
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 16, color: color), const SizedBox(width: 4), Text(text, style: TextStyle(fontSize: 13, color: color))]);
  }
}

/// Grup dersi ayrıntısı: program, kontenjan, kayıt ve ödeme, oturumlara katılma.
class GroupCourseScreen extends ConsumerWidget {
  const GroupCourseScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.groups), title: const Text('Grup dersi')),
      body: AsyncBody<GroupCourse>(
        value: ref.watch(groupCourseProvider(code)),
        onRetry: () => ref.invalidate(groupCourseProvider(code)),
        builder: (course) => RefreshIndicator(onRefresh: () async => ref.invalidate(groupCourseProvider(code)), child: _CourseBody(course: course)),
      ),
    );
  }
}

class _CourseBody extends ConsumerStatefulWidget {
  const _CourseBody({required this.course});

  final GroupCourse course;

  @override
  ConsumerState<_CourseBody> createState() => _CourseBodyState();
}

class _CourseBodyState extends ConsumerState<_CourseBody> {
  bool _busy = false;

  Future<void> _cancel() async {
    final e = widget.course.enrollment!;
    final paid = e.status == 'PAID';
    final ok = await confirmDialog(
      context,
      title: 'Kaydı iptal et',
      message: paid ? 'Ders başlamadan iptal ettiğiniz için ödediğiniz ${formatMoney(e.price)} kartınıza iade edilecek.' : 'Kaydınız kapatılacak.',
      confirmText: 'İptal et',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiProvider).cancelGroupEnrollment(e.id);
      bumpPurchases(ref);
      if (mounted) showSnack(context, paid ? 'Kaydınız iptal edildi; ücret iade ediliyor.' : 'Kaydınız kapatıldı.');
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.course;
    final scheme = Theme.of(context).colorScheme;
    final session = ref.watch(sessionProvider);
    final e = c.enrollment;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Text(c.title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 4),
        Row(children: [Text('${c.levelName} · ${c.subjectName}', style: TextStyle(color: scheme.onSurfaceVariant)), const Spacer(), ToneBadge(label: c.statusLabel, tone: _courseTone(c.status))]),
        if (c.teacher != null) ...[
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(name: c.teacher!.name, photoUrl: c.teacher!.photoUrl, size: 44),
            title: Text(c.teacher!.name, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: c.teacher!.headline == null ? null : Text(c.teacher!.headline!, maxLines: 1, overflow: TextOverflow.ellipsis),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push(Routes.teacher(c.teacher!.slug)),
          ),
        ],
        const SizedBox(height: 8),
        SectionCard(
          child: Column(
            children: [
              InfoRow(label: 'Kişi başı ücret', value: '${formatMoney(c.price)} (tüm oturumlar)'),
              InfoRow(label: 'Kontenjan', value: '${c.seatsTaken}/${c.capacity} · en az ${c.minParticipants} kişi'),
              if (c.enrollDeadline != null) InfoRow(label: 'Kayıt bitişi', value: formatDateTime(c.enrollDeadline!)),
              InfoRow(label: 'Oturum', value: '${c.sessionCount} × ${durationLabel(c.durationMinutes)}'),
            ],
          ),
        ),
        if (c.description != null) ...[const SizedBox(height: 12), SectionCard(title: 'Hakkında', child: Text(c.description!, style: const TextStyle(height: 1.45)))],
        if (e != null) ...[
          const SizedBox(height: 12),
          NoticeBox(
            tone: e.status == 'PAID' ? Tone.green : Tone.amber,
            title: 'Kaydınız: ${e.statusLabel}',
            message: e.status == 'PAID'
                ? (c.status == 'CONFIRMED' ? 'Ders kesinleşti; oturum saatinde aşağıdan sanal sınıfa katılabilirsiniz.' : 'Kayıt bitişinde en az katılımcı sayısına ulaşılırsa ders kesinleşir; ulaşılmazsa ücretin tamamı iade edilir.')
                : e.status == 'INVITED'
                    ? 'Öğretmeniniz sizi bu derse davet etti. Kayıt için ödemeyi tamamlayın.'
                    : 'Ödeme tamamlanmadı.',
          ),
        ],
        const SectionTitle('Program'),
        for (final s in c.sessions)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: CircleAvatar(child: Text('${s.index + 1}')),
              title: Text(formatLessonRange(s.startAt, s.endAt)),
              subtitle: Text(s.statusLabel),
              trailing: s.canJoin ? FilledButton(onPressed: () => context.push(Routes.groupClassroom(s.id)), child: const Text('Katıl')) : null,
            ),
          ),
        const SizedBox(height: 12),
        if (c.canEnroll)
          FilledButton.icon(
            onPressed: () => showModalBottomSheet<void>(context: context, isScrollControlled: true, useSafeArea: true, builder: (_) => _EnrollSheet(course: c)),
            icon: const Icon(Icons.how_to_reg_rounded),
            label: Text(e?.status == 'INVITED' ? 'Daveti kabul et · ${formatMoney(c.price)}' : 'Kayıt ol · ${formatMoney(c.price)}'),
          )
        else if (!session.isSignedIn && c.status == 'OPEN')
          OutlinedButton(onPressed: () => context.push(Uri(path: Routes.login, queryParameters: {'devam': Routes.group(c.code)}).toString()), child: const Text('Kayıt olmak için giriş yapın')),
        if (c.canCancel) ...[
          const SizedBox(height: 8),
          BusyButton(busy: _busy, onPressed: _cancel, label: 'Kaydımı iptal et', outlined: true, destructive: true),
        ],
      ],
    );
  }
}

class _EnrollSheet extends ConsumerStatefulWidget {
  const _EnrollSheet({required this.course});

  final GroupCourse course;

  @override
  ConsumerState<_EnrollSheet> createState() => _EnrollSheetState();
}

class _EnrollSheetState extends ConsumerState<_EnrollSheet> {
  final _learner = TextEditingController();
  bool _consent = false;
  bool _busy = false;
  String? _error;
  String? _couponCode;
  CouponCheck? _coupon;

  @override
  void dispose() {
    _learner.dispose();
    super.dispose();
  }

  Future<void> _enroll() async {
    if (!_consent) {
      setState(() => _error = 'Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final (enrollment, payment) = await ref.read(apiProvider).enrollGroup(widget.course.code, learnerName: _learner.text, couponCode: _couponCode);
      if (!mounted) return;
      Navigator.pop(context);
      context.push(Routes.purchasePayment(PurchaseKind.group, enrollment.id), extra: payment);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.course;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Kayıt: ${c.title}', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            TextField(
              controller: _learner,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Öğrencinin adı (isteğe bağlı)', helperText: 'Öğretmen listede bu adı görür.'),
            ),
            const SizedBox(height: 8),
            CouponField(
              target: 'group',
              refId: c.id,
              onChanged: (code, check) => setState(() {
                _couponCode = code;
                _coupon = check;
              }),
            ),
            CheckboxListTile(
              value: _consent,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              onChanged: (v) => setState(() => _consent = v ?? false),
              title: ConsentText(onOpen: (slug) => context.push(Routes.page(slug))),
            ),
            const Text('İlk oturumdan önce kaydınızı iptal ederseniz ücretin tamamı iade edilir; ders başladıktan sonra iade yapılmaz.', style: TextStyle(fontSize: 12)),
            if (_error != null) ...[const SizedBox(height: 8), NoticeBox(message: _error!, tone: Tone.rose)],
            const SizedBox(height: 12),
            BusyButton(busy: _busy, onPressed: _enroll, label: '${formatMoney(_coupon?.finalPrice ?? c.price)} öde', icon: Icons.lock_rounded),
          ],
        ),
      ),
    );
  }
}

/// Grup derslerim: öğrenci için kayıtları, öğretmen için açtığı dersler (ders açma web panelinde).
class MyGroupsScreen extends ConsumerWidget {
  const MyGroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teacher = ref.watch(sessionProvider.select((s) => s.isTeacher));
    return Scaffold(
      appBar: AppBar(leading: AppBackButton(fallback: teacher ? Routes.teacherAccount : Routes.account), title: const Text('Grup derslerim')),
      body: teacher
          ? AsyncBody<List<GroupCourse>>(
              value: ref.watch(teacherGroupsProvider),
              onRetry: () => ref.invalidate(teacherGroupsProvider),
              builder: (items) => _list(
                context,
                ref,
                items.map((c) => GroupCourseTile(course: c)).toList(),
                empty: 'Henüz grup dersiniz yok. Grup dersini web panelindeki “Grup dersleri” sayfasından açabilirsiniz.',
                action: TextButton.icon(
                  onPressed: () => context.push(Routes.teacherWeb('/ogretmen-paneli/grup-dersleri', 'Grup dersleri')),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Grup dersi aç'),
                ),
              ),
            )
          : AsyncBody<List<MyGroupEnrollment>>(
              value: ref.watch(myGroupsProvider),
              onRetry: () => ref.invalidate(myGroupsProvider),
              builder: (items) => _list(
                context,
                ref,
                items.map((m) => GroupCourseTile(course: m.course, trailing: ToneBadge(label: m.enrollment.statusLabel, tone: m.enrollment.status == 'PAID' ? Tone.green : Tone.amber))).toList(),
                empty: 'Henüz bir grup dersine kaydınız yok.',
                action: TextButton(onPressed: () => context.push(Routes.groups), child: const Text('Grup derslerine göz atın')),
              ),
            ),
    );
  }

  Widget _list(BuildContext context, WidgetRef ref, List<Widget> tiles, {required String empty, Widget? action}) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(myGroupsProvider);
        ref.invalidate(teacherGroupsProvider);
      },
      child: tiles.isEmpty
          ? ListView(physics: const AlwaysScrollableScrollPhysics(), children: [const SizedBox(height: 60), EmptyView(icon: Icons.groups_2_outlined, title: empty, action: action)])
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              itemCount: tiles.length + (action == null ? 0 : 1),
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, i) => i < tiles.length ? tiles[i] : Center(child: action),
            ),
    );
  }
}
