import 'package:flutter/material.dart';

import '../../core/format/text.dart';

/// Seçim sonucu: [value] null ise "temizle" seçildi.
class Picked<T> {
  const Picked(this.value);

  final T? value;
}

/// Liste içinden seçim (il, ilçe, kademe, ders). Uzun listelerde arama kutusu vardır.
Future<Picked<T>?> pickOption<T>(
  BuildContext context, {
  required String title,
  required List<T> options,
  required String Function(T) labelOf,
  bool allowClear = false,
  bool searchable = false,
  String clearLabel = 'Tümü',
}) {
  return showModalBottomSheet<Picked<T>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _PickerSheet<T>(
      title: title,
      options: options,
      labelOf: labelOf,
      allowClear: allowClear,
      searchable: searchable || options.length > 12,
      clearLabel: clearLabel,
    ),
  );
}

class _PickerSheet<T> extends StatefulWidget {
  const _PickerSheet({required this.title, required this.options, required this.labelOf, required this.allowClear, required this.searchable, required this.clearLabel});

  final String title;
  final List<T> options;
  final String Function(T) labelOf;
  final bool allowClear;
  final bool searchable;
  final String clearLabel;

  @override
  State<_PickerSheet<T>> createState() => _PickerSheetState<T>();
}

class _PickerSheetState<T> extends State<_PickerSheet<T>> {
  String _filter = '';

  @override
  Widget build(BuildContext context) {
    final key = searchKey(_filter);
    final options = key.isEmpty ? widget.options : widget.options.where((o) => searchKey(widget.labelOf(o)).contains(key)).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: widget.options.length > 8 ? 0.85 : 0.5,
      maxChildSize: 0.95,
      builder: (context, controller) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Align(alignment: Alignment.centerLeft, child: Text(widget.title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800))),
          ),
          if (widget.searchable)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                autofocus: false,
                onChanged: (v) => setState(() => _filter = v),
                decoration: const InputDecoration(hintText: 'Ara', prefixIcon: Icon(Icons.search_rounded), isDense: true),
              ),
            ),
          Expanded(
            child: ListView(
              controller: controller,
              children: [
                if (widget.allowClear && key.isEmpty)
                  ListTile(
                    leading: const Icon(Icons.clear_all_rounded),
                    title: Text(widget.clearLabel),
                    onTap: () => Navigator.pop(context, Picked<T>(null)),
                  ),
                for (final option in options)
                  ListTile(
                    title: Text(widget.labelOf(option)),
                    onTap: () => Navigator.pop(context, Picked<T>(option)),
                  ),
                if (options.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Sonuç yok'))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Açılır seçim alanı görünümünde düğme.
class PickerField extends StatelessWidget {
  const PickerField({super.key, required this.label, this.value, this.onTap, this.icon, this.errorText});

  final String label;
  final String? value;
  final VoidCallback? onTap;
  final IconData? icon;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: InputDecorator(
        isEmpty: value == null,
        decoration: InputDecoration(
          prefixIcon: icon == null ? null : Icon(icon),
          suffixIcon: const Icon(Icons.expand_more_rounded),
          errorText: errorText,
          enabled: onTap != null,
        ),
        child: Text(
          value ?? label,
          style: TextStyle(fontSize: 15, color: value == null ? scheme.onSurfaceVariant : scheme.onSurface, fontWeight: value == null ? FontWeight.w400 : FontWeight.w600),
        ),
      ),
    );
  }
}
