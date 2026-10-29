import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/sides.dart';
import '../../core/providers.dart';
import '../shared/data.dart';

class _Destination {
  const _Destination(this.branch, this.label, this.icon, this.selectedIcon, {this.badge = 0});

  final int branch;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final int badge;
}

class _ShellScaffold extends StatelessWidget {
  const _ShellScaffold({required this.shell, required this.destinations});

  final StatefulNavigationShell shell;
  final List<_Destination> destinations;

  @override
  Widget build(BuildContext context) {
    var selected = destinations.indexWhere((d) => d.branch == shell.currentIndex);
    if (selected < 0) selected = 0;
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (index) {
          final branch = destinations[index].branch;
          shell.goBranch(branch, initialLocation: branch == shell.currentIndex);
        },
        destinations: [
          for (final d in destinations)
            NavigationDestination(
              icon: Badge(isLabelVisible: d.badge > 0, label: Text('${d.badge}'), child: Icon(d.icon)),
              selectedIcon: Badge(isLabelVisible: d.badge > 0, label: Text('${d.badge}'), child: Icon(d.selectedIcon)),
              label: d.label,
              tooltip: d.label,
            ),
        ],
      ),
    );
  }
}

/// Özel ders tarafı: veli / öğrenci (ve misafir) alt menüsü. Kurum portalı ayrı tarafta (PortalShell).
class StudentShell extends ConsumerWidget {
  const StudentShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    return _ShellScaffold(
      shell: shell,
      destinations: [
        const _Destination(0, 'Keşfet', Icons.explore_outlined, Icons.explore_rounded),
        const _Destination(1, 'Derslerim', Icons.event_note_outlined, Icons.event_note_rounded),
        const _Destination(2, 'Favoriler', Icons.favorite_border_rounded, Icons.favorite_rounded),
        _Destination(3, session.isSignedIn ? 'Hesabım' : 'Giriş', Icons.person_outline_rounded, Icons.person_rounded),
      ],
    );
  }
}

/// Kurum tarafı: veli / öğrenci portalı alt menüsü (sitedeki /hesabim/kurum).
class PortalShell extends ConsumerWidget {
  const PortalShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final unread = session.me == null ? 0 : unreadFor(session.me!, session.view);
    return _ShellScaffold(
      shell: shell,
      destinations: [
        const _Destination(0, 'Kurumum', Icons.school_outlined, Icons.school_rounded),
        _Destination(1, 'Bildirimler', Icons.notifications_none_rounded, Icons.notifications_rounded, badge: unread),
        const _Destination(2, 'Hesap', Icons.person_outline_rounded, Icons.person_rounded),
      ],
    );
  }
}

/// Öğretmen alt menüsü.
class TeacherShell extends ConsumerWidget {
  const TeacherShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(teacherSummaryProvider).valueOrNull?.pendingRequests.length ?? 0;
    return _ShellScaffold(
      shell: shell,
      destinations: [
        const _Destination(0, 'Özet', Icons.space_dashboard_outlined, Icons.space_dashboard_rounded),
        _Destination(1, 'Talepler', Icons.inbox_outlined, Icons.inbox_rounded, badge: pending),
        const _Destination(2, 'Derslerim', Icons.event_note_outlined, Icons.event_note_rounded),
        const _Destination(3, 'Takvim', Icons.calendar_month_outlined, Icons.calendar_month_rounded),
        const _Destination(4, 'Hesap', Icons.person_outline_rounded, Icons.person_rounded),
      ],
    );
  }
}
