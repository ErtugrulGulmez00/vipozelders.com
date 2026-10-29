import 'package:dio/dio.dart';

import '../models/booking.dart';
import '../models/catalog.dart';
import '../models/center.dart';
import '../models/commerce.dart';
import '../models/json.dart';
import '../models/me.dart';
import '../models/messages.dart';
import '../models/notification.dart';
import '../models/pool.dart';
import '../models/teacher.dart';
import '../models/teacher_panel.dart';
import 'api_client.dart';

/// Yüklenecek dosya (fotoğraf/video). Bellekteki baytlar ya da cihazdaki yol.
class UploadFile {
  const UploadFile({required this.name, this.bytes, this.path, this.mimeType});

  final String name;
  final List<int>? bytes;
  final String? path;
  final String? mimeType;

  Future<MultipartFile> toMultipart() async {
    final contentType = mimeType == null ? null : DioMediaType.parse(mimeType!);
    if (bytes != null) return MultipartFile.fromBytes(bytes!, filename: name, contentType: contentType);
    return MultipartFile.fromFile(path!, filename: name, contentType: contentType);
  }
}

/// Öğretmen arama ölçütleri (`GET /ogretmenler`). Kademe, ders, hizmet, il ve ilçe slug; fiyatlar TL.
class TeacherQuery {
  const TeacherQuery({
    this.level,
    this.subject,
    this.service,
    this.mode,
    this.city,
    this.district,
    this.minPrice,
    this.maxPrice,
    this.rating,
    this.gender,
    this.time,
    this.verified = false,
    this.subscription = false,
    this.q,
    this.sort,
  });

  final String? level;
  final String? subject;
  final String? service;

  /// online | yuz-yuze
  final String? mode;
  final String? city;
  final String? district;
  final int? minPrice;
  final int? maxPrice;
  final int? rating;

  /// kadin | erkek
  final String? gender;
  final String? time;
  final bool verified;

  /// Aylık soru aboneliği veren öğretmenler
  final bool subscription;
  final String? q;
  final String? sort;

  Map<String, dynamic> toQuery({int? page}) => {
        'level': level,
        'subject': subject,
        'service': service,
        'mode': mode,
        'city': city,
        'district': district,
        'minPrice': minPrice,
        'maxPrice': maxPrice,
        'rating': rating,
        'gender': gender,
        'time': time,
        'verified': verified ? '1' : null,
        'abonelik': subscription ? '1' : null,
        'q': (q?.trim().isEmpty ?? true) ? null : q!.trim(),
        'sort': sort,
        'page': page,
      };

  /// Sıralama ve arama metni dışında seçili filtre sayısı.
  int get activeFilters => [level, subject, service, mode, city, district, minPrice, maxPrice, rating, gender, time].where((v) => v != null).length + (verified ? 1 : 0) + (subscription ? 1 : 0);

  TeacherQuery copyWith({
    Object? level = _keep,
    Object? subject = _keep,
    Object? service = _keep,
    Object? mode = _keep,
    Object? city = _keep,
    Object? district = _keep,
    Object? minPrice = _keep,
    Object? maxPrice = _keep,
    Object? rating = _keep,
    Object? gender = _keep,
    Object? time = _keep,
    bool? verified,
    bool? subscription,
    Object? q = _keep,
    Object? sort = _keep,
  }) =>
      TeacherQuery(
        level: level == _keep ? this.level : level as String?,
        subject: subject == _keep ? this.subject : subject as String?,
        service: service == _keep ? this.service : service as String?,
        mode: mode == _keep ? this.mode : mode as String?,
        city: city == _keep ? this.city : city as String?,
        district: district == _keep ? this.district : district as String?,
        minPrice: minPrice == _keep ? this.minPrice : minPrice as int?,
        maxPrice: maxPrice == _keep ? this.maxPrice : maxPrice as int?,
        rating: rating == _keep ? this.rating : rating as int?,
        gender: gender == _keep ? this.gender : gender as String?,
        time: time == _keep ? this.time : time as String?,
        verified: verified ?? this.verified,
        subscription: subscription ?? this.subscription,
        q: q == _keep ? this.q : q as String?,
        sort: sort == _keep ? this.sort : sort as String?,
      );

  TeacherQuery clearFilters() => TeacherQuery(q: q, sort: sort);

