import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/format/dates.dart';
import '../../core/models/messages.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/avatar.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

const _rulesText = 'Güvenliğiniz için telefon, e-posta ve sosyal medya bilgileri otomatik gizlenir. Ödeme ve dersler yalnızca Pi Kampüs üzerinden yapılır.';

/// Sohbet ekranı. [threadId] ile var olan konuşma açılır; [teacherSlug] verilirse (yeni konuşma)
/// ilk mesaj öğretmene gönderilince konuşma oluşur.
class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({super.key, this.threadId, this.teacherSlug, this.teacherName});

  final String? threadId;
  final String? teacherSlug;
  final String? teacherName;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  MessageThread? _thread;
  Object? _error;
  bool _loading = true;
  bool _sending = false;
  final _input = TextEditingController();
  final _scroll = ScrollController();
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    if (widget.threadId != null) {
      _load();
      // Karşı tarafın cevabı için ekran açıkken 15 saniyede bir yenilenir.
      _poll = Timer.periodic(const Duration(seconds: 15), (_) => _load(silent: true));
    } else {
      _loading = false;
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    final id = _thread?.id ?? widget.threadId;
    if (id == null) return;
    try {
      final thread = await ref.read(apiProvider).thread(id);
      if (!mounted) return;
      final grew = (thread.messages.length) != (_thread?.messages.length ?? -1);
      setState(() {
        _thread = thread;
        _error = null;
        _loading = false;
      });
      if (!silent || grew) bumpMessages(ref);
      if (grew) _toBottom();
    } catch (error) {
      if (!mounted || silent) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  void _toBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.length < 2) return;
    setState(() => _sending = true);
    try {
      final api = ref.read(apiProvider);
      final id = _thread?.id ?? widget.threadId;
      final thread = id == null ? await api.messageTeacher(widget.teacherSlug!, text) : await api.sendMessage(id, text);
      if (!mounted) return;
      _input.clear();
      setState(() => _thread = thread);
      bumpMessages(ref);
      _toBottom();
      if (thread.lastMasked) showSnack(context, 'Mesajınızdaki iletişim bilgileri gizlendi.');
      _poll ??= Timer.periodic(const Duration(seconds: 15), (_) => _load(silent: true));
    } on ApiException catch (error) {
      if (mounted) showError(context, error);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final peer = _thread?.counterpart;
    final name = peer?.name ?? widget.teacherName ?? 'Mesaj';
    return Scaffold(
      appBar: AppBar(
        leading: const AppBackButton(fallback: Routes.messages),
        titleSpacing: 0,
        title: InkWell(
          onTap: peer?.teacherSlug == null ? null : () => context.push(Routes.teacher(peer!.teacherSlug!)),
          child: Row(
            children: [
              Avatar(name: name, photoUrl: peer?.photoUrl, size: 36),
              const SizedBox(width: 10),
              Flexible(child: Text(name, overflow: TextOverflow.ellipsis)),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                    ? ErrorView(error: _error!, onRetry: _load)
                    : ListView(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                        children: [
                          const NoticeBox(tone: Tone.sky, icon: Icons.shield_outlined, message: _rulesText),
                          const SizedBox(height: 12),
                          if ((_thread?.messages ?? const []).isEmpty)
                            Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                'Öğretmene dersle ilgili sorunuzu yazın: hedefiniz, seviyeniz, uygun olduğunuz saatler…',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: scheme.onSurfaceVariant),
                              ),
                            ),
                          for (final m in _thread?.messages ?? const <DirectMessage>[]) _Bubble(message: m),
                        ],
                      ),
          ),
          SafeArea(
            top: false,
            child: Container(
              decoration: BoxDecoration(color: scheme.surface, border: Border(top: BorderSide(color: scheme.outlineVariant))),
              padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _input,
                      minLines: 1,
                      maxLines: 5,
                      maxLength: 2000,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(hintText: 'Mesajınızı yazın', counterText: '', isDense: true),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    tooltip: 'Gönder',
                    onPressed: _sending || (_error != null && _thread == null && widget.teacherSlug == null) ? null : _send,
                    icon: _sending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final DirectMessage message;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final mine = message.mine;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
          decoration: BoxDecoration(
            color: mine ? scheme.primary : scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(mine ? 16 : 4),
              bottomRight: Radius.circular(mine ? 4 : 16),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              SelectableText(message.body, style: TextStyle(color: mine ? scheme.onPrimary : scheme.onSurface, height: 1.35)),
              const SizedBox(height: 2),
              Text(
                [formatCompact(message.createdAt), if (message.masked) 'iletişim bilgisi gizlendi'].join(' · '),
                style: TextStyle(fontSize: 11, color: (mine ? scheme.onPrimary : scheme.onSurfaceVariant).withValues(alpha: 0.8)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
