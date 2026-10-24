import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/booking.dart';
import '../../core/models/center.dart';
import '../../core/models/messages.dart';
import '../../core/models/pool.dart';
import '../../core/models/teacher.dart';
import '../../core/models/teacher_panel.dart';
import '../../core/providers.dart';

// Ekranların paylaştığı veri sağlayıcıları. Kullanıcıya özel olanlar oturumdaki kullanıcıyı izler;
// çıkış yapılınca kendiliğinden sıfırlanır.

/// Ders listeleri ve ayrıntıları bir işlemden sonra (iptal, ödeme, onay) yenilensin diye artırılır.
final bookingsRevisionProvider = StateProvider<int>((ref) => 0);

void bumpBookings(WidgetRef ref) => ref.read(bookingsRevisionProvider.notifier).state++;

final bookingDetailProvider = FutureProvider.autoDispose.family<BookingDetail, String>((ref, id) {
  ref.watch(currentUserIdProvider);
  ref.watch(bookingsRevisionProvider);
  return ref.watch(apiProvider).booking(id);
});

final teacherProfileProvider = FutureProvider.autoDispose.family<TeacherProfile, String>((ref, slug) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).teacher(slug);
});

/// Velinin kuruma bağlı öğrencileri (öğretmen ve misafirde boş).
final centerLinksProvider = FutureProvider<List<CenterLink>>((ref) async {
  final session = ref.watch(sessionProvider);
  if (!session.isStudent) return const [];
  return ref.watch(apiProvider).centerLinks();
});

final centerChildProvider = FutureProvider.autoDispose.family<CenterChild, String>((ref, id) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).centerChild(id);
});

final reportCardProvider = FutureProvider.autoDispose.family<ReportCard, (String, String)>((ref, args) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).reportCard(args.$1, args.$2);
});

final studyWeekProvider = FutureProvider.autoDispose.family<StudyWeek, (String, String?)>((ref, args) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).study(args.$1, week: args.$2);
});

final favoritesProvider = FutureProvider.autoDispose<List<FavoriteTeacher>>((ref) async {
  final session = ref.watch(sessionProvider);
  if (!session.isStudent) return const [];
  return ref.watch(apiProvider).favorites();
});

final teacherSummaryProvider = FutureProvider.autoDispose<TeacherSummary>((ref) {
  ref.watch(currentUserIdProvider);
  ref.watch(bookingsRevisionProvider);
  return ref.watch(apiProvider).teacherSummary();
});

final earningsProvider = FutureProvider.autoDispose<Earnings>((ref) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).earnings();
});

final teacherCalendarProvider = FutureProvider.autoDispose<TeacherCalendar>((ref) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).teacherCalendar();
});

final teacherReviewsProvider = FutureProvider.autoDispose<List<Review>>((ref) {
  ref.watch(currentUserIdProvider);
  return ref.watch(apiProvider).teacherReviews();
});

// ---------------------------------------------------------------- soru kredisi, soru havuzu, mesajlar

/// Soru ve kredi ekranları bir işlemden sonra (gönderme, satın alma, çözüm) yenilensin diye artırılır.
final questionsRevisionProvider = StateProvider<int>((ref) => 0);

void bumpQuestions(WidgetRef ref) {
  ref.read(questionsRevisionProvider.notifier).state++;
  ref.read(sessionProvider.notifier).refreshMe();
}

final creditsProvider = FutureProvider.autoDispose<Credits>((ref) {
  ref.watch(currentUserIdProvider);
  ref.watch(questionsRevisionProvider);
  return ref.watch(apiProvider).credits();
});

final myQuestionProvider = FutureProvider.autoDispose.family<PoolQuestion, String>((ref, id) {
  ref.watch(currentUserIdProvider);
  ref.watch(questionsRevisionProvider);
  return ref.watch(apiProvider).myQuestion(id);
});

final teacherPoolProvider = FutureProvider.autoDispose<TeacherPool>((ref) {
  ref.watch(currentUserIdProvider);
  ref.watch(questionsRevisionProvider);
  return ref.watch(apiProvider).teacherPool();
});

final poolQuestionProvider = FutureProvider.autoDispose.family<PoolQuestion, String>((ref, id) {
  ref.watch(currentUserIdProvider);
  ref.watch(questionsRevisionProvider);
  return ref.watch(apiProvider).poolQuestion(id);
});

/// Mesaj listesi ve konuşmalar bir gönderimden sonra yenilensin diye artırılır.
final messagesRevisionProvider = StateProvider<int>((ref) => 0);

void bumpMessages(WidgetRef ref) {
  ref.read(messagesRevisionProvider.notifier).state++;
  ref.read(sessionProvider.notifier).refreshMe();
}

final threadsProvider = FutureProvider.autoDispose<List<ThreadSummary>>((ref) async {
  ref.watch(currentUserIdProvider);
  ref.watch(messagesRevisionProvider);
  return (await ref.watch(apiProvider).threads()).$1;
});
