import 'package:flutter/material.dart';

import 'pi_logo.dart';

/// Ekran genişliği eşikleri: yan menü (tablet, yatay telefon) ve iki bölmeli düzen (geniş tablet).
abstract final class Breakpoints {
  static const rail = 600.0;
  static const twoPane = 900.0;

  /// Uygulamanın kendi ekranlarında içerik en fazla bu genişlikte, ortada
  static const readable = 760.0;

  static bool useRail(BuildContext context) => MediaQuery.sizeOf(context).width >= rail;
  static bool useTwoPane(BuildContext context) => MediaQuery.sizeOf(context).width >= twoPane;
}

/// İçeriği okunur genişlikte ortalar (telefonda etkisizdir).
class Readable extends StatelessWidget {
  const Readable({super.key, required this.child, this.maxWidth = Breakpoints.readable});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

class NavItem {
  const NavItem({required this.icon, required this.selectedIcon, required this.label});

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Ana ekran iskeleti: telefonda alt sekme çubuğu, geniş ekranda soldaki yan menü.
class AppNavScaffold extends StatelessWidget {
  const AppNavScaffold({super.key, required this.selectedIndex, required this.onSelect, required this.items, required this.body, this.appBar, this.floatingActionButton});

  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final List<NavItem> items;
  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    if (!Breakpoints.useRail(context)) {
      return Scaffold(
        appBar: appBar,
        floatingActionButton: floatingActionButton,
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: onSelect,
          destinations: [for (final i in items) NavigationDestination(icon: Icon(i.icon), selectedIcon: Icon(i.selectedIcon), label: i.label)],
        ),
      );
    }
    final theme = Theme.of(context);
    return Scaffold(
      floatingActionButton: floatingActionButton,
      body: Row(
        children: [
          ColoredBox(
            color: theme.colorScheme.surface,
            child: SafeArea(
              right: false,
              child: NavigationRail(
                selectedIndex: selectedIndex,
                onDestinationSelected: onSelect,
                labelType: NavigationRailLabelType.all,
                backgroundColor: theme.colorScheme.surface,
                groupAlignment: -0.9,
                leading: const Padding(padding: EdgeInsets.only(top: 8, bottom: 16), child: PiBadge(size: 40)),
                destinations: [for (final i in items) NavigationRailDestination(icon: Icon(i.icon), selectedIcon: Icon(i.selectedIcon), label: Text(i.label))],
              ),
            ),
          ),
          VerticalDivider(width: 1, thickness: 1, color: theme.colorScheme.outlineVariant),
          Expanded(
            child: Scaffold(appBar: appBar, body: body),
          ),
        ],
      ),
    );
  }
}
