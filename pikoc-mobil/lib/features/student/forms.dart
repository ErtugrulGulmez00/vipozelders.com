import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/session.dart';

/// Alttan açılan form kabı (klavye açılınca yukarı kayar).
Future<bool?> showFormSheet(BuildContext context, Widget child) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    builder: (context) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 24), child: child),
    ),
  );
}

int? _int(TextEditingController c) => int.tryParse(c.text.trim());

/// Bugün / dün / 2 gün önce seçimi (ileri tarih girilemez)
class DayChoice extends StatelessWidget {
  const DayChoice({super.key, required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final today = todayYmd();
    final days = [today, addDays(today, -1), addDays(today, -2)];
    const labels = ['Bugün', 'Dün', '2 gün önce'];
    return Wrap(
      spacing: 8,
      children: [
        for (var i = 0; i < days.length; i++) ChoiceChip(label: Text(labels[i]), selected: value == days[i], onSelected: (_) => onChanged(days[i])),
      ],
    );
  }
}

class SubjectField extends StatelessWidget {
  const SubjectField({super.key, required this.subjects, required this.value, required this.onChanged, this.allowEmpty = false});

  final List<String> subjects;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool allowEmpty;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Ders'),
      items: [
        if (allowEmpty) const DropdownMenuItem(value: '', child: Text('Genel')),
        for (final s in subjects) DropdownMenuItem(value: s, child: Text(s)),
      ],
      onChanged: onChanged,
    );
  }
}

/// Soru girişi: ders, çözülen, doğru, yanlış.
class QuestionLogForm extends StatefulWidget {
  const QuestionLogForm({super.key, required this.linkId, required this.subjects});

  final String linkId;
  final List<String> subjects;

  @override
  State<QuestionLogForm> createState() => _QuestionLogFormState();
}

class _QuestionLogFormState extends State<QuestionLogForm> {
  String _date = todayYmd();
  String? _subject;
  final _solved = TextEditingController();
  final _correct = TextEditingController();
  final _wrong = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _save() async {
    final solved = _int(_solved), correct = _int(_correct) ?? 0, wrong = _int(_wrong) ?? 0;
    if (_subject == null || solved == null || solved < 1) {
      setState(() => _error = 'Dersi seçin ve çözdüğünüz soru sayısını yazın.');
      return;
    }
    if (correct + wrong > solved) {
      setState(() => _error = 'Doğru + yanlış, çözülen sorudan fazla olamaz.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).api.post('/koc/ogrenci/${widget.linkId}/soru', {'date': _date, 'subject': _subject, 'solved': solved, 'correct': correct, 'wrong': wrong});
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final digits = [FilteringTextInputFormatter.digitsOnly];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Çözdüğün soruyu gir', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        DayChoice(value: _date, onChanged: (d) => setState(() => _date = d)),
        const SizedBox(height: 12),
        SubjectField(subjects: widget.subjects, value: _subject, onChanged: (v) => setState(() => _subject = v)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: TextField(key: const Key('q-solved'), controller: _solved, keyboardType: TextInputType.number, inputFormatters: digits, decoration: const InputDecoration(labelText: 'Çözülen'))),
          const SizedBox(width: 10),
          Expanded(child: TextField(key: const Key('q-correct'), controller: _correct, keyboardType: TextInputType.number, inputFormatters: digits, decoration: const InputDecoration(labelText: 'Doğru'))),
          const SizedBox(width: 10),
          Expanded(child: TextField(key: const Key('q-wrong'), controller: _wrong, keyboardType: TextInputType.number, inputFormatters: digits, decoration: const InputDecoration(labelText: 'Yanlış'))),
        ]),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        const SizedBox(height: 16),
        FilledButton(key: const Key('q-save'), onPressed: _busy ? null : _save, child: Text(_busy ? 'Kaydediliyor…' : 'Kaydet')),
      ],
    );
  }
}

/// Elle çalışma süresi girişi (sayaç kullanılmadıysa).
class StudyForm extends StatefulWidget {
  const StudyForm({super.key, required this.linkId, required this.subjects, this.minutes, this.subject});

  final String linkId;
  final List<String> subjects;
  final int? minutes;
  final String? subject;

  @override
  State<StudyForm> createState() => _StudyFormState();
}

class _StudyFormState extends State<StudyForm> {
  String _date = todayYmd();
  late String _subject = widget.subject ?? '';
  late final _minutes = TextEditingController(text: widget.minutes?.toString() ?? '');
  bool _busy = false;
  String? _error;

