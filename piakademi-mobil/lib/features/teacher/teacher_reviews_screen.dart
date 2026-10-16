import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';
import '../teachers/teacher_profile_screen.dart';

/// Öğretmenin aldığı yorumlar ve herkese açık cevapları.
class TeacherReviewsScreen extends ConsumerWidget {
  const TeacherReviewsScreen({super.key});

  Future<void> _reply(BuildContext context, WidgetRef ref, Review review) async {
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ReplySheet(initial: review.teacherReply ?? ''),
    );
    if (text == null) return;
    try {
      await ref.read(apiProvider).replyToReview(review.id, text);
      ref.invalidate(teacherReviewsProvider);
      if (context.mounted) showSnack(context, text.isEmpty ? 'Cevabınız kaldırıldı.' : 'Cevabınız yayınlandı.');
    } on ApiException catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviews = ref.watch(teacherReviewsProvider);
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Yorumlar')),
      body: AsyncBody(
        value: reviews,
        onRetry: () => ref.invalidate(teacherReviewsProvider),
        builder: (items) => RefreshIndicator(
          onRefresh: () => ref.refresh(teacherReviewsProvider.future),
          child: items.isEmpty
              ? RefreshableScroll(
                  onRefresh: () => ref.refresh(teacherReviewsProvider.future),
                  child: const EmptyView(icon: Icons.reviews_outlined, title: 'Henüz yorum yok', message: 'Dersini tamamlayan veliler yorum bıraktıkça burada görünür.'),
                )
              : ListView.separated(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final r = items[i];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (r.status != null && r.status != 'PUBLISHED') ...[
                              const Align(alignment: Alignment.centerLeft, child: ToneBadge(label: 'Yönetim tarafından gizlendi', tone: Tone.slate)),
                              const SizedBox(height: 8),
                            ],
                            ReviewItem(review: r, teacherName: 'Siz'),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton.icon(
                                onPressed: () => _reply(context, ref, r),
                                icon: const Icon(Icons.reply_rounded, size: 18),
                                label: Text(r.teacherReply == null ? 'Cevap yaz' : 'Cevabı düzenle'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _ReplySheet extends StatefulWidget {
  const _ReplySheet({required this.initial});

  final String initial;

  @override
  State<_ReplySheet> createState() => _ReplySheetState();
}

class _ReplySheetState extends State<_ReplySheet> {
  late final _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Herkese açık cevap', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text('Cevabınız profilinizde yorumun altında görünür. Boş bırakırsanız cevap kaldırılır.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          const SizedBox(height: 12),
          TextField(controller: _controller, autofocus: true, maxLines: 5, minLines: 3, maxLength: 1000, textCapitalization: TextCapitalization.sentences),
          const SizedBox(height: 8),
          FilledButton(onPressed: () => Navigator.pop(context, _controller.text.trim()), child: const Text('Kaydet')),
        ],
      ),
    );
  }
}
