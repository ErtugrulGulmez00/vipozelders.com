import 'package:flutter/material.dart';

import '../lessons/lessons_screen.dart';
import '../shared/widgets.dart';

/// Öğretmen: Derslerim (yaklaşan · geçmiş).
class TeacherLessonsScreen extends StatelessWidget {
  const TeacherLessonsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Derslerim'),
          actions: const [NotificationBell()],
          bottom: const TabBar(tabs: [Tab(text: 'Yaklaşan'), Tab(text: 'Geçmiş')]),
        ),
        body: const TabBarView(
          children: [
            BookingList(scope: 'yaklasan', emptyTitle: 'Yaklaşan onaylı ders yok', emptyMessage: 'Onayladığınız dersler burada görünür.', teacherView: true),
            BookingList(scope: 'gecmis', emptyTitle: 'Geçmiş ders yok', teacherView: true),
          ],
        ),
      ),
    );
  }
}
