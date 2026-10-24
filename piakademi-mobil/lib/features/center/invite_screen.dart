import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import '../../core/router/app_router.dart';
import '../../core/widgets/states.dart';
import '../shared/data.dart';
import '../shared/widgets.dart';

/// Davet bağlantısının son kısmı (kod): "https://pikampus.com/kurum-davet/ABC" → "ABC".
String? inviteTokenFrom(String input) {
  final text = input.trim();
  if (text.isEmpty) return null;
  final match = RegExp(r'kurum-davet/([A-Za-z0-9_\-]+)').firstMatch(text);
  if (match != null) return match.group(1);
  if (RegExp(r'^[A-Za-z0-9_\-]{10,200}$').hasMatch(text)) return text;
  return null;
}

/// Davet bağlantısını ya da kodu elle girme penceresi.
Future<void> showInviteCodeSheet(BuildContext context) async {
  final token = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => const _InviteSheet(),
  );
  if (token != null && context.mounted) context.push(Routes.centerInvite(token));
}

class _InviteSheet extends StatefulWidget {
  const _InviteSheet();

  @override
  State<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends State<_InviteSheet> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final token = inviteTokenFrom(_controller.text);
    if (token == null) {
      setState(() => _error = 'Geçerli bir davet bağlantısı ya da kodu yapıştırın.');
      return;
    }
    Navigator.pop(context, token);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Öğrenci bağla', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            'Kurumunuzun SMS, e-posta ya da WhatsApp ile gönderdiği veli portalı davet bağlantısını yapıştırın.',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            autofocus: true,
            autocorrect: false,
            maxLines: 2,
            minLines: 1,
            decoration: InputDecoration(labelText: 'Davet bağlantısı ya da kodu', hintText: 'https://…/kurum-davet/…', errorText: _error),
            onSubmitted: (_) => _submit(),
          ),
          const SizedBox(height: 14),
          FilledButton(onPressed: _submit, child: const Text('Bağlan')),
        ],
      ),
    );
  }
}

/// Davet bağlantısı açıldığında (uygulama içi ya da sitedeki bağlantı) öğrenciyi hesaba bağlar.
class InviteScreen extends ConsumerStatefulWidget {
  const InviteScreen({super.key, required this.token});

  final String token;

  @override
  ConsumerState<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends ConsumerState<InviteScreen> {
  ApiException? _error;
  bool _teacher = false;

  @override
  void initState() {
    super.initState();
    _accept();
  }

  Future<void> _accept() async {
    final session = ref.read(sessionProvider);
    if (session.isTeacher) {
      setState(() => _teacher = true);
      return;
    }
    setState(() => _error = null);
    try {
      final id = await ref.read(apiProvider).acceptInvite(widget.token);
      ref.invalidate(centerLinksProvider);
      if (!mounted) return;
      context.pushReplacement(Routes.centerChild(id));
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const AppBackButton(fallback: Routes.center), title: const Text('Kurum daveti')),
      body: _teacher
          ? const EmptyView(
              icon: Icons.person_off_outlined,
              title: 'Davet veli/öğrenci hesabıyla kabul edilir',
              message: 'Öğretmen hesabından çıkış yapıp veli hesabınızla giriş yapın.',
            )
          : _error != null
              ? EmptyView(
                  icon: Icons.link_off_rounded,
                  title: 'Davet kabul edilemedi',
                  message: _error!.message,
                  action: Column(
                    children: [
                      if (_error!.isOffline) OutlinedButton(onPressed: _accept, child: const Text('Tekrar dene')),
                      TextButton(onPressed: () => context.go(Routes.center), child: const Text('Kurumum')),
                    ],
                  ),
                )
              : const LoadingView(message: 'Öğrenci hesabınıza bağlanıyor…'),
    );
  }
}
