import 'json.dart';

// Soru kredisi ve soru havuzu (`/krediler`, `/sorular`, `/ogretmen/soru-havuzu`). Tutarlar kuruş.

class CreditPackage {
  const CreditPackage({required this.credits, required this.price, required this.unitPrice, this.savingPercent = 0});

  final int credits;
  final int price;
  final int unitPrice;
  final int savingPercent;

  String get title => credits == 1 ? 'Tek soru' : '$credits soru';

  factory CreditPackage.fromJson(Json json) => CreditPackage(
        credits: asInt(json['credits']),
        price: asInt(json['price']),
        unitPrice: asInt(json['unitPrice']),
        savingPercent: asInt(json['savingPercent']),
      );
}

/// Soru gönderilebilecek kademe + ders (havuzda uygun öğretmeni olan).
class PoolSubject {
  const PoolSubject({required this.levelId, required this.subjectId, required this.levelName, required this.subjectName});

  final int levelId;
  final int subjectId;
  final String levelName;
  final String subjectName;

  String get title => '$levelName · $subjectName';

  factory PoolSubject.fromJson(Json json) => PoolSubject(
        levelId: asInt(json['levelId']),
        subjectId: asInt(json['subjectId']),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
      );
}

class CreditPurchase {
  const CreditPurchase({
    required this.id,
    required this.code,
    required this.credits,
    required this.price,
    required this.status,
    required this.statusLabel,
    this.refundedAmount = 0,
    this.remaining = 0,
    this.expired = false,
    this.paidAt,
    this.expiresAt,
    this.refundAllowed = false,
    this.refundAmount = 0,
    this.refundReason,
    this.paymentStatus,
    this.failureReason,
  });

  final String id;
  final String code;
  final int credits;
  final int price;

  /// PENDING_PAYMENT, PAID, FAILED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED
  final String status;
  final String statusLabel;
  final int refundedAmount;
  final int remaining;
  final bool expired;
  final DateTime? paidAt;
  final DateTime? expiresAt;
  final bool refundAllowed;
  final int refundAmount;
  final String? refundReason;

  /// Son ödeme denemesi (yalnızca `GET /krediler/{id}`).
  final String? paymentStatus;
  final String? failureReason;

  bool get isPaid => status == 'PAID' || status == 'PARTIALLY_REFUNDED';

  factory CreditPurchase.fromJson(Json json) {
    final refund = asJsonOrNull(json['refund']);
    final payment = asJsonOrNull(json['payment']);
    return CreditPurchase(
      id: asString(json['id']),
      code: asString(json['code']),
      credits: asInt(json['credits']),
      price: asInt(json['price']),
      status: asString(json['status']),
      statusLabel: asString(json['statusLabel']),
      refundedAmount: asInt(json['refundedAmount']),
      remaining: asInt(json['remaining']),
      expired: asBool(json['expired']),
      paidAt: asDate(json['paidAt']),
      expiresAt: asDate(json['expiresAt']),
      refundAllowed: refund != null && asBool(refund['allowed']),
      refundAmount: refund == null ? 0 : asInt(refund['amount']),
      refundReason: refund == null ? null : asStringOrNull(refund['reason']),
      paymentStatus: payment == null ? null : asStringOrNull(payment['status']),
      failureReason: payment == null ? null : asStringOrNull(payment['failureReason']),
    );
  }
}

class CreditEntry {
  const CreditEntry({required this.id, required this.kindLabel, required this.amount, this.note, required this.createdAt});

  final String id;
  final String kindLabel;
  final int amount;
  final String? note;
  final DateTime createdAt;

