import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../format/text.dart';
import '../theme/app_theme.dart';

/// Fotoğraf ya da baş harfler.
class Avatar extends StatelessWidget {
  const Avatar({super.key, required this.name, this.photoUrl, this.size = 48, this.radius});

  final String name;
  final String? photoUrl;
  final double size;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius ?? size * 0.32);
    // Sitedeki gibi ada göre sabit renk (mercan, iris, nane, sarı, lacivert)
    final (background, foreground) = Brand.avatarTone(name);
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(borderRadius: r, color: background),
      alignment: Alignment.center,
      child: Text(
        initialsOf(name),
        style: TextStyle(fontFamily: AppTheme.displayFamily, color: foreground, fontWeight: FontWeight.w800, fontSize: size * 0.36),
      ),
    );
    if (photoUrl == null || photoUrl!.isEmpty) return Semantics(label: name, child: placeholder);
    return Semantics(
      label: name,
      image: true,
      child: ClipRRect(
        borderRadius: r,
        child: CachedNetworkImage(
          imageUrl: photoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, _) => placeholder,
          errorWidget: (_, _, _) => placeholder,
        ),
      ),
    );
  }
}
