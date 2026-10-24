import 'json.dart';

// Paket ders, aylık soru aboneliği, grup dersi, indirim kodu ve arkadaşını getir. Tutarlar kuruş.

class TeacherRef {
  const TeacherRef({required this.name, required this.slug, this.photoUrl, this.headline});

  final String name;
  final String slug;
  final String? photoUrl;
  final String? headline;

  factory TeacherRef.fromJson(Json json) => TeacherRef(
        name: asString(json['name']),
        slug: asString(json['slug']),
        photoUrl: asStringOrNull(json['photoUrl']),
        headline: asStringOrNull(json['headline']),
      );
}

/// Son ödeme denemesinin durumu (satın alma sonrası sorgulamada).
class PaymentState {
  const PaymentState({required this.status, this.failureReason});

  final String status;
  final String? failureReason;

  bool get failed => status == 'FAILED';

  static PaymentState? fromJson(Object? value) {
    final json = asJsonOrNull(value);
    return json == null ? null : PaymentState(status: asString(json['status']), failureReason: asStringOrNull(json['failureReason']));
  }
}

class RefundOffer {
  const RefundOffer({this.allowed = false, this.amount = 0, this.reason});

  final bool allowed;
  final int amount;
  final String? reason;

  factory RefundOffer.fromJson(Object? value) {
    final json = asJson(value);
    return RefundOffer(allowed: asBool(json['allowed']), amount: asInt(json['amount']), reason: asStringOrNull(json['reason']));
  }
}

// ---------------------------------------------------------------- indirim ve davet

/// `POST /indirim-kodu`
class CouponCheck {
  const CouponCheck({required this.ok, this.discount = 0, this.finalPrice = 0, this.label, this.text, this.error});

  final bool ok;
  final int discount;
  final int finalPrice;
  final String? label;
  final String? text;
  final String? error;

  factory CouponCheck.fromJson(Json json) => CouponCheck(
        ok: asBool(json['ok']),
        discount: asInt(json['discount']),
        finalPrice: asInt(json['finalPrice']),
        label: asStringOrNull(json['label']),
        text: asStringOrNull(json['text']),
        error: asStringOrNull(json['error']),
      );
}

/// `GET /davet`
class InviteInfo {
  const InviteInfo({required this.enabled, required this.code, required this.url, required this.shareText, this.discountPercent = 0, this.rewardCredits = 0, this.invited = 0, this.rewarded = 0});

  final bool enabled;
  final String code;
  final String url;
  final String shareText;
  final int discountPercent;
  final int rewardCredits;
  final int invited;
  final int rewarded;

  factory InviteInfo.fromJson(Json json) => InviteInfo(
        enabled: asBool(json['enabled']),
        code: asString(json['code']),
        url: asString(json['url']),
        shareText: asString(json['shareText']),
        discountPercent: asInt(json['discountPercent']),
        rewardCredits: asInt(json['rewardCredits']),
        invited: asInt(json['invited']),
        rewarded: asInt(json['rewarded']),
      );
}

// ---------------------------------------------------------------- öğretmen profilindeki teklifler

class PackageOffer {
  const PackageOffer({required this.lessons, required this.percent});

  final int lessons;
  final int percent;

  factory PackageOffer.fromJson(Json json) => PackageOffer(lessons: asInt(json['lessons']), percent: asInt(json['percent']));
}

/// Ders sayısı için geçerli paket indirimi (sunucudaki kuralın aynısı: ders sayısını aşmayan en büyük paket).
int packageDiscountFor(List<PackageOffer> offers, int lessons) =>
    offers.where((o) => o.lessons <= lessons).fold(0, (best, o) => o.percent > best ? o.percent : best);

class QuestionPlan {
  const QuestionPlan({required this.id, required this.levelName, required this.subjectName, required this.price, this.dailyLimit = 10, this.answerHours = 12, this.days = 30, this.description});

  final String id;
  final String levelName;
  final String subjectName;
  final int price;
  final int dailyLimit;
  final int answerHours;
  final int days;
  final String? description;

  String get title => '$levelName · $subjectName';