  /// Uygulama içi adres (`/ogretmenler?level=...`) için.
  Map<String, String> toUri() {
    final result = <String, String>{};
    toQuery().forEach((key, value) {
      if (value != null && key != 'page') result[key] = value.toString();
    });
    return result;
  }

  factory TeacherQuery.fromUri(Map<String, String> params) => TeacherQuery(
        level: params['level'],
        subject: params['subject'],
        service: params['service'],
        mode: params['mode'],
        city: params['city'],
        district: params['district'],
        minPrice: int.tryParse(params['minPrice'] ?? ''),
        maxPrice: int.tryParse(params['maxPrice'] ?? ''),
        rating: int.tryParse(params['rating'] ?? ''),
        gender: params['gender'],
        time: params['time'],
        verified: params['verified'] == '1',
        subscription: params['abonelik'] == '1',
        q: params['q'],
        sort: params['sort'],
      );

  @override
  bool operator ==(Object other) => other is TeacherQuery && other.toUri().toString() == toUri().toString();

  @override
  int get hashCode => toUri().toString().hashCode;
}

const _keep = Object();

class AuthResult {
  const AuthResult({required this.token, required this.me});

  final String token;
  final Me me;
}

/// Yeni randevu bilgileri (`POST /rezervasyonlar`).
class BookingRequest {
  const BookingRequest({
    required this.offeringId,
    required this.startAt,
    required this.durationMinutes,
    required this.mode,
    required this.learnerName,
    this.learnerGrade,
    this.inPersonPlace,
    this.districtId,
    this.address,
    this.note,
    this.intro = false,
    this.couponCode,
    this.packageId,
  });

  final String offeringId;
  final DateTime startAt;
  final int durationMinutes;
  final String mode;
  final String learnerName;
  final String? learnerGrade;
  final String? inPersonPlace;
  final int? districtId;
  final String? address;
  final String? note;

  /// Ücretsiz 15 dk tanışma görüşmesi (ödemesiz; sözleşme onayı gerekmez)
  final bool intro;

  /// İndirim kodu (boşsa uygunsa davet indirimi)
  final String? couponCode;

  /// Paketten ders: ödeme ve sözleşme onayı yok, doğrudan öğretmen onayına düşer
  final String? packageId;

  Json toJson() => {
        'offeringId': offeringId,
        'startAt': startAt.toUtc().toIso8601String(),
        'durationMinutes': durationMinutes,
        'mode': mode,
        'learnerName': learnerName,
        if (learnerGrade != null && learnerGrade!.isNotEmpty) 'learnerGrade': learnerGrade,
        if (inPersonPlace != null) 'inPersonPlace': inPersonPlace,
        if (districtId != null) 'districtId': districtId,
        if (address != null && address!.isNotEmpty) 'address': address,
        if (note != null && note!.isNotEmpty) 'note': note,
        if (intro) 'intro': true else if (packageId != null) 'packageId': packageId else 'consent': true,
        if (couponCode != null && couponCode!.trim().isNotEmpty && !intro && packageId == null) 'couponCode': couponCode!.trim(),
      };
}

class ProgressRow {
  const ProgressRow({required this.topic, required this.solved, required this.correct, required this.wrong, required this.done});

  final String topic;
  final int solved;
  final int correct;
  final int wrong;
  final bool done;

  Json toJson() => {'topic': topic, 'solved': solved, 'correct': correct, 'wrong': wrong, 'done': done};
}

/// Mobil API'nin tüm uç noktaları (`/api/mobil/v1`).
class PiApi {
  PiApi(this.client);

  final ApiClient client;

  // ---------------------------------------------------------------- herkese açık

  Future<Catalog> catalog() async => Catalog.fromJson(asJson(await client.get('/katalog')));

  Future<List<District>> districts(int cityId) async => asList(asJson(await client.get('/iller/$cityId/ilceler'))['items'], District.fromJson);

  Future<TeacherPage> teachers(TeacherQuery query, {int page = 1}) async =>
      TeacherPage.fromJson(asJson(await client.get('/ogretmenler', query: query.toQuery(page: page))));

  Future<TeacherProfile> teacher(String slug) async => TeacherProfile.fromJson(asJson(await client.get('/ogretmenler/${Uri.encodeComponent(slug)}')));

