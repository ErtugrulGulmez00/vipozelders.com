import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_background/flutter_background.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart' show Helper;
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/api.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../core/widgets.dart';

/// Koç görüşmesi: sitedeki sanal sınıfla aynı LiveKit odası (koc-<öğrenci>). Uygulama odaya kendisi bağlanır;
/// sitedeki koç/öğrenciyle aynı odada görüşülür. Android'de ekran paylaşımı da yapılabilir.
class MeetingScreen extends StatefulWidget {
  const MeetingScreen({super.key, required this.studentId});

  final String studentId;

  @override
  State<MeetingScreen> createState() => _MeetingScreenState();
}

class _MeetingScreenState extends State<MeetingScreen> {
  Room? _room;
  EventsListener<RoomEvent>? _listener;
  String _title = 'Koç görüşmesi';
  String? _error;
  bool _connecting = true;
  bool _backCamera = false;
  int? _endsAt;
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _connect());
  }

  Future<void> _connect() async {
    setState(() {
      _connecting = true;
      _error = null;
    });
    final api = SessionScope.read(context).api;
    try {
      final statuses = await [Permission.camera, Permission.microphone].request();
      final micOk = statuses[Permission.microphone]?.isGranted ?? false;
      final camOk = statuses[Permission.camera]?.isGranted ?? false;
      final res = await api.post('/koc/gorusme/${widget.studentId}');
      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
          defaultCameraCaptureOptions: CameraCaptureOptions(params: VideoParametersPresets.h720_169),
          defaultVideoPublishOptions: VideoPublishOptions(videoEncoding: VideoEncoding(maxBitrate: 1200000, maxFramerate: 24)),
          defaultScreenShareCaptureOptions: ScreenShareCaptureOptions(useiOSBroadcastExtension: false, params: VideoParametersPresets.screenShareH720FPS15),
        ),
      );
      _listener = room.createListener()
        ..on<RoomDisconnectedEvent>((_) {
          if (mounted) Navigator.of(context).maybePop();
        });
      room.addListener(_changed);
      await room.connect(res.str('serverUrl'), res.str('token'));
      _room = room;
      if (camOk) await room.localParticipant?.setCameraEnabled(true);
      if (micOk) await room.localParticipant?.setMicrophoneEnabled(true);
      await WakelockPlus.enable();
      _endsAt = res.intOrNull('endsAt');
      _clock = Timer.periodic(const Duration(seconds: 30), (_) => mounted ? setState(() {}) : null);
      if (!mounted) return;
      setState(() {
        _title = res.str('title', 'Koç görüşmesi');
        _connecting = false;
      });
      if (!micOk || !camOk) showMessage(context, 'Kamera ya da mikrofon izni verilmedi; telefon ayarlarından izin verebilirsiniz.', error: true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _connecting = false;
          _error = e is ApiException ? e.message : 'Görüşmeye bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
        });
      }
    }
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _clock?.cancel();
    _listener?.dispose();
    final room = _room;
    if (room != null) {
      room.removeListener(_changed);
      room.disconnect().whenComplete(room.dispose);
    }
    WakelockPlus.disable();
    if (Platform.isAndroid && FlutterBackground.isBackgroundExecutionEnabled) FlutterBackground.disableBackgroundExecution();
    super.dispose();
  }

  LocalParticipant? get _me => _room?.localParticipant;

  Future<void> _toggleMic() async => _me?.setMicrophoneEnabled(!(_me?.isMicrophoneEnabled() ?? false));
  Future<void> _toggleCam() async => _me?.setCameraEnabled(!(_me?.isCameraEnabled() ?? false));

  Future<void> _flipCamera() async {
    final pub = _me?.videoTrackPublications.where((p) => p.source == TrackSource.camera).firstOrNull;
    final track = pub?.track;
    if (track == null) return;
    try {
      await track.setCameraPosition(_backCamera ? CameraPosition.front : CameraPosition.back);
      setState(() => _backCamera = !_backCamera);
    } catch (_) {
      if (mounted) showMessage(context, 'Kamera değiştirilemedi.', error: true);
    }
  }

  /// Android: ekran paylaşımı için önce sistem izni (MediaProjection), sonra ön plan hizmeti.
  Future<void> _toggleScreen() async {
    final me = _me;
    if (me == null) return;
    if (me.isScreenShareEnabled()) {
      await me.setScreenShareEnabled(false);
      if (FlutterBackground.isBackgroundExecutionEnabled) await FlutterBackground.disableBackgroundExecution();
      return;
    }
    try {
      if (!await Helper.requestCapturePermission()) return;
      final ok = await FlutterBackground.initialize(
        androidConfig: const FlutterBackgroundAndroidConfig(
          notificationTitle: 'Pi Koç ekran paylaşımı',
          notificationText: 'Ekranınız görüşmede paylaşılıyor.',
          notificationImportance: AndroidNotificationImportance.normal,
          notificationIcon: AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
        ),
      );
      if (ok && !FlutterBackground.isBackgroundExecutionEnabled) await FlutterBackground.enableBackgroundExecution();
      await me.setScreenShareEnabled(true, captureScreenAudio: false);
    } catch (e) {
      if (mounted) showMessage(context, 'Ekran paylaşımı başlatılamadı.', error: true);
    }
  }

  /// Gösterilecek görüntüler: önce paylaşılan ekran, sonra karşı taraf, en son kendi kameran.
  List<_Tile> _tiles() {
    final room = _room;
    if (room == null) return const [];
    final tiles = <_Tile>[];
    final shares = <_Tile>[];
    for (final p in room.remoteParticipants.values) {
      final name = p.name.isNotEmpty ? p.name : p.identity;
      VideoTrack? cam;
      for (final pub in p.videoTrackPublications) {
        final t = pub.track;
        if (t == null || pub.muted) continue;
        if (pub.isScreenShare) {
          shares.add(_Tile('$name · ekran', t, false, true));
        } else {
          cam = t;
        }
      }
      tiles.add(_Tile(name, cam, p.isSpeaking, false));
    }
    final me = room.localParticipant;
    if (me != null) {
      final cam = me.videoTrackPublications.where((p) => p.source == TrackSource.camera && !p.muted).firstOrNull?.track;
      tiles.add(_Tile('Sen', cam, me.isSpeaking, false, mirror: !_backCamera));
    }
    return [...shares, ...tiles];
  }

  @override
  Widget build(BuildContext context) {
    final left = _endsAt == null ? null : ((_endsAt! - DateTime.now().millisecondsSinceEpoch) / 60000).round();
    return Scaffold(
      backgroundColor: Brand.ink950,
      appBar: AppBar(
        backgroundColor: Brand.ink950,
        foregroundColor: Colors.white,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(_title, style: const TextStyle(fontSize: 16, color: Colors.white)),
          Text(_connecting ? 'Bağlanılıyor…' : left != null ? 'Kalan süre $left dakika' : '', style: const TextStyle(fontSize: 12, color: Brand.ink300)),
        ]),
      ),
      body: _error != null
          ? DefaultTextStyle(style: const TextStyle(color: Colors.white), child: ErrorView(message: _error!, onRetry: _connect))
          : _connecting
              ? const Center(child: CircularProgressIndicator(color: Colors.white))
              : _grid(),
      bottomNavigationBar: _room == null ? null : _controls(),
    );
  }

  Widget _grid() {
    final tiles = _tiles();
    final waiting = (_room?.remoteParticipants.isEmpty ?? true);
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Column(children: [
        if (waiting)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text('Karşı taraf henüz odada değil. Girince burada görünür.', style: TextStyle(color: Brand.ink200)),
          ),
        Expanded(
          child: LayoutBuilder(builder: (context, size) {
            if (tiles.isEmpty) return const SizedBox();
            final main = tiles.first;
            final rest = tiles.skip(1).toList();
            return Column(children: [
              Expanded(child: _TileView(tile: main)),
              if (rest.isNotEmpty) ...[
                const SizedBox(height: 8),
                SizedBox(
                  height: size.maxHeight * 0.28,
                  child: Row(children: [
                    for (final t in rest.take(3)) ...[Expanded(child: _TileView(tile: t)), if (t != rest.take(3).last) const SizedBox(width: 8)],
                  ]),
                ),
              ],
            ]);
          }),
        ),
      ]),
    );
  }

  Widget _controls() {
    final me = _me;
    final mic = me?.isMicrophoneEnabled() ?? false;
    final cam = me?.isCameraEnabled() ?? false;
    final screen = me?.isScreenShareEnabled() ?? false;
    Widget button(IconData icon, String label, VoidCallback onTap, {bool active = true, Color? color, Key? key}) => Expanded(
          child: InkWell(
            key: key,
            onTap: onTap,
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircleAvatar(radius: 22, backgroundColor: color ?? (active ? Brand.ink800 : Colors.white), child: Icon(icon, color: color != null || active ? Colors.white : Brand.ink900)),
                const SizedBox(height: 4),
                Text(label, style: const TextStyle(color: Brand.ink200, fontSize: 11), maxLines: 1),
              ]),
            ),
          ),
        );
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
        child: Row(children: [
          button(mic ? Icons.mic_rounded : Icons.mic_off_rounded, mic ? 'Mikrofon' : 'Sessizde', _toggleMic, active: mic),
          button(cam ? Icons.videocam_rounded : Icons.videocam_off_rounded, cam ? 'Kamera' : 'Kapalı', _toggleCam, active: cam),
          if (cam) button(Icons.cameraswitch_rounded, _backCamera ? 'Ön kamera' : 'Arka kamera', _flipCamera),
          if (Platform.isAndroid) button(Icons.screen_share_rounded, screen ? 'Durdur' : 'Ekran paylaş', _toggleScreen, color: screen ? Brand.b600 : null),
          button(Icons.call_end_rounded, 'Ayrıl', () => Navigator.of(context).maybePop(), color: const Color(0xFFE11D48), key: const Key('leave-meeting')),
        ]),
      ),
    );
  }
}

class _Tile {
  const _Tile(this.name, this.track, this.speaking, this.screen, {this.mirror = false});

  final String name;
  final VideoTrack? track;
  final bool speaking;
  final bool screen;
  final bool mirror;
}

class _TileView extends StatelessWidget {
  const _TileView({required this.tile});

  final _Tile tile;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Brand.ink900,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tile.speaking ? Brand.gold400 : Colors.transparent, width: 2),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(fit: StackFit.expand, children: [
        if (tile.track != null)
          VideoTrackRenderer(
            tile.track!,
            fit: tile.screen ? VideoViewFit.contain : VideoViewFit.cover,
            mirrorMode: tile.mirror ? VideoViewMirrorMode.mirror : VideoViewMirrorMode.off,
          )
        else
          Center(
            child: CircleAvatar(
              radius: 30,
              backgroundColor: Brand.ink700,
              child: Text(tile.name.isNotEmpty ? tile.name.characters.first.toUpperCase() : '?', style: const TextStyle(color: Colors.white, fontSize: 24)),
            ),
          ),
        Positioned(
          left: 8,
          bottom: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
            child: Text(tile.name, style: const TextStyle(color: Colors.white, fontSize: 12)),
          ),
        ),
      ]),
    );
  }
}
