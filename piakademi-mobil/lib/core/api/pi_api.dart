import 'package:dio/dio.dart';

import '../models/booking.dart';
import '../models/catalog.dart';
import '../models/center.dart';
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
        'q': (q?.trim().isEmpty ?? true) ? null : q!.trim(),
        'sort': sort,
        'page': page,
      };

  /// Sıralama ve arama metni dışında seçili filtre sayısı.
  int get activeFilters => [level, subject, service, mode, city, district, minPrice, maxPrice, rating, gender, time].where((v) => v != null).length + (verified ? 1 : 0);

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
        if (intro) 'intro': true else 'consent': true,
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

  /// Öğretmen web panelinin bir sayfası için tek kullanımlık, oturum açan bağlantı (WebView'da açılır).
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
  Future<(CreditPurchase, PaymentLink)> buyCredits(int credits) async {
    final json = asJson(await client.post('/krediler', data: {'credits': credits, 'consent': true}));
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

  // ---------------------------------------------------------------- favoriler, bildirimler, cihazlar

  Future<List<FavoriteTeacher>> favorites() async => asList(asJson(await client.get('/favoriler'))['items'], FavoriteTeacher.fromJson);

  Future<bool> setFavorite(String teacherUserId, bool favorite) async {
    final json = asJson(favorite ? await client.post('/favoriler/$teacherUserId') : await client.delete('/favoriler/$teacherUserId'));
    return asBool(json['isFavorite']);
  }

  Future<NotificationPage> notifications({int page = 1}) async => NotificationPage.fromJson(asJson(await client.get('/bildirimler', query: {'sayfa': page})));

  Future<int> markNotificationsRead([List<String>? ids]) async =>
      asInt(asJson(await client.post('/bildirimler/okundu', data: {'ids': ?ids}))['unread']);

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