  Future<SlotWeek> slots(String slug, {required int duration, String? start}) async =>
      SlotWeek.fromJson(asJson(await client.get('/ogretmenler/${Uri.encodeComponent(slug)}/saatler', query: {'duration': duration, 'start': start})));

  // ---------------------------------------------------------------- oturum ve hesap

  Future<AuthResult> login({required String identifier, required String password, String? deviceName}) async {
    final json = asJson(await client.post('/oturum', data: {'identifier': identifier, 'password': password, 'deviceName': ?deviceName}));
    return AuthResult(token: asString(json['token']), me: Me.fromJson(asJson(json['user'])));
  }

  Future<AuthResult> register({
    required String firstName,
    required String lastName,
    required String email,
    String? phone,
    required String password,
    required String accountType,
    required bool kvkk,
    required bool terms,
    bool marketing = false,
    String? deviceName,
    String? referralCode,
  }) async {
    final json = asJson(await client.post('/kayit', data: {
      'firstName': firstName,
      'lastName': lastName,
      'email': email,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
      'password': password,
      'accountType': accountType,
      'kvkk': kvkk,
      'terms': terms,
      'marketing': marketing,
      'deviceName': ?deviceName,
      if (referralCode != null && referralCode.trim().isNotEmpty) 'referralCode': referralCode.trim(),
    }));
    return AuthResult(token: asString(json['token']), me: Me.fromJson(asJson(json['user'])));
  }

  Future<String> forgotPassword(String email) async => asString(asJson(await client.post('/sifremi-unuttum', data: {'email': email}))['message']);

  Future<Me> me() async => Me.fromJson(asJson(await client.get('/ben')));

  Future<Me> updateMe(Json changes) async => Me.fromJson(asJson(await client.patch('/ben', data: changes)));

  Future<String> changePassword({required String current, required String next}) async =>
      asString(asJson(await client.post('/ben/sifre', data: {'currentPassword': current, 'newPassword': next}))['message']);

  Future<String> requestDeletion(String? reason) async =>
      asString(asJson(await client.post('/ben/silme-talebi', data: {if (reason != null && reason.isNotEmpty) 'reason': reason}))['message']);

  Future<void> logout({String? pushToken}) => client.delete<Object?>('/oturum', query: {'cihaz': pushToken});

  // ---------------------------------------------------------------- randevular

  Future<BookingPage> bookings(String scope, {int page = 1}) async =>
      BookingPage.fromJson(asJson(await client.get('/rezervasyonlar', query: {'kapsam': scope, 'sayfa': page})));

  Future<BookingDetail> booking(String id) async => BookingDetail.fromJson(asJson(await client.get('/rezervasyonlar/$id')));

  Future<CheckoutResult> createBooking(BookingRequest request) async =>
      CheckoutResult.fromJson(asJson(await client.post('/rezervasyonlar', data: request.toJson())));

  Future<CheckoutResult> createQuestion({
    required String offeringId,
    required String learnerName,
    String? learnerGrade,
    String? note,
    required UploadFile image,
    void Function(int sent, int total)? onProgress,
  }) async {
    final form = FormData.fromMap({
      'offeringId': offeringId,
      'learnerName': learnerName,
      if (learnerGrade != null && learnerGrade.isNotEmpty) 'learnerGrade': learnerGrade,
      if (note != null && note.isNotEmpty) 'note': note,
      'consent': 'true',
      'image': await image.toMultipart(),
    });
    return CheckoutResult.fromJson(asJson(await client.postMultipart('/rezervasyonlar/soru', form, onProgress: onProgress)));
  }

  Future<PaymentLink> retryPayment(String id) async => PaymentLink.fromJson(asJson(asJson(await client.post('/rezervasyonlar/$id/odeme'))['payment']));

  Future<BookingDetail> cancel(String id, String reason) async => BookingDetail.fromJson(asJson(await client.post('/rezervasyonlar/$id/iptal', data: {'reason': reason})));

  Future<BookingDetail> dispute(String id, String reason) async => BookingDetail.fromJson(asJson(await client.post('/rezervasyonlar/$id/sorun', data: {'reason': reason})));

