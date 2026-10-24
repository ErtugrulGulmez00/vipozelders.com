import 'commerce.dart';
import 'json.dart';

/// Ders (randevu) durumları.
class BookingStatus {
  BookingStatus._();

  static const pendingPayment = 'PENDING_PAYMENT';
  static const paymentFailed = 'PAYMENT_FAILED';
  static const pendingApproval = 'PENDING_APPROVAL';
  static const confirmed = 'CONFIRMED';
  static const completed = 'COMPLETED';
  static const rejected = 'REJECTED';
  static const expired = 'EXPIRED';
  static const disputed = 'DISPUTED';
}

const modeLabels = {'ONLINE': 'Online', 'IN_PERSON': 'Yüz yüze', 'QUESTION': 'Fotoğrafla soru'};
const placeLabels = {'STUDENT_HOME': 'Öğrencinin adresinde', 'TEACHER_PLACE': 'Öğretmenin yerinde'};

class Counterpart {
  const Counterpart({required this.name, this.photoUrl, this.teacherSlug});

  final String name;
  final String? photoUrl;
  final String? teacherSlug;

  factory Counterpart.fromJson(Json json) => Counterpart(
        name: asString(json['name']),
        photoUrl: asStringOrNull(json['photoUrl']),
        teacherSlug: asStringOrNull(json['teacherSlug']),
      );
}

/// Liste kartı. Öğretmen görünümünde [amount] öğretmenin kazancıdır.
class BookingSummary {
  const BookingSummary({
    required this.id,
    required this.code,
    required this.status,
    required this.statusLabel,
    required this.startAt,
    required this.endAt,
    required this.durationMinutes,
    required this.levelName,
    required this.subjectName,
    required this.serviceName,
    required this.mode,
    required this.learnerName,
    required this.amount,
    this.approvalDeadline,
    this.isTest = false,
    this.isIntro = false,
    this.packageId,
    required this.counterpart,
  });

  final String id;
  final String code;
  final String status;
  final String statusLabel;
  final DateTime startAt;
  final DateTime endAt;
  final int durationMinutes;
  final String levelName;
  final String subjectName;
  final String serviceName;

  /// ONLINE, IN_PERSON, QUESTION
  final String mode;
  final String learnerName;
  final int amount;
  final DateTime? approvalDeadline;
  final bool isTest;

  /// Ücretsiz 15 dk tanışma görüşmesi (ödemesiz)
  final bool isIntro;

  /// Paketten (ya da düzenli dersten) alınan ders
  final String? packageId;
  final Counterpart counterpart;

  bool get isQuestion => mode == 'QUESTION';
  bool get isOnline => mode == 'ONLINE';
  String get title => '$levelName · $subjectName';

  factory BookingSummary.fromJson(Json json) => BookingSummary(
        id: asString(json['id']),
        code: asString(json['code']),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        startAt: asDateOr(json['startAt'], DateTime.now()),
        endAt: asDateOr(json['endAt'], DateTime.now()),
        durationMinutes: asInt(json['durationMinutes']),
        levelName: asString(json['levelName']),
        subjectName: asString(json['subjectName']),
        serviceName: asString(json['serviceName']),
        mode: asString(json['mode'], 'ONLINE'),
        learnerName: asString(json['learnerName']),
        amount: asInt(json['amount']),
        approvalDeadline: asDate(json['approvalDeadline']),
        isTest: asBool(json['isTest']),
        isIntro: asBool(json['isIntro']),
        packageId: asStringOrNull(json['packageId']),
        counterpart: Counterpart.fromJson(asJson(json['counterpart'])),
      );
}

class BookingPage {
  const BookingPage({required this.scope, required this.items, this.nextPage});

  final String scope;
  final List<BookingSummary> items;
  final int? nextPage;

  factory BookingPage.fromJson(Json json) => BookingPage(
        scope: asString(json['scope']),
        items: asList(json['items'], BookingSummary.fromJson),
        nextPage: asIntOrNull(json['nextPage']),
      );
}

