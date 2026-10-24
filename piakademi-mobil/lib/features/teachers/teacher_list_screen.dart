import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/catalog.dart';
import '../../core/models/teacher.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/states.dart';
import '../shared/widgets.dart';
import 'teacher_filters_sheet.dart';

class TeacherListScreen extends ConsumerStatefulWidget {
  const TeacherListScreen({super.key, this.initial = const TeacherQuery(), this.autofocus = false});

  final TeacherQuery initial;
  final bool autofocus;

  @override
  ConsumerState<TeacherListScreen> createState() => _TeacherListScreenState();
}

class _TeacherListScreenState extends ConsumerState<TeacherListScreen> {
  late TeacherQuery _query = widget.initial;
  late final _search = TextEditingController(text: widget.initial.q ?? '');
  Timer? _debounce;
  int? _total;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (!mounted) return;
      setState(() {
        _query = _query.copyWith(q: value.trim().isEmpty ? null : value.trim());
        _total = null;
      });
    });
  }

  void _apply(TeacherQuery query) {
    setState(() {
      _query = query;
      _total = null;
    });
  }

  Future<void> _openFilters(Catalog catalog) async {
    final result = await showModalBottomSheet<TeacherQuery>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => TeacherFiltersSheet(catalog: catalog, query: _query),
    );
    if (result != null) _apply(result);
  }

  Future<void> _openSort(Catalog catalog) async {
    final value = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      builder: (context) => RadioGroup<String>(
        groupValue: _query.sort ?? 'onerilen',
        onChanged: (value) => Navigator.pop(context, value),
        child: ListView(
          shrinkWrap: true,
          children: [
            const Padding(padding: EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text('Sıralama', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
            for (final option in catalog.sortOptions) RadioListTile<String>(value: option.value, title: Text(option.label)),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
    if (value != null) _apply(_query.copyWith(sort: value == 'onerilen' ? null : value));
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider);
    final api = ref.watch(apiProvider);
    final scheme = Theme.of(context).colorScheme;
    final filters = _query.activeFilters;

    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(),
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: TextField(
            controller: _search,
            autofocus: widget.autofocus,
            textInputAction: TextInputAction.search,
            onChanged: _onSearchChanged,
            onSubmitted: (value) {
              _debounce?.cancel();
              _apply(_query.copyWith(q: value.trim().isEmpty ? null : value.trim()));
            },
            decoration: InputDecoration(
              hintText: 'Öğretmen, ders ya da konu ara',
              prefixIcon: const Icon(Icons.search_rounded),
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Temizle',
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () {
                        _search.clear();
                        _apply(_query.copyWith(q: null));
                      },
                    ),
            ),
          ),
        ),
      ),
      body: catalog.when(
        loading: () => const LoadingView(),
        error: (error, _) => ErrorView(error: error, onRetry: () => ref.invalidate(catalogProvider)),
        data: (catalog) {
          final sortLabel = catalog.sortOptions.where((o) => o.value == (_query.sort ?? 'onerilen')).map((o) => o.label).firstOrNull ?? 'Önerilen';
          final level = catalog.levelBySlug(_query.level);
          final service = catalog.serviceBySlug(_query.service);
          return Column(
            children: [
              const MaintenanceBanner(),
              SizedBox(
                height: 52,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  children: [
                    ActionChip(
                      avatar: Badge(isLabelVisible: filters > 0, label: Text('$filters'), child: const Icon(Icons.tune_rounded, size: 18)),
                      label: const Text('Filtreler'),
                      onPressed: () => _openFilters(catalog),
                    ),
                    const SizedBox(width: 8),
                    ActionChip(avatar: const Icon(Icons.sort_rounded, size: 18), label: Text(sortLabel), onPressed: () => _openSort(catalog)),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Online'),
                      selected: _query.mode == 'online',
                      onSelected: (v) => _apply(_query.copyWith(mode: v ? 'online' : null)),
                    ),
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Yüz yüze'),
                      selected: _query.mode == 'yuz-yuze',
                      onSelected: (v) => _apply(_query.copyWith(mode: v ? 'yuz-yuze' : null)),
                    ),
                    if (level != null) ...[
                      const SizedBox(width: 8),
                      InputChip(label: Text(level.name), onDeleted: () => _apply(_query.copyWith(level: null, subject: null))),
                    ],
                    if (service != null) ...[
                      const SizedBox(width: 8),
                      InputChip(label: Text(service.name), onDeleted: () => _apply(_query.copyWith(service: null))),
                    ],
                    const SizedBox(width: 8),
                    FilterChip(
                      label: const Text('Onaylı'),
                      selected: _query.verified,
                      onSelected: (v) => _apply(_query.copyWith(verified: v)),
                    ),
                  ],
                ),
              ),
              if (_total != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 2, 20, 6),
                  child: Row(
                    children: [
                      Text('$_total öğretmen', style: TextStyle(fontWeight: FontWeight.w700, color: scheme.onSurfaceVariant)),
                      const Spacer(),
                      if (filters > 0)
                        TextButton(onPressed: () => _apply(_query.clearFilters()), child: const Text('Filtreleri temizle')),
                    ],
                  ),
                ),
              Expanded(
                child: PagedListView<TeacherCard>(
                  key: ValueKey(_query),
                  load: (page) async {
                    final result = await api.teachers(_query, page: page);
                    if (page == 1 && mounted) setState(() => _total = result.total);
                    return (result.items, result.hasMore ? page + 1 : null);
                  },
                  itemBuilder: (context, teacher) => TeacherTile(teacher: teacher),
                  empty: EmptyView(
                    icon: Icons.person_search_rounded,
                    title: 'Aradığınız ölçütlere uygun öğretmen bulunamadı',
                    message: 'Filtreleri azaltmayı deneyin ya da ne aradığınızı bize yazın; ekibimiz size uygun öğretmeni bulsun.',
                    action: Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        FilledButton.icon(
                          onPressed: () => context.push(Uri(path: Routes.lessonRequest, queryParameters: {'kademe': ?_query.level, 'ders': ?_query.subject}).toString()),
                          icon: const Icon(Icons.support_agent_rounded),
                          label: const Text('Öğretmen bulun'),
                        ),
                        if (filters > 0 || (_query.q?.isNotEmpty ?? false))
                          OutlinedButton(
                            onPressed: () {
                              _search.clear();
                              _apply(const TeacherQuery());
                            },
                            child: const Text('Tüm öğretmenleri göster'),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
