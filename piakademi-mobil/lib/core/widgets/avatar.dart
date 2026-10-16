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
    final placeholder = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: r,
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Brand.b100, Brand.b200]),
      ),
      alignment: Alignment.center,
      child: Text(
        initialsOf(name),
        style: TextStyle(color: Brand.b800, fontWeight: FontWeight.w800, fontSize: size * 0.34),
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
