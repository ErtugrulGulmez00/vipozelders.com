import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/booking.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Veli/öğrenci: Derslerim (yaklaşan · geçmiş · iptal).
class LessonsScreen extends ConsumerWidget {
  const LessonsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('Derslerim')),
        body: const SignInPrompt(
          title: 'Derslerinizi görmek için giriş yapın',
          message: 'Randevularınız, ödemeleriniz, sanal sınıf girişi ve fotoğrafla sorduğunuz sorular burada.',
          next: Routes.lessons,
        ),
      );
    }
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Derslerim'),
          actions: const [NotificationBell()],
          bottom: const TabBar(tabs: [Tab(text: 'Yaklaşan'), Tab(text: 'Geçmiş'), Tab(text: 'İptal')]),
        ),
        body: const TabBarView(
          children: [
            BookingList(scope: 'yaklasan', emptyTitle: 'Yaklaşan dersiniz yok', emptyMessage: 'Bir öğretmen seçip uygun saatten randevu alabilirsiniz.', showFindButton: true),
            BookingList(scope: 'gecmis', emptyTitle: 'Geçmiş ders yok'),
            BookingList(scope: 'iptal', emptyTitle: 'İptal edilen ders yok'),
          ],
        ),
      ),
    );
  }
}

/// Kapsama göre sayfalı ders listesi (öğretmen ekranları da kullanır).
class BookingList extends ConsumerWidget {
  const BookingList({super.key, required this.scope, required this.emptyTitle, this.emptyMessage, this.teacherView = false, this.showFindButton = false});

  final String scope;
  final String emptyTitle;
  final String? emptyMessage;
  final bool teacherView;
  final bool showFindButton;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final revision = ref.watch(bookingsRevisionProvider);
    final api = ref.watch(apiProvider);
    return PagedListView<BookingSummary>(
      key: ValueKey('$scope-$revision'),
      load: (page) async {
        final result = await api.bookings(scope, page: page);
        return (result.items, result.nextPage);
      },
      itemBuilder: (context, booking) => BookingTile(booking: booking, teacherView: teacherView),
      empty: EmptyView(
        icon: Icons.event_note_outlined,
        title: emptyTitle,
        message: emptyMessage,
        action: showFindButton ? FilledButton(onPressed: () => context.push(Routes.teachers), child: const Text('Öğretmen bul')) : null,
      ),
    );
  }
}
