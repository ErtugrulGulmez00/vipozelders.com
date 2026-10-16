import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_exception.dart';

void showSnack(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(error ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, color: error ? const Color(0xFFFB7185) : const Color(0xFF34D399), size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        duration: Duration(seconds: error ? 5 : 3),
      ),
    );
}

void showError(BuildContext context, Object error) => showSnack(context, errorMessage(error), error: true);

Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  String confirmText = 'Evet',
  String cancelText = 'Vazgeç',
  bool destructive = false,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (context) {
      final scheme = Theme.of(context).colorScheme;
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(cancelText)),
          FilledButton(
            style: destructive ? FilledButton.styleFrom(backgroundColor: scheme.error, minimumSize: const Size(64, 44)) : FilledButton.styleFrom(minimumSize: const Size(64, 44)),
            onPressed: () => Navigator.pop(context, true),
            child: Text(confirmText),
          ),
        ],
      );
    },
  );
  return result ?? false;
}

/// Gerekçe isteyen pencere (iptal, red, sorun bildirimi). Hazır seçenekler verilebilir.
Future<String?> reasonDialog(
  BuildContext context, {
  required String title,
  String? message,
  required String confirmText,
  String hint = 'Gerekçenizi yazın',
  int minLength = 3,
  List<String> presets = const [],
  bool destructive = false,
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _ReasonSheet(
      title: title,
      message: message,
      confirmText: confirmText,
      hint: hint,
      minLength: minLength,
      presets: presets,
      destructive: destructive,
    ),
  );
}

class _ReasonSheet extends StatefulWidget {
  const _ReasonSheet({required this.title, this.message, required this.confirmText, required this.hint, required this.minLength, required this.presets, required this.destructive});

  final String title;
  final String? message;
  final String confirmText;
  final String hint;
  final int minLength;
  final List<String> presets;
  final bool destructive;

  @override
  State<_ReasonSheet> createState() => _ReasonSheetState();
}

class _ReasonSheetState extends State<_ReasonSheet> {
  final _controller = TextEditingController();
  String? _preset;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _needsText => widget.presets.isEmpty || _preset == widget.presets.last;

  void _submit() {
    final text = _needsText ? _controller.text.trim() : _preset!;
    if (!_needsText && _preset == null) {
      setState(() => _error = 'Bir seçenek seçin.');
      return;
    }
    if (text.length < widget.minLength) {
      setState(() => _error = 'En az ${widget.minLength} karakter yazın.');
      return;
    }
    Navigator.pop(context, text);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.title, style: Theme.of(context).textTheme.titleLarge),
          if (widget.message != null) ...[
            const SizedBox(height: 8),
            Text(widget.message!, style: TextStyle(color: scheme.onSurfaceVariant, height: 1.4)),
          ],
          const SizedBox(height: 16),
          if (widget.presets.isNotEmpty)
            RadioGroup<String>(
              groupValue: _preset,
              onChanged: (value) => setState(() {
                _preset = value;
                _error = null;
              }),
              child: Column(
                children: [
                  for (final preset in widget.presets)
                    RadioListTile<String>(
                      value: preset,
                      title: Text(preset),
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                    ),
                ],
              ),
            ),
          if (_needsText)
            TextField(
              controller: _controller,
              autofocus: widget.presets.isEmpty,
              maxLines: 4,
              minLines: 2,
              maxLength: 300,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(hintText: widget.hint),
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
            ),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(_error!, style: TextStyle(color: scheme.error))),
          const SizedBox(height: 8),
          FilledButton(
            style: widget.destructive ? FilledButton.styleFrom(backgroundColor: scheme.error) : null,
            onPressed: _submit,
            child: Text(widget.confirmText),
          ),
          const SizedBox(height: 6),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
        ],
      ),
    );
  }
}

/// Dış bağlantı (tarayıcı, telefon, e-posta, YouTube).
Future<void> openExternal(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return;
  try {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) showSnack(context, 'Bağlantı açılamadı.', error: true);
  } catch (_) {
    if (context.mounted) showSnack(context, 'Bağlantı açılamadı.', error: true);
  }
}

/// Yükleme sürerken düğmeyi kilitleyen yardımcı.
class BusyButton extends StatelessWidget {
  const BusyButton({super.key, required this.busy, required this.onPressed, required this.label, this.icon, this.outlined = false, this.destructive = false});

  final bool busy;
  final VoidCallback? onPressed;
  final String label;
  final IconData? icon;
  final bool outlined;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final child = busy
        ? SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: outlined ? scheme.primary : Colors.white))
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 20), const SizedBox(width: 8)],
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
            ],
          );
    if (outlined) {
      return OutlinedButton(
        style: destructive ? OutlinedButton.styleFrom(foregroundColor: scheme.error, side: BorderSide(color: scheme.error.withValues(alpha: 0.5))) : null,
        onPressed: busy ? null : onPressed,
        child: child,
      );
    }
    return FilledButton(
      style: destructive ? FilledButton.styleFrom(backgroundColor: scheme.error) : null,
      onPressed: busy ? null : onPressed,
      child: child,
    );
  }
}