  Future<void> _save() async {
    final minutes = _int(_minutes);
    if (minutes == null || minutes < 1 || minutes > 720) {
      setState(() => _error = 'Süre 1 ile 720 dakika arasında olmalı.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).api.post('/koc/ogrenci/${widget.linkId}/calisma', {'date': _date, 'subject': _subject.isEmpty ? null : _subject, 'minutes': minutes});
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.minutes != null ? 'Çalışmayı kaydet' : 'Çalışma süresi gir', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        if (widget.minutes == null) ...[DayChoice(value: _date, onChanged: (d) => setState(() => _date = d)), const SizedBox(height: 12)],
        SubjectField(subjects: widget.subjects, value: _subject, allowEmpty: true, onChanged: (v) => setState(() => _subject = v ?? '')),
        const SizedBox(height: 12),
        TextField(controller: _minutes, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'Süre (dakika)')),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Kaydediliyor…' : 'Kaydet')),
      ],
    );
  }
}

/// Deneme sonucu: sınav türü, ad, tarih, bölüm bölüm doğru/yanlış.
class ExamForm extends StatefulWidget {
  const ExamForm({super.key, required this.linkId, required this.kinds});

  final String linkId;
  final List<Json> kinds;

  @override
  State<ExamForm> createState() => _ExamFormState();
}

class _ExamFormState extends State<ExamForm> {
  late Json _kind = widget.kinds.firstWhere((k) => k.str('kind') == 'TYT', orElse: () => widget.kinds.first);
  final _name = TextEditingController();
  String _date = todayYmd();
  final Map<String, (TextEditingController, TextEditingController)> _rows = {};
  bool _busy = false;
  String? _error;

  (TextEditingController, TextEditingController) _row(String section) => _rows.putIfAbsent('${_kind.str('kind')}:$section', () => (TextEditingController(), TextEditingController()));

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: parseDay(_date), firstDate: DateTime.now().subtract(const Duration(days: 365)), lastDate: DateTime.now());
    if (picked != null) setState(() => _date = ymd(picked));
  }

  Future<void> _save() async {
    final sections = _kind.list('sections');
    final values = <Map<String, int>>[];
    for (final s in sections) {
      final (c, w) = _row(s.str('name'));
      final correct = _int(c) ?? 0, wrong = _int(w) ?? 0;
      if (correct + wrong > s.integer('questionCount')) {
        setState(() => _error = '${s.str('name')}: doğru + yanlış ${s.integer('questionCount')} soruyu geçemez.');
        return;
      }
      values.add({'correct': correct, 'wrong': wrong});
    }
    if (_name.text.trim().length < 2) {
      setState(() => _error = 'Deneme adını yazın (ör. 3D Yayınları TYT 4).');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.read(context).api.post('/koc/ogrenci/${widget.linkId}/deneme', {'kind': _kind.str('kind'), 'name': _name.text.trim(), 'date': _date, 'sections': values});
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final digits = [FilteringTextInputFormatter.digitsOnly];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Deneme sonucumu gir', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 4, children: [
          for (final k in widget.kinds) ChoiceChip(label: Text(k.str('label')), selected: k.str('kind') == _kind.str('kind'), onSelected: (_) => setState(() => _kind = k)),
        ]),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Deneme adı', hintText: 'ör. 3D Yayınları TYT 4')),
        const SizedBox(height: 8),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.event_outlined), title: Text(longDay(_date)), trailing: const Text('Değiştir'), onTap: _pickDate),
        for (final s in _kind.list('sections'))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(flex: 3, child: Text('${s.str('name')} (${s.integer('questionCount')})', style: const TextStyle(fontWeight: FontWeight.w600))),
              Expanded(flex: 2, child: TextField(controller: _row(s.str('name')).$1, keyboardType: TextInputType.number, inputFormatters: digits, decoration: const InputDecoration(labelText: 'Doğru', isDense: true))),
              const SizedBox(width: 8),
              Expanded(flex: 2, child: TextField(controller: _row(s.str('name')).$2, keyboardType: TextInputType.number, inputFormatters: digits, decoration: const InputDecoration(labelText: 'Yanlış', isDense: true))),
            ]),
          ),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
        const SizedBox(height: 12),
        FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Kaydediliyor…' : 'Sonucu kaydet')),
      ],
    );
  }
}
