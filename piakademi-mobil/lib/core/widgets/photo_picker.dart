import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/pi_api.dart';
import 'feedback.dart';

/// Seçilen fotoğraf/video: önizleme baytları ve yükleme bilgisi.
class PickedMedia {
  const PickedMedia({required this.file, required this.preview, required this.isVideo, required this.sizeBytes});

  final UploadFile file;
  final Uint8List? preview;
  final bool isVideo;
  final int sizeBytes;
}

const _imageMaxBytes = 8 * 1024 * 1024;
const _videoMaxBytes = 25 * 1024 * 1024;

/// Kamera ya da galeriden fotoğraf (JPEG'e dönüştürülür; sunucu JPG/PNG/WEBP kabul eder).
Future<PickedMedia?> pickPhoto(BuildContext context, {String title = 'Fotoğraf ekle'}) async {
  final source = await _chooseSource(context, title: title, video: false);
  if (source == null) return null;
  try {
    final file = await ImagePicker().pickImage(source: source, imageQuality: 82, maxWidth: 2200, maxHeight: 2200);
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    if (bytes.length > _imageMaxBytes) {
      if (context.mounted) showSnack(context, 'Fotoğraf en fazla 8 MB olabilir.', error: true);
      return null;
    }
    final name = file.name.toLowerCase().endsWith('.png') ? file.name : 'soru-${DateTime.now().millisecondsSinceEpoch}.jpg';
    return PickedMedia(
      file: UploadFile(name: name, bytes: bytes, mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg'),
      preview: bytes,
      isVideo: false,
      sizeBytes: bytes.length,
    );
  } catch (_) {
    if (context.mounted) showSnack(context, 'Fotoğraf alınamadı. Kamera/galeri iznini kontrol edin.', error: true);
    return null;
  }
}

/// Öğretmenin çözüm videosu (en fazla 25 MB).
Future<PickedMedia?> pickVideo(BuildContext context) async {
  final source = await _chooseSource(context, title: 'Çözüm videosu', video: true);
  if (source == null) return null;
  try {
    final file = await ImagePicker().pickVideo(source: source, maxDuration: const Duration(minutes: 10));
    if (file == null) return null;
    final size = await file.length();
    if (size > _videoMaxBytes) {
      if (context.mounted) showSnack(context, 'Video en fazla 25 MB olabilir. Daha kısa bir kayıt deneyin.', error: true);
      return null;
    }
    final lower = file.name.toLowerCase();
    final mime = lower.endsWith('.mov') ? 'video/quicktime' : (lower.endsWith('.webm') ? 'video/webm' : 'video/mp4');
    final bytes = await file.readAsBytes();
    return PickedMedia(file: UploadFile(name: file.name, bytes: bytes, mimeType: mime), preview: null, isVideo: true, sizeBytes: size);
  } catch (_) {
    if (context.mounted) showSnack(context, 'Video alınamadı. Kamera/galeri iznini kontrol edin.', error: true);
    return null;
  }
}

Future<ImageSource?> _chooseSource(BuildContext context, {required String title, required bool video}) {
  return showModalBottomSheet<ImageSource>(
    context: context,
    useSafeArea: true,
    builder: (context) => Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
        ListTile(
          leading: Icon(video ? Icons.videocam_rounded : Icons.photo_camera_rounded),
          title: Text(video ? 'Kamerayla kaydet' : 'Kamerayla çek'),
          onTap: () => Navigator.pop(context, ImageSource.camera),
        ),
        ListTile(
          leading: Icon(video ? Icons.video_library_rounded : Icons.photo_library_rounded),
          title: const Text('Galeriden seç'),
          onTap: () => Navigator.pop(context, ImageSource.gallery),
        ),
        const SizedBox(height: 12),
      ],
    ),
  );
}

/// Seçilen fotoğrafın önizlemesi (kaldır düğmesiyle).
class MediaPreview extends StatelessWidget {
  const MediaPreview({super.key, required this.media, required this.onRemove, this.height = 200});

  final PickedMedia media;
  final VoidCallback onRemove;
  final double height;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: media.isVideo ? 72 : height,
            width: double.infinity,
            color: scheme.surfaceContainer,
            child: media.isVideo || media.preview == null
                ? Row(
                    children: [
                      const SizedBox(width: 16),
                      Icon(Icons.movie_rounded, color: scheme.primary),
                      const SizedBox(width: 10),
                      Expanded(child: Text('${media.file.name} · ${(media.sizeBytes / 1024 / 1024).toStringAsFixed(1)} MB', overflow: TextOverflow.ellipsis)),
                      const SizedBox(width: 48),
                    ],
                  )
                : Image.memory(media.preview!, fit: BoxFit.contain),
          ),
        ),
        Positioned(
          top: 6,
          right: 6,
          child: IconButton.filledTonal(tooltip: 'Kaldır', onPressed: onRemove, icon: const Icon(Icons.close_rounded)),
        ),
      ],
    );
  }
}