class BookingEvent {
  const BookingEvent({required this.status, required this.statusLabel, this.note, required this.createdAt});

  final String status;
  final String statusLabel;
  final String? note;
  final DateTime createdAt;

  factory BookingEvent.fromJson(Json json) => BookingEvent(
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        note: asStringOrNull(json['note']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class Refund {
  const Refund({required this.amount, required this.status, required this.statusLabel, this.reason, required this.createdAt, this.processedAt});

  final int amount;
  final String status;
  final String statusLabel;
  final String? reason;
  final DateTime createdAt;
  final DateTime? processedAt;

  factory Refund.fromJson(Json json) => Refund(
        amount: asInt(json['amount']),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        reason: asStringOrNull(json['reason']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
        processedAt: asDate(json['processedAt']),
      );
}

class Payment {
  const Payment({
    required this.id,
    required this.provider,
    required this.amount,
    required this.refundedAmount,
    required this.status,
    required this.statusLabel,
    this.failureReason,
    required this.createdAt,
    this.refunds = const [],
  });

  final String id;
  final String provider;
  final int amount;
  final int refundedAmount;

  /// INITIATED, SUCCEEDED, FAILED, REFUNDED…
  final String status;
  final String statusLabel;
  final String? failureReason;
  final DateTime createdAt;
  final List<Refund> refunds;

  factory Payment.fromJson(Json json) => Payment(
        id: asString(json['id']),
        provider: asString(json['provider']),
        amount: asInt(json['amount']),
        refundedAmount: asInt(json['refundedAmount']),
        status: asString(json['status']),
        statusLabel: asString(json['statusLabel']),
        failureReason: asStringOrNull(json['failureReason']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
        refunds: asList(json['refunds'], Refund.fromJson),
      );
}

class LessonLocation {
  const LessonLocation({this.place, this.address, this.districtName, this.cityName});

  final String? place;
  final String? address;
  final String? districtName;
  final String? cityName;

  String get text => [
        address,
        if (districtName != null) [districtName, cityName].whereType<String>().join(' / '),
      ].whereType<String>().where((s) => s.isNotEmpty).join(' — ');

  factory LessonLocation.fromJson(Json json) => LessonLocation(
        place: asStringOrNull(json['place']),
        address: asStringOrNull(json['address']),
        districtName: asStringOrNull(json['districtName']),
        cityName: asStringOrNull(json['cityName']),
      );
}

class Classroom {
  const Classroom({required this.opensAt, required this.closesAt, required this.open});

  final DateTime opensAt;
  final DateTime closesAt;
  final bool open;

  factory Classroom.fromJson(Json json) => Classroom(
        opensAt: asDateOr(json['opensAt'], DateTime.now()),
        closesAt: asDateOr(json['closesAt'], DateTime.now()),
        open: asBool(json['open']),
      );
}

class CancelPreview {
  const CancelPreview({required this.refundAmount, required this.refundPercent, this.reason});

  final int refundAmount;
  final int refundPercent;
  final String? reason;

  factory CancelPreview.fromJson(Json json) => CancelPreview(
        refundAmount: asInt(json['refundAmount']),
        refundPercent: asInt(json['refundPercent']),
        reason: asStringOrNull(json['reason']),
      );
}

/// Sunucunun o an izin verdiği işlemler (düğmeler buna göre gösterilir).
class BookingActions {
  const BookingActions({
    this.canPay = false,
    this.canJoin = false,
    this.canCancel = false,
    this.cancelPreview,
    this.canReview = false,
    this.canDispute = false,
    this.canApprove = false,
    this.canReject = false,
    this.canSolve = false,
    this.canMessage = false,
  });

  final bool canPay;
  final bool canJoin;
  final bool canCancel;
  final CancelPreview? cancelPreview;
  final bool canReview;
  final bool canDispute;
  final bool canApprove;
  final bool canReject;
  final bool canSolve;
  final bool canMessage;

  factory BookingActions.fromJson(Json json) => BookingActions(
        canPay: asBool(json['canPay']),
        canJoin: asBool(json['canJoin']),
        canCancel: asBool(json['canCancel']),
        cancelPreview: json['cancelPreview'] is Map ? CancelPreview.fromJson(asJson(json['cancelPreview'])) : null,
        canReview: asBool(json['canReview']),
        canDispute: asBool(json['canDispute']),
        canApprove: asBool(json['canApprove']),
        canReject: asBool(json['canReject']),
        canSolve: asBool(json['canSolve']),
        canMessage: asBool(json['canMessage']),
      );
}

class MyReview {
  const MyReview({required this.rating, this.comment, this.teacherReply});

  final int rating;
  final String? comment;
  final String? teacherReply;

  factory MyReview.fromJson(Json json) => MyReview(
        rating: asInt(json['rating']),
        comment: asStringOrNull(json['comment']),
        teacherReply: asStringOrNull(json['teacherReply']),
      );
}

class ParentContact {
  const ParentContact({required this.name, this.phone});

  final String name;
  final String? phone;

  factory ParentContact.fromJson(Json json) => ParentContact(name: asString(json['name']), phone: asStringOrNull(json['phone']));
}

class QuestionMessage {
  const QuestionMessage({
    required this.id,
    required this.mine,
    required this.fromTeacher,
    required this.authorName,
    this.body,
    this.imageUrl,
    this.videoUrl,
    this.isSolution = false,
    required this.createdAt,
  });

  final String id;
  final bool mine;
  final bool fromTeacher;
  final String authorName;
  final String? body;
  final String? imageUrl;
  final String? videoUrl;
  final bool isSolution;
  final DateTime createdAt;

  factory QuestionMessage.fromJson(Json json) => QuestionMessage(
        id: asString(json['id']),
        mine: asBool(json['mine']),
        fromTeacher: asBool(json['fromTeacher']),
        authorName: asString(json['authorName']),
        body: asStringOrNull(json['body']),
        imageUrl: asStringOrNull(json['imageUrl']),
        videoUrl: asStringOrNull(json['videoUrl']),
        isSolution: asBool(json['isSolution']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

/// Fotoğrafla sorunun yazışması.
class QuestionThread {
  const QuestionThread({this.answerDeadline, this.answeredAt, this.threadOpen = false, this.messages = const []});

  final DateTime? answerDeadline;
  final DateTime? answeredAt;
  final bool threadOpen;
  final List<QuestionMessage> messages;

  factory QuestionThread.fromJson(Json json) => QuestionThread(
        answerDeadline: asDate(json['answerDeadline']),
        answeredAt: asDate(json['answeredAt']),
        threadOpen: asBool(json['threadOpen']),
        messages: asList(json['messages'], QuestionMessage.fromJson),
      );
}

/// Ders ayrıntısı (`GET /rezervasyonlar/{id}`).
class BookingDetail {
  const BookingDetail({
    required this.summary,
    this.learnerGrade,
    this.inPersonPlace,
    this.note,
    required this.price,
    this.refundedAmount = 0,
    this.discountAmount = 0,
    this.couponCode,
    this.packageCode,
    this.reschedule = const RescheduleInfo(),
    this.holdExpiresAt,
    this.rejectionReason,
    this.cancelReason,
    this.disputeReason,
    this.location,
    this.classroom,
    this.createdAt,
    this.question,
    this.events = const [],
    this.payments = const [],
    this.review,
    this.parent,
    this.teacherAmount,
    this.actions = const BookingActions(),
  });

  final BookingSummary summary;
  final String? learnerGrade;
  final String? inPersonPlace;
  final String? note;
  final int price;
  final int refundedAmount;
  final int discountAmount;
  final String? couponCode;

  /// Paketten alınan ders (ödemesiz; iade pakete döner)
  final String? packageCode;
  final RescheduleInfo reschedule;
  final DateTime? holdExpiresAt;
  final String? rejectionReason;
  final String? cancelReason;
  final String? disputeReason;
  final LessonLocation? location;
  final Classroom? classroom;
  final DateTime? createdAt;
  final QuestionThread? question;
  final List<BookingEvent> events;

  /// Yalnızca veli görünümünde.
  final List<Payment> payments;
  final MyReview? review;

  /// Yalnızca öğretmen görünümünde.
  final ParentContact? parent;
  final int? teacherAmount;
  final BookingActions actions;

  String get id => summary.id;
  String get status => summary.status;

  Payment? get lastPayment => payments.isEmpty ? null : payments.last;

  factory BookingDetail.fromJson(Json json) => BookingDetail(
        summary: BookingSummary.fromJson(json),
        learnerGrade: asStringOrNull(json['learnerGrade']),
        inPersonPlace: asStringOrNull(json['inPersonPlace']),
        note: asStringOrNull(json['note']),
        price: asInt(json['price']),
        refundedAmount: asInt(json['refundedAmount']),
        discountAmount: asInt(json['discountAmount']),
        couponCode: asStringOrNull(json['couponCode']),
        packageCode: asStringOrNull(json['packageCode']),
        reschedule: RescheduleInfo.fromJson(json['reschedule']),
        holdExpiresAt: asDate(json['holdExpiresAt']),
        rejectionReason: asStringOrNull(json['rejectionReason']),
        cancelReason: asStringOrNull(json['cancelReason']),
        disputeReason: asStringOrNull(json['disputeReason']),
        location: json['location'] is Map ? LessonLocation.fromJson(asJson(json['location'])) : null,
        classroom: json['classroom'] is Map ? Classroom.fromJson(asJson(json['classroom'])) : null,
        createdAt: asDate(json['createdAt']),
        question: json['question'] is Map ? QuestionThread.fromJson(asJson(json['question'])) : null,
        events: asList(json['events'], BookingEvent.fromJson),
        payments: asList(json['payments'], Payment.fromJson),
        review: json['review'] is Map ? MyReview.fromJson(asJson(json['review'])) : null,
        parent: json['parent'] is Map ? ParentContact.fromJson(asJson(json['parent'])) : null,
        teacherAmount: asIntOrNull(json['teacherAmount']),
        actions: BookingActions.fromJson(asJson(json['actions'])),
      );
}

/// Ödeme bağlantısı (WebView'da açılır).
class PaymentLink {
  const PaymentLink({required this.url, required this.returnUrlPrefix, this.expiresAt});

  final String url;
  final String returnUrlPrefix;
  final DateTime? expiresAt;

  factory PaymentLink.fromJson(Json json) => PaymentLink(
        url: asString(json['url']),
        returnUrlPrefix: asString(json['returnUrlPrefix']),
        expiresAt: asDate(json['expiresAt']),
      );
}

class CheckoutResult {
  const CheckoutResult({required this.booking, this.payment});

  final BookingDetail booking;

  /// Ücretsiz tanışma görüşmesinde ödeme yoktur (null).
  final PaymentLink? payment;

  factory CheckoutResult.fromJson(Json json) => CheckoutResult(
        booking: BookingDetail.fromJson(asJson(json['booking'])),
        payment: json['payment'] is Map ? PaymentLink.fromJson(asJson(json['payment'])) : null,
      );
}

/// Sanal sınıf girişi.
class ClassroomAccess {
  const ClassroomAccess({required this.url, this.opensAt, this.closesAt});

  final String url;
  final DateTime? opensAt;
  final DateTime? closesAt;

  factory ClassroomAccess.fromJson(Json json) => ClassroomAccess(
        url: asString(json['url']),
        opensAt: asDate(json['opensAt']),
        closesAt: asDate(json['closesAt']),
      );
}
