import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/pi_api.dart';
import '../../core/format/money.dart';
import '../../core/models/catalog.dart';
import '../../core/providers.dart';
import 'pickers.dart';

final districtsProvider = FutureProvider.autoDispose.family<List<District>, int>((ref, cityId) => ref.watch(apiProvider).districts(cityId));

/// Öğretmen arama filtreleri (sitedeki filtre paneliyle aynı).
class TeacherFiltersSheet extends ConsumerStatefulWidget {
  const TeacherFiltersSheet({super.key, required this.catalog, required this.query});

  final Catalog catalog;
  final TeacherQuery query;

  @override
  ConsumerState<TeacherFiltersSheet> createState() => _TeacherFiltersSheetState();
}

class _TeacherFiltersSheetState extends ConsumerState<TeacherFiltersSheet> {
  late TeacherQuery _q = widget.query;
  late final _min = TextEditingController(text: widget.query.minPrice?.toString() ?? '');
  late final _max = TextEditingController(text: widget.query.maxPrice?.toString() ?? '');

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  void _done() {
    Navigator.pop(context, _q.copyWith(minPrice: parseLira(_min.text), maxPrice: parseLira(_max.text)));
  }

  @override
  Widget build(BuildContext context) {
    final catalog = widget.catalog;
    final level = catalog.levelBySlug(_q.level);
    final subjects = catalog.subjectsFor(level);
    final city = catalog.cityBySlug(_q.city);
    final scheme = Theme.of(context).colorScheme;

    Widget label(String text) => Padding(
          padding: const EdgeInsets.only(top: 18, bottom: 8),
          child: Text(text, style: Theme.of(context).textTheme.titleSmall),
        );

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.92,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 8, 4),
            child: Row(
              children: [
                const Expanded(child: Text('Filtreler', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
                TextButton(
                  onPressed: () {
                    _min.clear();
                    _max.clear();
                    setState(() => _q = _q.clearFilters());
                  },
                  child: const Text('Temizle'),
                ),
              ],
            ),
          ),
          const Divider(),
          Expanded(
            child: ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                label('Kademe'),
                PickerField(
                  label: 'Tüm kademeler',
                  value: level?.name,
                  onTap: () async {
                    final picked = await pickOption<Level>(context, title: 'Kademe', options: catalog.levels, labelOf: (l) => l.name, allowClear: true);
                    if (picked == null) return;
                    setState(() => _q = _q.copyWith(level: picked.value?.slug, subject: null));
                  },
                ),
                label('Ders'),
                PickerField(
                  label: 'Tüm dersler',
                  value: catalog.subjectBySlug(_q.subject)?.name,
                  onTap: () async {
                    final picked = await pickOption(context, title: 'Ders', options: subjects, labelOf: (s) => s.name, allowClear: true, searchable: true);
                    if (picked == null) return;
                    setState(() => _q = _q.copyWith(subject: picked.value?.slug));
                  },
                ),
                label('Hizmet'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final service in catalog.services)
                      ChoiceChip(
                        label: Text(service.name),
                        selected: _q.service == service.slug,
                        onSelected: (v) => setState(() => _q = _q.copyWith(service: v ? service.slug : null)),
                      ),
                  ],
                ),
                label('Ders şekli'),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(label: const Text('Online'), selected: _q.mode == 'online', onSelected: (v) => setState(() => _q = _q.copyWith(mode: v ? 'online' : null))),
                    ChoiceChip(label: const Text('Yüz yüze'), selected: _q.mode == 'yuz-yuze', onSelected: (v) => setState(() => _q = _q.copyWith(mode: v ? 'yuz-yuze' : null))),
                  ],
                ),
                label('Konum'),
                PickerField(
                  label: 'Tüm iller',
                  value: city?.name,
                  icon: Icons.location_city_rounded,
                  onTap: () async {
                    final picked = await pickOption<City>(context, title: 'İl', options: catalog.cities, labelOf: (c) => c.name, allowClear: true, searchable: true);
                    if (picked == null) return;
                    setState(() => _q = _q.copyWith(city: picked.value?.slug, district: null));
                  },
                ),
                if (city != null) ...[
                  const SizedBox(height: 10),
                  _DistrictPicker(
                    cityId: city.id,
                    value: _q.district,
                    onChanged: (slug) => setState(() => _q = _q.copyWith(district: slug)),
                  ),
                ],
                label('Saatlik ücret (TL)'),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _min,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'En az', prefixText: '₺ '),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 10), child: Text('—')),
                    Expanded(
                      child: TextField(
                        controller: _max,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'En çok', prefixText: '₺ '),
                      ),
                    ),
                  ],
                ),
                label('Puan'),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      showCheckmark: false,
                      avatar: const Icon(Icons.star_rounded, size: 18, color: Color(0xFFFBBF24)),
                      label: const Text('4 ve üzeri'),
                      selected: _q.rating == 4,
                      onSelected: (v) => setState(() => _q = _q.copyWith(rating: v ? 4 : null)),
                    ),
                  ],
                ),
                label('Öğretmen'),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(label: const Text('Kadın'), selected: _q.gender == 'kadin', onSelected: (v) => setState(() => _q = _q.copyWith(gender: v ? 'kadin' : null))),
                    ChoiceChip(label: const Text('Erkek'), selected: _q.gender == 'erkek', onSelected: (v) => setState(() => _q = _q.copyWith(gender: v ? 'erkek' : null))),
                  ],
                ),
                label('Müsaitlik'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final option in catalog.timeOptions)
                      ChoiceChip(
                        label: Text(option.label),
                        selected: _q.time == option.value,
                        onSelected: (v) => setState(() => _q = _q.copyWith(time: v ? option.value : null)),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _q.verified,
                  onChanged: (v) => setState(() => _q = _q.copyWith(verified: v)),
                  title: const Text('Yalnızca onaylı öğretmenler'),
                  subtitle: Text('Kimlik ve diploması kontrol edilenler', style: TextStyle(color: scheme.onSurfaceVariant)),
                ),
                if (catalog.rules.subscriptionsEnabled)
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _q.subscription,
                    onChanged: (v) => setState(() => _q = _q.copyWith(subscription: v)),
                    title: const Text('Aylık soru aboneliği verenler'),
                    subtitle: Text('Her gün kendi öğretmeninize soru gönderin', style: TextStyle(color: scheme.onSurfaceVariant)),
                  ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: SizedBox(width: double.infinity, child: FilledButton(onPressed: _done, child: const Text('Sonuçları göster'))),
            ),
          ),
        ],
      ),
    );
  }
}

class _DistrictPicker extends ConsumerWidget {
  const _DistrictPicker({required this.cityId, required this.value, required this.onChanged});

  final int cityId;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final districts = ref.watch(districtsProvider(cityId));
    final current = districts.valueOrNull?.where((d) => d.slug == value).firstOrNull;
    return PickerField(
      label: districts.isLoading ? 'İlçeler yükleniyor…' : 'Tüm ilçeler',
      value: current?.name,
      icon: Icons.place_outlined,
      onTap: districts.hasValue
          ? () async {
              final picked = await pickOption<District>(context, title: 'İlçe', options: districts.value!, labelOf: (d) => d.name, allowClear: true, searchable: true);
              if (picked != null) onChanged(picked.value?.slug);
            }
          : null,
    );
  }
}