  factory CreditEntry.fromJson(Json json) => CreditEntry(
        id: asString(json['id']),
        kindLabel: asString(json['kindLabel']),
        amount: asInt(json['amount']),
        note: asStringOrNull(json['note']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class CreditRules {
  const CreditRules({this.validityMonths = 12, this.refundDays = 14, this.answerHours = 24, this.disputeHours = 48, this.singlePrice = 0});

  final int validityMonths;
  final int refundDays;
  final int answerHours;
  final int disputeHours;
  final int singlePrice;

  factory CreditRules.fromJson(Json json) => CreditRules(
        validityMonths: asInt(json['validityMonths'], 12),
        refundDays: asInt(json['refundDays'], 14),
        answerHours: asInt(json['answerHours'], 24),
        disputeHours: asInt(json['disputeHours'], 48),
        singlePrice: asInt(json['singlePrice']),
      );
}

/// `GET /krediler`
class Credits {
  const Credits({
    required this.balance,
    required this.salesOpen,
    required this.rules,
    this.packages = const [],
    this.subjects = const [],
    this.purchases = const [],
    this.entries = const [],
  });

  final int balance;
  final bool salesOpen;
  final CreditRules rules;
  final List<CreditPackage> packages;
  final List<PoolSubject> subjects;
  final List<CreditPurchase> purchases;
  final List<CreditEntry> entries;

  factory Credits.fromJson(Json json) => Credits(
        balance: asInt(json['balance']),
        salesOpen: asBool(json['salesOpen']),
        rules: CreditRules.fromJson(asJson(json['rules'])),
        packages: asList(json['packages'], CreditPackage.fromJson),
        subjects: asList(json['subjects'], PoolSubject.fromJson),
        purchases: asList(json['purchases'], CreditPurchase.fromJson),
        entries: asList(json['entries'], CreditEntry.fromJson),
      );
}

class PoolFollowUp {
  const PoolFollowUp({required this.text, this.askedAt, this.answer, this.answeredAt});

  final String text;
  final DateTime? askedAt;
  final String? answer;
  final DateTime? answeredAt;

  factory PoolFollowUp.fromJson(Json json) => PoolFollowUp(
        text: asString(json['text']),
        askedAt: asDate(json['askedAt']),
        answer: asStringOrNull(json['answer']),
        answeredAt: asDate(json['answeredAt']),
      );
}

class PoolAnswer {
  const PoolAnswer({this.text, this.imageUrl, this.videoUrl, this.answeredAt, this.followUp});

  final String? text;
  final String? imageUrl;
  final String? videoUrl;
  final DateTime? answeredAt;
  final PoolFollowUp? followUp;

  factory PoolAnswer.fromJson(Json json) => PoolAnswer(
        text: asStringOrNull(json['text']),
        imageUrl: asStringOrNull(json['imageUrl']),
        videoUrl: asStringOrNull(json['videoUrl']),
        answeredAt: asDate(json['answeredAt']),
        followUp: json['followUp'] is Map ? PoolFollowUp.fromJson(asJson(json['followUp'])) : null,
      );
}

/// Havuz sorusu: öğrenci (`/sorular`) ve öğretmen (`/ogretmen/soru-havuzu`) görünümü aynı modelle okunur.
class PoolQuestion {
  const PoolQuestion({
    required this.id,
    required this.code,
    required this.levelName,
    required this.subjectName,
    required this.status,
    required this.statusLabel,
    required this.createdAt,
    this.note,
    this.imageUrl,
    this.expiresAt,
    this.answeredAt,
    this.teacherName,
    this.teacherPhotoUrl,
    this.answer,
    this.rating,
    this.rejectReason,
    this.disputeReason,
    this.resolutionNote,
    this.disputeUntil,
    this.mine = false,
    this.fee = 0,
    this.claimExpiresAt,
    this.releaseAt,
    this.actions = const {},
  });

  final String id;
  final String code;
  final String levelName;
  final String subjectName;

  /// OPEN, CLAIMED, ANSWERED, CLOSED, EXPIRED, REJECTED, DISPUTED, REFUNDED, CANCELLED
  final String status;
  final String statusLabel;
  final DateTime createdAt;
  final String? note;
  final String? imageUrl;
  final DateTime? expiresAt;
  final DateTime? answeredAt;
  final String? teacherName;
  final String? teacherPhotoUrl;
  final PoolAnswer? answer;
  final int? rating;
  final String? rejectReason;
  final String? disputeReason;
  final String? resolutionNote;
  final DateTime? disputeUntil;

  /// Öğretmen görünümü
  final bool mine;
  final int fee;
  final DateTime? claimExpiresAt;
  final DateTime? releaseAt;

  /// Öğrenci: canCancel, canFollowUp, canRate, canDispute · Öğretmen: canClaim, canRelease, canReject, canAnswer, canAnswerFollowUp
  final Map<String, bool> actions;

  String get title => '$levelName · $subjectName';
  bool can(String action) => actions[action] ?? false;

  factory PoolQuestion.fromJson(Json json) {
    final teacher = asJsonOrNull(json['teacher']);
    final actions = asJson(json['actions']);
    return PoolQuestion(
      id: asString(json['id']),
      code: asString(json['code']),
      levelName: asString(json['levelName']),
      subjectName: asString(json['subjectName']),
      status: asString(json['status']),
      statusLabel: asString(json['statusLabel']),
      createdAt: asDateOr(json['createdAt'], DateTime.now()),
      note: asStringOrNull(json['note']),
      imageUrl: asStringOrNull(json['imageUrl']),
      expiresAt: asDate(json['expiresAt']),
      answeredAt: asDate(json['answeredAt']),
      teacherName: teacher == null ? null : asStringOrNull(teacher['name']),
      teacherPhotoUrl: teacher == null ? null : asStringOrNull(teacher['photoUrl']),
      answer: json['answer'] is Map ? PoolAnswer.fromJson(asJson(json['answer'])) : null,
      rating: asIntOrNull(json['rating']),
      rejectReason: asStringOrNull(json['rejectReason']),
      disputeReason: asStringOrNull(json['disputeReason']),
      resolutionNote: asStringOrNull(json['resolutionNote']),
      disputeUntil: asDate(json['disputeUntil']),
      mine: asBool(json['mine']),
      fee: asInt(json['fee']),
      claimExpiresAt: asDate(json['claimExpiresAt']),
      releaseAt: asDate(json['releaseAt']),
      actions: actions.map((key, value) => MapEntry(key, asBool(value))),
    );
  }
}

class PoolQuestionPage {
  const PoolQuestionPage({required this.items, this.nextPage});

  final List<PoolQuestion> items;
  final int? nextPage;

  factory PoolQuestionPage.fromJson(Json json) => PoolQuestionPage(items: asList(json['items'], PoolQuestion.fromJson), nextPage: asIntOrNull(json['nextPage']));
}

/// `GET /ogretmen/soru-havuzu`
class TeacherPool {
  const TeacherPool({
    required this.answersPool,
    required this.eligible,
    required this.blocked,
    this.ratingAvg,
    this.ratingCount = 0,
    this.claimMinutes = 30,
    this.maxActiveClaims = 3,
    this.fee = 0,
    this.open = const [],
    this.mine = const [],
  });

  final bool answersPool;

  /// Profil yayında, onay koşulları sağlanıyor ve havuza açık
  final bool eligible;

  /// Düşük puan / haklı itirazlar nedeniyle geçici olarak kapalı
  final bool blocked;
  final double? ratingAvg;
  final int ratingCount;
  final int claimMinutes;
  final int maxActiveClaims;
  final int fee;
  final List<PoolQuestion> open;
  final List<PoolQuestion> mine;

  int get activeClaims => mine.where((q) => q.status == 'CLAIMED').length;

  factory TeacherPool.fromJson(Json json) {
    final standing = asJson(json['standing']);
    final rules = asJson(json['rules']);
    return TeacherPool(
      answersPool: asBool(json['answersPool']),
      eligible: asBool(json['eligible']),
      blocked: asBool(json['blocked']),
      ratingAvg: asDoubleOrNull(standing['ratingAvg']),
      ratingCount: asInt(standing['ratingCount']),
      claimMinutes: asInt(rules['claimMinutes'], 30),
      maxActiveClaims: asInt(rules['maxActiveClaims'], 3),
      fee: asInt(rules['fee']),
      open: asList(json['open'], PoolQuestion.fromJson),
      mine: asList(json['mine'], PoolQuestion.fromJson),
    );
  }
}
