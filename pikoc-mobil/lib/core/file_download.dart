import 'dart:io';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import 'api.dart';
import 'session.dart';

/// Kurumun/koçun paylaştığı dosyayı indirir ve telefondaki uygun uygulamayla (PDF okuyucu, Word, galeri) açar.
Future<void> openRemoteFile(BuildContext context, String url, {String? fileName}) async {
  final messenger = ScaffoldMessenger.of(context);
  final api = SessionScope.read(context).api;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(const SnackBar(content: Text('Dosya indiriliyor…'), duration: Duration(minutes: 1)));
  try {
    final dir = await getTemporaryDirectory();
    final folder = Directory('${dir.path}/dosyalar');
    await folder.create(recursive: true);
    final temp = '${folder.path}/.indirme-${DateTime.now().millisecondsSinceEpoch}';
    final name = (await api.download(url, temp)) ?? fileName ?? 'dosya';
    final safe = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    final target = File('${folder.path}/$safe');
    if (await target.exists()) await target.delete();
    await File(temp).rename(target.path);
    messenger.hideCurrentSnackBar();
    final result = await OpenFilex.open(target.path);
    if (result.type == ResultType.noAppToOpen) {
      messenger.showSnackBar(const SnackBar(content: Text('Bu dosyayı açacak uygulama yok (ör. PDF okuyucu ya da Word).')));
    } else if (result.type != ResultType.done) {
      messenger.showSnackBar(const SnackBar(content: Text('Dosya indirildi ama açılamadı.')));
    }
  } catch (error) {
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(SnackBar(content: Text(errorText(error))));
  }
}
