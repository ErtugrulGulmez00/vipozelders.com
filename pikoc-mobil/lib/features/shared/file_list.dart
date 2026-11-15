import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/file_download.dart';
import '../../core/format.dart';

/// Paylaşılan dosyalar: tür simgesi, başlık, ders · boyut · tarih, not; dokununca indirilip açılır.
class SharedFileList extends StatelessWidget {
  const SharedFileList({super.key, required this.files});

  final List<Json> files;

  static ({IconData icon, Color color, String label}) _kind(String fileName) {
    final ext = fileName.split('.').last.toLowerCase();
    return switch (ext) {
      'docx' => (icon: Icons.description_rounded, color: const Color(0xFF0369A1), label: 'Word'),
      'xlsx' => (icon: Icons.table_chart_rounded, color: const Color(0xFF047857), label: 'Excel'),
      'pptx' => (icon: Icons.slideshow_rounded, color: const Color(0xFFC2410C), label: 'PowerPoint'),
      'jpg' || 'jpeg' || 'png' || 'webp' => (icon: Icons.image_rounded, color: const Color(0xFF6D28D9), label: 'Görsel'),
      _ => (icon: Icons.picture_as_pdf_rounded, color: const Color(0xFFE11D48), label: 'PDF'),
    };
  }

  static String _size(int bytes) => bytes < 1024 * 1024 ? '${(bytes / 1024).ceil()} KB' : '${(bytes / 1024 / 1024).toStringAsFixed(1).replaceAll('.', ',')} MB';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        for (final f in files)
          InkWell(
            key: Key('file-${f.str('id')}'),
            borderRadius: BorderRadius.circular(14),
            onTap: () => openRemoteFile(context, f.str('downloadUrl'), fileName: f.str('fileName')),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(children: [
                Builder(builder: (context) {
                  final kind = _kind(f.str('fileName'));
                  return Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: kind.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
                    child: Icon(kind.icon, color: kind.color),
                  );
                }),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(f.str('title'), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      [f.strOrNull('subject'), _kind(f.str('fileName')).label, _size(f.integer('size')), shortDate(f.str('createdAt').substring(0, 10))].whereType<String>().where((s) => s.isNotEmpty).join(' · '),
                      style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                    ),
                    if ((f.strOrNull('note') ?? '').isNotEmpty) Text(f.str('note'), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                  ]),
                ),
                const SizedBox(width: 8),
                Icon(Icons.download_rounded, color: scheme.primary),
              ]),
            ),
          ),
      ],
    );
  }
}