  Future<BookingDetail> review(String id, {required int rating, String? comment}) async =>
      BookingDetail.fromJson(asJson(await client.post('/rezervasyonlar/$id/degerlendirme', data: {'rating': rating, 'comment': ?comment})));

  Future<BookingDetail> approve(String id) async => BookingDetail.fromJson(asJson(await client.post('/rezervasyonlar/$id/onay')));

  Future<BookingDetail> reject(String id, String reason) async => BookingDetail.fromJson(asJson(await client.post('/rezervasyonlar/$id/red', data: {'reason': reason})));

  /// Web panelinin bir sayfası için tek kullanımlık, oturum açan bağlantı (WebView'da açılır):
  /// öğretmen paneli sayfaları ya da kurum personeli için /kurum ve alt sayfaları.
  Future<String> teacherPanelLink(String path) async => asString(asJson(await client.post('/web-oturum', data: {'path': path}))['url']);

  Future<ClassroomAccess> classroom(String id) async => ClassroomAccess.fromJson(asJson(await client.get('/rezervasyonlar/$id/sinif')));

  /// Onaylı dersin takvim dosyası (.ics metni).
  Future<String> calendarFile(String id) async {
    final data = await client.get<Object?>('/rezervasyonlar/$id/takvim');
    return data is String ? data : '';
  }

  Future<BookingDetail> sendQuestionMessage(String id, {String? body, UploadFile? image, UploadFile? video, bool isSolution = false, void Function(int, int)? onProgress}) async {
    final form = FormData.fromMap({
      if (body != null && body.isNotEmpty) 'body': body,
      if (image != null) 'image': await image.toMultipart(),
      if (video != null) 'video': await video.toMultipart(),
      if (isSolution) 'isSolution': 'true',
    });
    return BookingDetail.fromJson(asJson(await client.postMultipart('/rezervasyonlar/$id/mesajlar', form, onProgress: onProgress)));
  }

  // ---------------------------------------------------------------- soru kredisi ve soru havuzu (veli/öğrenci)

  Future<Credits> credits() async => Credits.fromJson(asJson(await client.get('/krediler')));

  /// Kredi paketi satın alma: ödeme sayfası WebView'da açılır, dönüşte [creditPurchase] sorgulanır.
  Future<(CreditPurchase, PaymentLink)> buyCredits(int credits, {String? couponCode}) async {
    final json = asJson(await client.post('/krediler', data: {'credits': credits, 'consent': true, if (couponCode != null && couponCode.trim().isNotEmpty) 'couponCode': couponCode.trim()}));
    return (CreditPurchase.fromJson(asJson(json['purchase'])), PaymentLink.fromJson(asJson(json['payment'])));
  }

  Future<CreditPurchase> creditPurchase(String id) async => CreditPurchase.fromJson(asJson(await client.get('/krediler/$id')));

  Future<String> refundCredits(String id) async => asString(asJson(await client.post('/krediler/$id/iade'))['message']);

  Future<PoolQuestionPage> myQuestions({int page = 1}) async => PoolQuestionPage.fromJson(asJson(await client.get('/sorular', query: {'sayfa': page})));

  Future<PoolQuestion> askQuestion({required PoolSubject subject, String? note, required UploadFile image, void Function(int, int)? onProgress}) async {
    final form = FormData.fromMap({
      'levelId': subject.levelId.toString(),
      'subjectId': subject.subjectId.toString(),
      if (note != null && note.isNotEmpty) 'note': note,
      'image': await image.toMultipart(),
    });
    return PoolQuestion.fromJson(asJson(await client.postMultipart('/sorular', form, onProgress: onProgress)));
  }

  Future<PoolQuestion> myQuestion(String id) async => PoolQuestion.fromJson(asJson(await client.get('/sorular/$id')));

  /// action: cancel · followUp {body} · rate {rating} · dispute {reason}
  Future<PoolQuestion> questionAction(String id, String action, [Json extra = const {}]) async =>
      PoolQuestion.fromJson(asJson(await client.post('/sorular/$id', data: {'action': action, ...extra})));

  // ---------------------------------------------------------------- soru havuzu (öğretmen)

  Future<TeacherPool> teacherPool() async => TeacherPool.fromJson(asJson(await client.get('/ogretmen/soru-havuzu')));

