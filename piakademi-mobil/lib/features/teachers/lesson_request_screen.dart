import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/catalog.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../shared/widgets.dart';
import 'pickers.dart';

/// Aradığı öğretmeni bulamayan veli için talep formu; ekip uygun öğretmeni bulup döner.
class LessonRequestScreen extends ConsumerStatefulWidget {
  const LessonRequestScreen({super.key, this.levelSlug, this.subjectSlug});

  final String? levelSlug;
  final String? subjectSlug;

  @override
  ConsumerState<LessonRequestScreen> createState() => _LessonRequestScreenState();
}

class _LessonRequestScreenState extends ConsumerState<LessonRequestScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _times = TextEditingController();
  final _note = TextEditingController();
  final _city = TextEditingController();
  Level? _level;
  Subject? _subject;
  String _mode = 'farketmez';
  bool _busy = false;
  ApiException? _error;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    final me = ref.read(sessionProvider).me;
    if (me != null) {
      _name.text = me.fullName;
      _phone.text = me.phone ?? '';
      _email.text = me.email ?? '';
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _times, _note, _city]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await ref.read(apiProvider).lessonRequest({
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'levelId': ?_level?.id,
        'subjectId': ?_subject?.id,
        'mode': _mode,
        if (_city.text.trim().isNotEmpty) 'cityName': _city.text.trim(),
        if (_times.text.trim().isNotEmpty) 'preferredTimes': _times.text.trim(),
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
      });
      if (!mounted) return;
      showSnack(context, message);
      context.pop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider).valueOrNull;
    if (catalog != null && !_initialized) {
      _initialized = true;
      _level = catalog.levels.where((l) => l.slug == widget.levelSlug).firstOrNull;
      _subject = catalog.subjects.where((s) => s.slug == widget.subjectSlug).firstOrNull;
    }
    final subjects = catalog == null ? <Subject>[] : catalog.subjects.where((s) => _level == null || _level!.subjectIds.contains(s.id)).toList();
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(), title: const Text('Öğretmen bulalım')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          const NoticeBox(
            tone: Tone.brand,
            icon: Icons.support_agent_rounded,
            message: 'Aradığınız öğretmeni bulamadınız mı? Ne aradığınızı yazın; ekibimiz size uygun öğretmeni bulup en kısa sürede dönsün.',
          ),
          if (_error != null && _error!.fields.isEmpty) ...[const SizedBox(height: 12), NoticeBox(tone: Tone.rose, message: _error!.message)],
          const SizedBox(height: 16),
          TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: 'Adınız', errorText: _error?.field('name'))),
          const SizedBox(height: 12),
          TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: 'Cep telefonu', hintText: '05XX XXX XX XX', errorText: _error?.field('phone'))),
          const SizedBox(height: 12),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: 'E-posta (isteğe bağlı)', errorText: _error?.field('email'))),
          const SizedBox(height: 12),
          PickerField(
            label: 'Kademe',
            value: _level?.name,
            icon: Icons.school_outlined,
            onTap: catalog == null
                ? null
                : () async {
                    final picked = await pickOption<Level>(context, title: 'Kademe', options: catalog.levels, labelOf: (l) => l.name, allowClear: true, clearLabel: 'Belirtmek istemiyorum');
                    if (picked != null) {
                      setState(() {
                        _level = picked.value;
                        if (_subject != null && _level != null && !_level!.subjectIds.contains(_subject!.id)) _subject = null;
                      });
                    }
                  },
          ),
          const SizedBox(height: 12),
          PickerField(
            label: 'Ders',
            value: _subject?.name,
            icon: Icons.menu_book_rounded,
            onTap: catalog == null
                ? null
                : () async {
                    final picked = await pickOption<Subject>(context, title: 'Ders', options: subjects, labelOf: (s) => s.name, allowClear: true, clearLabel: 'Belirtmek istemiyorum');
                    if (picked != null) setState(() => _subject = picked.value);
                  },
          ),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'online', label: Text('Online')),
              ButtonSegment(value: 'yuz-yuze', label: Text('Yüz yüze')),
              ButtonSegment(value: 'farketmez', label: Text('Fark etmez')),
            ],
            selected: {_mode},
            onSelectionChanged: (s) => setState(() => _mode = s.first),
          ),
          if (_mode != 'online') ...[
            const SizedBox(height: 12),
            TextField(controller: _city, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'İl / ilçe')),
          ],
          const SizedBox(height: 12),
          TextField(controller: _times, decoration: const InputDecoration(labelText: 'Uygun gün ve saatler', hintText: 'Örn: Hafta içi akşam, cumartesi öğleden sonra')),
          const SizedBox(height: 12),
          TextField(controller: _note, maxLines: 3, maxLength: 1000, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Not (isteğe bağlı)')),
          const SizedBox(height: 12),
          BusyButton(busy: _busy, onPressed: _submit, label: 'Talebimi gönder', icon: Icons.send_rounded),
        ],
      ),
    );
  }
}