  factory QuestionPlan.fromJson(Json json) => QuestionPlan(
        id: asString(json['id']),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
        price: asInt(json['price']),
        dailyLimit: asInt(json['dailyLimit'], 10),
        answerHours: asInt(json['answerHours'], 12),
        days: asInt(json['days'], 30),
        description: asStringOrNull(json['description']),
      );
}

/// Velinin bu öğretmendeki kullanılabilir paketi ("Paketimden kullan").
class MyPackage {
  const MyPackage({required this.id, required this.code, this.offeringId, required this.durationMinutes, required this.left, this.levelName = '', this.subjectName = '', this.expiresAt});

  final String id;
  final String code;
  final String? offeringId;
  final int durationMinutes;
  final int left;
  final String levelName;
  final String subjectName;
  final DateTime? expiresAt;

  factory MyPackage.fromJson(Json json) => MyPackage(
        id: asString(json['id']),
        code: asString(json['code']),
        offeringId: asStringOrNull(json['offeringId']),
        durationMinutes: asInt(json['durationMinutes']),
        left: asInt(json['left']),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
        expiresAt: asDate(json['expiresAt']),
      );
}

// ---------------------------------------------------------------- paket ders

class PackageBooking {
  const PackageBooking({required this.id, required this.startAt, required this.endAt, required this.status, required this.statusLabel});

  final String id;
  final DateTime startAt;
  final DateTime endAt;
  final String status;
  final String statusLabel;

  factory PackageBooking.fromJson(Json json) => PackageBooking(
        id: asString(json['id']),
        startAt: asDateOr(json['startAt'], DateTime.now()),
        endAt: asDateOr(json['endAt'], DateTime.now()),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
      );
}

class LessonPackage {
  const LessonPackage({
    required this.id,
    required this.code,
    required this.teacher,
    required this.levelName,
    required this.subjectName,
    required this.durationMinutes,
    required this.lessonCount,
    required this.unitPrice,
    required this.price,
    required this.status,
    required this.statusLabel,
    this.offeringId,
    this.listUnitPrice = 0,
    this.discountPercent = 0,
    this.refundedAmount = 0,
    this.recurring = false,
    this.active = false,
    this.left = 0,
    this.expiresAt,
    this.refund = const RefundOffer(),
    this.bookings = const [],
    this.payment,
  });

  final String id;
  final String code;
  final TeacherRef teacher;
  final String? offeringId;
  final String levelName;
  final String subjectName;
  final int durationMinutes;
  final int lessonCount;
  final int listUnitPrice;
  final int unitPrice;
  final int discountPercent;
  final int price;
  final int refundedAmount;

  /// PENDING_PAYMENT, PAID, CLOSED, FAILED, EXPIRED
  final String status;
  final String statusLabel;
  final bool recurring;
  final bool active;
  final int left;
  final DateTime? expiresAt;
  final RefundOffer refund;
  final List<PackageBooking> bookings;
  final PaymentState? payment;

  String get title => '$levelName · $subjectName';

  factory LessonPackage.fromJson(Json json) => LessonPackage(
        id: asString(json['id']),
        code: asString(json['code']),
        teacher: TeacherRef.fromJson(asJson(json['teacher'])),
        offeringId: asStringOrNull(json['offeringId']),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
        durationMinutes: asInt(json['durationMinutes']),
        lessonCount: asInt(json['lessonCount']),
        listUnitPrice: asInt(json['listUnitPrice']),
        unitPrice: asInt(json['unitPrice']),
        discountPercent: asInt(json['discountPercent']),
        price: asInt(json['price']),
        refundedAmount: asInt(json['refundedAmount']),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        recurring: asBool(json['recurring']),
        active: asBool(json['active']),
        left: asInt(json['left']),
        expiresAt: asDate(json['expiresAt']),
        refund: RefundOffer.fromJson(json['refund']),
        bookings: asList(json['bookings'], PackageBooking.fromJson),
        payment: PaymentState.fromJson(json['payment']),
      );
}

// ---------------------------------------------------------------- aylık soru aboneliği