  Future<TeacherPool> setAnswersPool(bool on) async => TeacherPool.fromJson(asJson(await client.put('/ogretmen/soru-havuzu', data: {'answersPool': on})));

  Future<PoolQuestion> poolQuestion(String id) async => PoolQuestion.fromJson(asJson(await client.get('/ogretmen/soru-havuzu/$id')));

  /// action: claim · release · reject {reason} · followUpAnswer {body}. "release" sonrası soru null döner.
  Future<PoolQuestion?> poolAction(String id, String action, [Json extra = const {}]) async {
    final json = asJson(await client.post('/ogretmen/soru-havuzu/$id', data: {'action': action, ...extra}));
    return json['id'] == null ? null : PoolQuestion.fromJson(json);
  }

  Future<PoolQuestion> answerPoolQuestion(String id, {required String body, UploadFile? image, UploadFile? video, void Function(int, int)? onProgress}) async {
    final form = FormData.fromMap({
      'body': body,
      if (image != null) 'image': await image.toMultipart(),
      if (video != null) 'video': await video.toMultipart(),
    });
    return PoolQuestion.fromJson(asJson(await client.postMultipart('/ogretmen/soru-havuzu/$id', form, onProgress: onProgress)));
  }

  // ---------------------------------------------------------------- mesajlar

  Future<(List<ThreadSummary>, int)> threads() async {
    final json = asJson(await client.get('/mesajlar'));
    return (asList(json['items'], ThreadSummary.fromJson), asInt(json['unread']));
  }

  Future<MessageThread> thread(String id) async => MessageThread.fromJson(asJson(await client.get('/mesajlar/$id')));

  Future<MessageThread> sendMessage(String id, String body) async => MessageThread.fromJson(asJson(await client.post('/mesajlar/$id', data: {'body': body})));

  /// Öğretmene ilk mesaj (konuşma yoksa açılır).
  Future<MessageThread> messageTeacher(String slug, String body) async =>
      MessageThread.fromJson(asJson(await client.post('/ogretmenler/${Uri.encodeComponent(slug)}/mesaj', data: {'body': body})));

  // ---------------------------------------------------------------- indirim kodu, davet, öğretmen talebi

  /// target: booking (ref: offeringId, duration) · credits (credits) · subscription (ref: planId) · group (ref: courseId)
  Future<CouponCheck> checkCoupon({required String target, required String code, String? ref, int? duration, int? credits}) async =>
      CouponCheck.fromJson(asJson(await client.post('/indirim-kodu', data: {'target': target, 'code': code, 'ref': ?ref, 'duration': ?duration, 'credits': ?credits})));

  Future<InviteInfo> invite() async => InviteInfo.fromJson(asJson(await client.get('/davet')));

  Future<String> lessonRequest(Json data) async => asString(asJson(await client.post('/ogretmen-talebi', data: data))['message']);

  // ---------------------------------------------------------------- erteleme

  /// action: request {newStartAt, note?} · accept / decline / cancel {requestId}
  Future<BookingDetail> reschedule(String bookingId, String action, {DateTime? newStartAt, String? note, String? requestId}) async => BookingDetail.fromJson(asJson(await client.post(
        '/rezervasyonlar/$bookingId/erteleme',
        data: {'action': action, if (newStartAt != null) 'newStartAt': newStartAt.toUtc().toIso8601String(), if (note != null && note.isNotEmpty) 'note': note, 'requestId': ?requestId},
      )));

  // ---------------------------------------------------------------- paket ders

  Future<List<LessonPackage>> packages() async => asList(asJson(await client.get('/paketler'))['items'], LessonPackage.fromJson);

  Future<(LessonPackage, PaymentLink)> buyPackage({required String offeringId, required int durationMinutes, int? lessons, Json? recurring}) async {
    final json = asJson(await client.post('/paketler', data: {'offeringId': offeringId, 'durationMinutes': durationMinutes, 'lessons': ?lessons, 'recurring': ?recurring, 'consent': true}));
    return (LessonPackage.fromJson(asJson(json['package'])), PaymentLink.fromJson(asJson(json['payment'])));
  }

  Future<LessonPackage> package(String id) async => LessonPackage.fromJson(asJson(await client.get('/paketler/$id')));

  Future<String> refundPackage(String id) async => asString(asJson(await client.post('/paketler/$id'))['message']);

