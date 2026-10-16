import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../providers.dart';

/// Oturum gerektiren dosyalar (soru fotoğrafı, çözüm) Bearer anahtarıyla indirilir.
class AuthImage extends ConsumerWidget {
  const AuthImage({super.key, required this.url, this.height = 220, this.fit = BoxFit.contain, this.zoomable = true, this.semanticLabel});

  final String url;
  final double height;
  final BoxFit fit;
  final bool zoomable;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final headers = ref.watch(apiClientProvider).authHeaders;
    final scheme = Theme.of(context).colorScheme;
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: height,
        width: double.infinity,
        color: scheme.surfaceContainer,
        child: CachedNetworkImage(
          imageUrl: url,
          httpHeaders: headers,
          cacheKey: url,
          fit: fit,
          placeholder: (_, _) => const Center(child: CircularProgressIndicator(strokeWidth: 2.5)),
          errorWidget: (_, _, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.broken_image_outlined, color: scheme.onSurfaceVariant),
                const SizedBox(height: 4),
                Text('Fotoğraf yüklenemedi', style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
    if (!zoomable) return Semantics(label: semanticLabel, image: true, child: image);
    return Semantics(
      label: semanticLabel,
      image: true,
      button: true,
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => ImageViewer(url: url, headers: headers)),
        ),
        child: Stack(
          children: [
            image,
            Positioned(
              right: 8,
              bottom: 8,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.zoom_in_rounded, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tam ekran, yakınlaştırılabilir fotoğraf.
class ImageViewer extends StatelessWidget {
  const ImageViewer({super.key, required this.url, this.headers = const {}});

  final String url;
  final Map<String, String> headers;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white, title: const Text('Fotoğraf')),
      body: InteractiveViewer(
        minScale: 1,
        maxScale: 6,
        child: Center(
          child: CachedNetworkImage(
            imageUrl: url,
            httpHeaders: headers,
            cacheKey: url,
            fit: BoxFit.contain,
            placeholder: (_, _) => const CircularProgressIndicator(color: Colors.white),
            errorWidget: (_, _, _) => const Icon(Icons.broken_image_outlined, color: Colors.white54, size: 48),
          ),
        ),
      ),
    );
  }
}

/// Çözüm videosu (Bearer anahtarıyla akış).
class AuthVideo extends ConsumerStatefulWidget {
  const AuthVideo({super.key, required this.url});

  final String url;

  @override
  ConsumerState<AuthVideo> createState() => _AuthVideoState();
}

class _AuthVideoState extends ConsumerState<AuthVideo> {
  VideoPlayerController? _controller;
  bool _failed = false;
  bool _started = false;

  Future<void> _start() async {
    setState(() => _started = true);
    final controller = VideoPlayerController.networkUrl(Uri.parse(widget.url), httpHeaders: ref.read(apiClientProvider).authHeaders);
    _controller = controller;
    try {
      await controller.initialize();
      await controller.play();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        color: Colors.black,
        constraints: const BoxConstraints(minHeight: 180),
        child: !_started
            ? SizedBox(
                height: 200,
                child: Center(
                  child: FilledButton.tonalIcon(onPressed: _start, icon: const Icon(Icons.play_arrow_rounded), label: const Text('Çözüm videosunu oynat')),
                ),
              )
            : _failed
                ? const SizedBox(height: 180, child: Center(child: Text('Video oynatılamadı.', style: TextStyle(color: Colors.white70))))
                : controller == null || !controller.value.isInitialized
                    ? const SizedBox(height: 200, child: Center(child: CircularProgressIndicator(color: Colors.white)))
                    : AspectRatio(
                        aspectRatio: controller.value.aspectRatio == 0 ? 16 / 9 : controller.value.aspectRatio,
                        child: Stack(
                          alignment: Alignment.bottomCenter,
                          children: [
                            VideoPlayer(controller),
                            _Controls(controller: controller),
                            VideoProgressIndicator(controller, allowScrubbing: true, padding: const EdgeInsets.all(6)),
                          ],
                        ),
                      ),
      ),
    );
  }
}

class _Controls extends StatefulWidget {
  const _Controls({required this.controller});

  final VideoPlayerController controller;

  @override
  State<_Controls> createState() => _ControlsState();
}

class _ControlsState extends State<_Controls> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_update);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_update);
    super.dispose();
  }

  void _update() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final playing = widget.controller.value.isPlaying;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => playing ? widget.controller.pause() : widget.controller.play(),
      child: Center(
        child: AnimatedOpacity(
          opacity: playing ? 0 : 1,
          duration: const Duration(milliseconds: 200),
          child: Container(
            decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.4), shape: BoxShape.circle),
            padding: const EdgeInsets.all(10),
            child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 40),
          ),
        ),
      ),
    );
  }
}
