import 'package:flutter/material.dart';

import 'pi_logo.dart';
import 'theme.dart';

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
        bottomNavigationBar: _FloatingNavBar(selectedIndex: selectedIndex, onSelect: onSelect, items: items),
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

/// Telefonda alttaki lacivert, yuvarlak köşeli menü; seçili sekme mercan.
class _FloatingNavBar extends StatelessWidget {
  const _FloatingNavBar({required this.selectedIndex, required this.onSelect, required this.items});

  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final List<NavItem> items;

  @override
  Widget build(BuildContext context) {
    // Az sekmede simge + yazı yan yana; çok sekmede simge üstte, yazı altta
    final compact = items.length > 3;
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Container(
          height: compact ? 66 : 64,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: Brand.ink900,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [BoxShadow(color: Brand.ink900.withValues(alpha: 0.18), blurRadius: 24, offset: const Offset(0, 8))],
          ),
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: Semantics(
                    selected: i == selectedIndex,
                    button: true,
                    label: items[i].label,
                    excludeSemantics: true,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Material(
                        color: i == selectedIndex ? Brand.b600 : Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        child: InkWell(
                          key: Key('nav-$i'),
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => onSelect(i),
                          child: SizedBox(
                            height: 50,
                            child: compact
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(i == selectedIndex ? items[i].selectedIcon : items[i].icon, size: 21, color: i == selectedIndex ? Colors.white : Brand.ink200),
                                      const SizedBox(height: 2),
                                      Text(
                                        items[i].label,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: i == selectedIndex ? Colors.white : Brand.ink200),
                                      ),
                                    ],
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(i == selectedIndex ? items[i].selectedIcon : items[i].icon, size: 21, color: i == selectedIndex ? Colors.white : Brand.ink200),
                                      const SizedBox(width: 8),
                                      Flexible(
                                        child: Text(
                                          items[i].label,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: i == selectedIndex ? Colors.white : Brand.ink200),
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
