import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import 'forms.dart';

/// Çalışma sayacı: başlangıç zamanı cihazda saklanır; uygulama kapansa ya da telefon kilitlense de süre işler.
class StudyTimer extends StatefulWidget {
  const StudyTimer({super.key, required this.linkId, required this.studentId, required this.subjects, required this.onSaved});

  final String linkId;
  final String studentId;
  final List<String> subjects;
  final VoidCallback onSaved;

  @override
  State<StudyTimer> createState() => _StudyTimerState();
}

class _StudyTimerState extends State<StudyTimer> {
  // Saklanan: biriken süre (ms) ve çalışıyorsa başlangıç anı
  int _accumulated = 0;
  int? _startedAt;
  Timer? _tick;

  String get _key => 'pikoc-sayac-${widget.studentId}';

  @override
  void initState() {
    super.initState();
    _load();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_startedAt != null && mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final parts = prefs.getString(_key)?.split('|');
    if (parts == null || parts.length != 2) return;
    setState(() {
      _accumulated = int.tryParse(parts[0]) ?? 0;
      _startedAt = int.tryParse(parts[1]);
    });
  }

  Future<void> _store() async {
    final prefs = await SharedPreferences.getInstance();
    if (_accumulated == 0 && _startedAt == null) {
      await prefs.remove(_key);
    } else {
      await prefs.setString(_key, '$_accumulated|${_startedAt ?? ''}');
    }
  }

  Duration get _elapsed => Duration(milliseconds: _accumulated + (_startedAt == null ? 0 : DateTime.now().millisecondsSinceEpoch - _startedAt!));

  void _start() {
    setState(() => _startedAt = DateTime.now().millisecondsSinceEpoch);
    _store();
  }

  void _pause() {
    setState(() {
      _accumulated = _elapsed.inMilliseconds;
      _startedAt = null;
    });
    _store();
  }

  void _reset() {
    setState(() {
      _accumulated = 0;
      _startedAt = null;
    });
    _store();
  }

  Future<void> _save() async {
    _pause();
    final minutes = _elapsed.inMinutes.clamp(1, 720);
    final saved = await showFormSheet(context, StudyForm(linkId: widget.linkId, subjects: widget.subjects, minutes: minutes));
    if (saved == true) {
      _reset();
      widget.onSaved();
    }
  }

  @override
  Widget build(BuildContext context) {
    final running = _startedAt != null;
    final hasTime = _elapsed.inSeconds > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Text(
            clock(_elapsed),
            style: TextStyle(fontFamily: AppTheme.displayFamily, fontSize: 44, fontWeight: FontWeight.w800, color: running ? Brand.b600 : null, fontFeatures: const [FontFeature.tabularFigures()]),
          ),
        ),
        const SizedBox(height: 4),
        Center(child: Text(running ? 'Sayaç çalışıyor; uygulamadan çıksan da devam eder.' : hasTime ? 'Duraklatıldı' : 'Çalışmaya başlarken başlat.', style: Theme.of(context).textTheme.bodySmall)),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: running
                ? FilledButton.tonalIcon(onPressed: _pause, icon: const Icon(Icons.pause_rounded), label: const Text('Duraklat'))
                : FilledButton.icon(key: const Key('timer-start'), onPressed: _start, icon: const Icon(Icons.play_arrow_rounded), label: Text(hasTime ? 'Devam et' : 'Başlat')),
          ),
          if (hasTime) ...[
            const SizedBox(width: 8),
            Expanded(child: FilledButton.icon(onPressed: _save, icon: const Icon(Icons.check_rounded), label: const Text('Bitir ve kaydet'))),
          ],
        ]),
        if (hasTime && !running) TextButton(onPressed: _reset, child: const Text('Sıfırla')),
      ],
    );
  }
}