  /// Öğretmen: paketin (düzenli dersin) bekleyen tüm taleplerini onaylar → onaylanan sayısı.
  Future<int> approvePackageBookings(String packageId) async => asInt(asJson(await client.post('/ogretmen/paketler/$packageId'))['approved']);

  // ---------------------------------------------------------------- aylık soru aboneliği

  Future<List<QuestionSubscription>> subscriptions() async => asList(asJson(await client.get('/abonelikler'))['items'], QuestionSubscription.fromJson);

  Future<(QuestionSubscription, PaymentLink)> subscribe(String planId, {String? couponCode}) async {
    final json = asJson(await client.post('/abonelikler', data: {'planId': planId, 'consent': true, if (couponCode != null && couponCode.trim().isNotEmpty) 'couponCode': couponCode.trim()}));
    return (QuestionSubscription.fromJson(asJson(json['subscription'])), PaymentLink.fromJson(asJson(json['payment'])));
  }

  Future<QuestionSubscription> subscription(String id) async => QuestionSubscription.fromJson(asJson(await client.get('/abonelikler/$id')));

  Future<PoolQuestion> askSubscriptionQuestion(String id, {String? note, required UploadFile image, void Function(int, int)? onProgress}) async {
    final form = FormData.fromMap({if (note != null && note.isNotEmpty) 'note': note, 'image': await image.toMultipart()});
    return PoolQuestion.fromJson(asJson(await client.postMultipart('/abonelikler/$id', form, onProgress: onProgress)));
  }

  // ---------------------------------------------------------------- grup dersi

  Future<(bool, List<GroupCourse>)> groupCourses() async {
    final json = asJson(await client.get('/grup-dersleri'));
    return (asBool(json['enabled'], true), asList(json['items'], GroupCourse.fromJson));
  }

  Future<GroupCourse> groupCourse(String code) async => GroupCourse.fromJson(asJson(await client.get('/grup-dersleri/${Uri.encodeComponent(code)}')));

  /// Öğrencinin kayıtları.
  Future<List<MyGroupEnrollment>> myGroups() async => asList(asJson(await client.get('/grup-dersleri', query: {'kapsam': 'benim'}))['items'], MyGroupEnrollment.fromJson);

  /// Öğretmenin kendi grup dersleri.
  Future<List<GroupCourse>> teacherGroups() async => asList(asJson(await client.get('/grup-dersleri', query: {'kapsam': 'benim'}))['items'], GroupCourse.fromJson);

  Future<(GroupEnrollmentInfo, PaymentLink)> enrollGroup(String code, {String? learnerName, String? couponCode}) async {
    final json = asJson(await client.post('/grup-dersleri/${Uri.encodeComponent(code)}', data: {
      'consent': true,
      if (learnerName != null && learnerName.trim().isNotEmpty) 'learnerName': learnerName.trim(),
      if (couponCode != null && couponCode.trim().isNotEmpty) 'couponCode': couponCode.trim(),
    }));
    final e = asJson(json['enrollment']);
    return (GroupEnrollmentInfo(id: asString(e['id']), code: asString(e['code']), status: 'PENDING_PAYMENT', statusLabel: 'Ödeme bekleniyor', price: asInt(e['price'])), PaymentLink.fromJson(asJson(json['payment'])));
  }

  Future<GroupEnrollmentInfo> groupEnrollment(String id) async => GroupEnrollmentInfo.fromJson(asJson(await client.get('/grup-kayitlari/$id')));

  Future<GroupEnrollmentInfo> cancelGroupEnrollment(String id) async => GroupEnrollmentInfo.fromJson(asJson(await client.delete<Object?>('/grup-kayitlari/$id')));

  Future<ClassroomAccess> groupClassroom(String sessionId) async => ClassroomAccess.fromJson(asJson(await client.get('/grup-oturumlari/$sessionId/sinif')));

  // ---------------------------------------------------------------- favoriler, bildirimler, cihazlar

  Future<List<FavoriteTeacher>> favorites() async => asList(asJson(await client.get('/favoriler'))['items'], FavoriteTeacher.fromJson);

  Future<bool> setFavorite(String teacherUserId, bool favorite) async {
    final json = asJson(favorite ? await client.post('/favoriler/$teacherUserId') : await client.delete('/favoriler/$teacherUserId'));
    return asBool(json['isFavorite']);
  }