class QuestionSubscription {
  const QuestionSubscription({
    required this.id,
    required this.code,
    required this.teacher,
    required this.levelName,
    required this.subjectName,
    required this.price,
    required this.status,
    required this.statusLabel,
    this.planId,
    this.dailyLimit = 0,
    this.answerHours = 0,
    this.days = 30,
    this.running = false,
    this.startsAt,
    this.endsAt,
    this.usedToday = 0,
    this.payment,
  });

  final String id;
  final String code;
  final String? planId;
  final TeacherRef teacher;
  final String levelName;
  final String subjectName;
  final int price;

  /// PENDING_PAYMENT, ACTIVE, ENDED, CANCELLED, REFUNDED, FAILED, EXPIRED
  final String status;
  final String statusLabel;
  final int dailyLimit;
  final int answerHours;
  final int days;

  /// Dönem şu an sürüyor (soru gönderilebilir)
  final bool running;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final int usedToday;
  final PaymentState? payment;

  String get title => '$levelName · $subjectName';
  int get leftToday => (dailyLimit - usedToday).clamp(0, dailyLimit);

  factory QuestionSubscription.fromJson(Json json) => QuestionSubscription(
        id: asString(json['id']),
        code: asString(json['code']),
        planId: asStringOrNull(json['planId']),
        teacher: TeacherRef.fromJson(asJson(json['teacher'])),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
        price: asInt(json['price']),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        dailyLimit: asInt(json['dailyLimit']),
        answerHours: asInt(json['answerHours']),
        days: asInt(json['days'], 30),
        running: asBool(json['running']),
        startsAt: asDate(json['startsAt']),
        endsAt: asDate(json['endsAt']),
        usedToday: asInt(json['usedToday']),
        payment: PaymentState.fromJson(json['payment']),
      );
}

// ---------------------------------------------------------------- grup dersi

class GroupSessionInfo {
  const GroupSessionInfo({required this.id, required this.index, required this.startAt, required this.endAt, required this.status, required this.statusLabel, this.canJoin = false, this.opensAt});

  final String id;
  final int index;
  final DateTime startAt;
  final DateTime endAt;
  final String status;
  final String statusLabel;
  final bool canJoin;
  final DateTime? opensAt;

  factory GroupSessionInfo.fromJson(Json json) => GroupSessionInfo(
        id: asString(json['id']),
        index: asInt(json['index']),
        startAt: asDateOr(json['startAt'], DateTime.now()),
        endAt: asDateOr(json['endAt'], DateTime.now()),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        canJoin: asBool(json['canJoin']),
        opensAt: asDate(json['opensAt']),
      );
}

class GroupEnrollmentInfo {
  const GroupEnrollmentInfo({required this.id, required this.code, required this.status, required this.statusLabel, this.price = 0, this.refundedAmount = 0, this.learnerName, this.payment, this.courseCode, this.courseTitle});

  final String id;
  final String code;

  /// INVITED, PENDING_PAYMENT, PAID, CANCELLED, EXPIRED, FAILED
  final String status;
  final String statusLabel;
  final int price;
  final int refundedAmount;
  final String? learnerName;
  final PaymentState? payment;
  final String? courseCode;
  final String? courseTitle;

  factory GroupEnrollmentInfo.fromJson(Json json) {
    final course = asJsonOrNull(json['course']);
    return GroupEnrollmentInfo(
      id: asString(json['id']),
      code: asString(json['code']),
      status: asString(json['status']),
      statusLabel: asString(json['statusLabel']),
      price: asInt(json['price']),
      refundedAmount: asInt(json['refundedAmount']),
      learnerName: asStringOrNull(json['learnerName']),
      payment: PaymentState.fromJson(json['payment']),
      courseCode: course == null ? null : asStringOrNull(course['code']),
      courseTitle: course == null ? null : asStringOrNull(course['title']),
    );
  }
}

