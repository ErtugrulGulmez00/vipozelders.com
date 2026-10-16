import 'json.dart';

/// Bildirimin uygulamada açacağı ekran.
class NotificationTarget {
  const NotificationTarget({required this.screen, this.id});

  /// booking, requests, reviews, earnings, teacher, centerStudent, center
  final String screen;
  final String? id;

  factory NotificationTarget.fromJson(Json json) => NotificationTarget(screen: asString(json['screen']), id: asStringOrNull(json['id']));
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    this.body,
    this.link,
    this.target,
    this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String? body;
  final String? link;
  final NotificationTarget? target;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isRead => readAt != null;

  factory AppNotification.fromJson(Json json) => AppNotification(
        id: asString(json['id']),
        type: asString(json['type']),
        title: asString(json['title']),
        body: asStringOrNull(json['body']),
        link: asStringOrNull(json['link']),
        target: json['target'] is Map ? NotificationTarget.fromJson(asJson(json['target'])) : null,
        readAt: asDate(json['readAt']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );

  AppNotification markRead() => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        link: link,
        target: target,
        readAt: readAt ?? DateTime.now(),
        createdAt: createdAt,
      );
}

class NotificationPage {
  const NotificationPage({required this.items, required this.unread, this.nextPage});

  final List<AppNotification> items;
  final int unread;
  final int? nextPage;

  factory NotificationPage.fromJson(Json json) => NotificationPage(
        items: asList(json['items'], AppNotification.fromJson),
        unread: asInt(json['unread']),
        nextPage: asIntOrNull(json['nextPage']),
      );
}