  /// side: kurum | ozel (iki taraflı hesapta yalnızca o tarafın bildirimleri)
  Future<NotificationPage> notifications({int page = 1, String? side}) async =>
      NotificationPage.fromJson(asJson(await client.get('/bildirimler', query: {'sayfa': page, 'taraf': ?side})));

  Future<int> markNotificationsRead([List<String>? ids, String? side]) async =>
      asInt(asJson(await client.post('/bildirimler/okundu', data: {'ids': ?ids, 'taraf': ?side}))['unread']);

  Future<void> registerDevice(String token, String platform) => client.post<Object?>('/cihazlar', data: {'token': token, 'platform': platform});

  Future<void> deleteDevice(String token) => client.delete<Object?>('/cihazlar/${Uri.encodeComponent(token)}');

  // ---------------------------------------------------------------- kurum (veli portalı)

  Future<List<CenterLink>> centerLinks() async => asList(asJson(await client.get('/kurum'))['items'], CenterLink.fromJson);

  Future<CenterChild> centerChild(String id) async => CenterChild.fromJson(asJson(await client.get('/kurum/$id')));

  Future<ReportCard> reportCard(String id, String examId) async => ReportCard.fromJson(asJson(await client.get('/kurum/$id/deneme/$examId')));

  Future<String> askCenterQuestion(String id, {required String subject, String? note, required UploadFile image, void Function(int, int)? onProgress}) async {
    final form = FormData.fromMap({
      'subject': subject,
      if (note != null && note.isNotEmpty) 'note': note,
      'image': await image.toMultipart(),
    });
    return asString(asJson(await client.postMultipart('/kurum/$id/sorular', form, onProgress: onProgress))['id']);
  }

  Future<void> withdrawCenterQuestion(String id, String questionId) => client.delete<Object?>('/kurum/$id/sorular/$questionId');

  Future<String> acceptInvite(String token) async => asString(asJson(await client.post('/kurum/davet', data: {'token': token}))['id']);

  Future<void> unlinkCenter(String id) => client.delete<Object?>('/kurum/$id');

  Future<StudyWeek> study(String id, {String? week}) async => StudyWeek.fromJson(asJson(await client.get('/kurum/$id/calisma', query: {'hafta': week})));

  Future<void> setPlanItemDone(String id, String itemId, bool done) => client.post<Object?>('/kurum/$id/calisma/$itemId', data: {'done': done});

  Future<void> saveResourceProgress(String id, String resourceId, List<ProgressRow> rows) =>
      client.put<Object?>('/kurum/$id/kaynaklar/$resourceId', data: {'rows': rows.map((r) => r.toJson()).toList()});

  // ---------------------------------------------------------------- öğretmen

  Future<TeacherSummary> teacherSummary() async => TeacherSummary.fromJson(asJson(await client.get('/ogretmen/ozet')));

  Future<Earnings> earnings() async => Earnings.fromJson(asJson(await client.get('/ogretmen/kazanclar')));

  Future<TeacherCalendar> teacherCalendar() async => TeacherCalendar.fromJson(asJson(await client.get('/ogretmen/takvim')));

  Future<TeacherCalendar> saveCalendar(List<AvailabilityRule> rules, int bufferMinutes) async => TeacherCalendar.fromJson(
        asJson(await client.put('/ogretmen/takvim', data: {'rules': rules.map((r) => r.toJson()).toList(), 'bufferMinutes': bufferMinutes})),
      );

  Future<void> addAvailabilityException({required String date, required String kind, String? start, String? end, String? note}) => client.post<Object?>(
        '/ogretmen/izinler',
        data: {'date': date, 'kind': kind, 'start': ?start, 'end': ?end, if (note != null && note.isNotEmpty) 'note': note},
      );

  Future<void> deleteAvailabilityException(String id) => client.delete<Object?>('/ogretmen/izinler/$id');

  Future<List<Review>> teacherReviews() async => asList(asJson(await client.get('/ogretmen/yorumlar'))['items'], Review.fromJson);

  Future<void> replyToReview(String id, String reply) => client.post<Object?>('/yorumlar/$id/cevap', data: {'reply': reply});
}