class GroupCourse {
  const GroupCourse({
    required this.id,
    required this.code,
    required this.title,
    required this.levelName,
    required this.subjectName,
    required this.price,
    required this.capacity,
    required this.status,
    required this.statusLabel,
    this.minParticipants = 0,
    this.seatsTaken = 0,
    this.enrollDeadline,
    this.sessionCount = 0,
    this.firstStartAt,
    this.lastEndAt,
    this.durationMinutes = 0,
    this.teacher,
    this.description,
    this.sessions = const [],
    this.enrollment,
    this.canEnroll = false,
    this.canCancel = false,
  });

  final String id;
  final String code;
  final String title;
  final String levelName;
  final String subjectName;
  final int price;
  final int capacity;
  final int minParticipants;
  final int seatsTaken;
  final DateTime? enrollDeadline;
  final int sessionCount;
  final DateTime? firstStartAt;
  final DateTime? lastEndAt;
  final int durationMinutes;

  /// OPEN, CONFIRMED, CANCELLED, COMPLETED
  final String status;
  final String statusLabel;
  final TeacherRef? teacher;
  final String? description;
  final List<GroupSessionInfo> sessions;
  final GroupEnrollmentInfo? enrollment;
  final bool canEnroll;
  final bool canCancel;

  int get seatsLeft => (capacity - seatsTaken).clamp(0, capacity);

  factory GroupCourse.fromJson(Json json) {
    final actions = asJson(json['actions']);
    return GroupCourse(
      id: asString(json['id']),
      code: asString(json['code']),
      title: asString(json['title']),
      levelName: asString(json['levelName']),
      subjectName: asString(json['subjectName']),
      price: asInt(json['price']),
      capacity: asInt(json['capacity']),
      minParticipants: asInt(json['minParticipants']),
      seatsTaken: asInt(json['seatsTaken']),
      enrollDeadline: asDate(json['enrollDeadline']),
      sessionCount: asInt(json['sessionCount']),
      firstStartAt: asDate(json['firstStartAt']),
      lastEndAt: asDate(json['lastEndAt']),
      durationMinutes: asInt(json['durationMinutes']),
      status: asString(json['status']),
      statusLabel: asString(json['statusLabel']),
      teacher: json['teacher'] is Map ? TeacherRef.fromJson(asJson(json['teacher'])) : null,
      description: asStringOrNull(json['description']),
      sessions: asList(json['sessions'], GroupSessionInfo.fromJson),
      enrollment: json['enrollment'] is Map ? GroupEnrollmentInfo.fromJson(asJson(json['enrollment'])) : null,
      canEnroll: asBool(actions['canEnroll']),
      canCancel: asBool(actions['canCancel']),
    );
  }
}

/// Öğrencinin grup kaydı (`GET /grup-dersleri?kapsam=benim`).
class MyGroupEnrollment {
  const MyGroupEnrollment({required this.enrollment, required this.course});

  final GroupEnrollmentInfo enrollment;
  final GroupCourse course;

  factory MyGroupEnrollment.fromJson(Json json) => MyGroupEnrollment(enrollment: GroupEnrollmentInfo.fromJson(json), course: GroupCourse.fromJson(asJson(json['course'])));
}

// ---------------------------------------------------------------- erteleme

class RescheduleInfo {
  const RescheduleInfo({this.allowed = false, this.reason, this.count = 0, this.pendingId, this.pendingStartAt, this.pendingNote, this.pendingMine = false});

  final bool allowed;
  final String? reason;
  final int count;
  final String? pendingId;
  final DateTime? pendingStartAt;
  final String? pendingNote;

  /// Bekleyen öneriyi bu kullanıcı yaptı (karşı tarafın yanıtı bekleniyor)
  final bool pendingMine;

  bool get hasPending => pendingId != null;

  factory RescheduleInfo.fromJson(Object? value) {
    final json = asJson(value);
    final pending = asJsonOrNull(json['pending']);
    return RescheduleInfo(
      allowed: asBool(json['allowed']),
      reason: asStringOrNull(json['reason']),
      count: asInt(json['count']),
      pendingId: pending == null ? null : asStringOrNull(pending['id']),
      pendingStartAt: pending == null ? null : asDate(pending['newStartAt']),
      pendingNote: pending == null ? null : asStringOrNull(pending['note']),
      pendingMine: pending != null && asBool(pending['mine']),
    );
  }
}
