import 'json.dart';

// Veli/öğrenci ↔ öğretmen mesajlaşması (`/mesajlar`). İletişim bilgileri sunucuda gizlenir.

class ChatPeer {
  const ChatPeer({required this.name, this.photoUrl, this.teacherSlug});

  final String name;
  final String? photoUrl;
  final String? teacherSlug;

  factory ChatPeer.fromJson(Json json) => ChatPeer(
        name: asString(json['name']),
        photoUrl: asStringOrNull(json['photoUrl']),
        teacherSlug: asStringOrNull(json['teacherSlug']),
      );
}

class ThreadSummary {
  const ThreadSummary({required this.id, required this.counterpart, this.lastBody, this.lastMine = false, this.lastAt, this.unread = false});

  final String id;
  final ChatPeer counterpart;
  final String? lastBody;
  final bool lastMine;
  final DateTime? lastAt;
  final bool unread;

  factory ThreadSummary.fromJson(Json json) {
    final last = asJsonOrNull(json['last']);
    return ThreadSummary(
      id: asString(json['id']),
      counterpart: ChatPeer.fromJson(asJson(json['counterpart'])),
      lastBody: last == null ? null : asStringOrNull(last['body']),
      lastMine: last != null && asBool(last['mine']),
      lastAt: last == null ? asDate(json['lastMessageAt']) : asDate(last['createdAt']),
      unread: asBool(json['unread']),
    );
  }
}

class DirectMessage {
  const DirectMessage({required this.id, required this.mine, required this.body, required this.createdAt, this.masked = false});

  final String id;
  final bool mine;
  final String body;
  final DateTime createdAt;

  /// İletişim bilgisi gizlendi
  final bool masked;

  factory DirectMessage.fromJson(Json json) => DirectMessage(
        id: asString(json['id']),
        mine: asBool(json['mine']),
        body: asString(json['body']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
        masked: asBool(json['masked']),
      );
}

class MessageThread {
  const MessageThread({required this.id, required this.counterpart, this.messages = const [], this.lastMasked = false});

  final String id;
  final ChatPeer counterpart;
  final List<DirectMessage> messages;

  /// Son gönderilen mesajda iletişim bilgisi gizlendi (yalnızca gönderim yanıtında)
  final bool lastMasked;

  factory MessageThread.fromJson(Json json) => MessageThread(
        id: asString(json['id']),
        counterpart: ChatPeer.fromJson(asJson(json['counterpart'])),
        messages: asList(json['messages'], DirectMessage.fromJson),
        lastMasked: asBool(json['masked']),
      );
}
