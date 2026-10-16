import 'json.dart';

/// Arama sonucundaki öğretmen kartı.
class TeacherCard {
  const TeacherCard({
    required this.userId,
    required this.slug,
    required this.name,
    this.headline,
    this.photoUrl,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.completedLessons = 0,
    this.experienceYears,
    this.cityName,
    this.offersOnline = false,
    this.offersInPerson = false,
    this.verified = false,
    this.featured = false,
    this.minHourlyPrice,
    this.subjects = const [],
    this.avgResponseMinutes,
  });

  final String userId;
  final String slug;
  final String name;
  final String? headline;
  final String? photoUrl;
  final double ratingAvg;
  final int ratingCount;
  final int completedLessons;
  final int? experienceYears;
  final String? cityName;
  final bool offersOnline;
  final bool offersInPerson;
  final bool verified;
  final bool featured;

  /// Kuruş; dersi olmayan öğretmende null.
  final int? minHourlyPrice;
  final List<String> subjects;
  final int? avgResponseMinutes;

  factory TeacherCard.fromJson(Json json) => TeacherCard(
        userId: asString(json['userId']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        headline: asStringOrNull(json['headline']),
        photoUrl: asStringOrNull(json['photoUrl']),
        ratingAvg: asDouble(json['ratingAvg']),
        ratingCount: asInt(json['ratingCount']),
        completedLessons: asInt(json['completedLessons']),
        experienceYears: asIntOrNull(json['experienceYears']),
        cityName: asStringOrNull(json['cityName']),
        offersOnline: asBool(json['offersOnline']),
        offersInPerson: asBool(json['offersInPerson']),
        verified: asBool(json['verified']),
        featured: asBool(json['featured']),
        minHourlyPrice: asIntOrNull(json['minHourlyPrice']),
        subjects: asStringList(json['subjects']),
        avgResponseMinutes: asIntOrNull(json['avgResponseMinutes']),
      );
}

class TeacherPage {
  const TeacherPage({required this.items, required this.total, required this.page, required this.pageCount});

  final List<TeacherCard> items;
  final int total;
  final int page;
  final int pageCount;

  bool get hasMore => page < pageCount;

  factory TeacherPage.fromJson(Json json) => TeacherPage(
        items: asList(json['items'], TeacherCard.fromJson),
        total: asInt(json['total']),
        page: asInt(json['page'], 1),
        pageCount: asInt(json['pageCount'], 1),
      );
}

class NamedRef {
  const NamedRef({required this.id, required this.name, this.slug = ''});

  final int id;
  final String name;
  final String slug;

  factory NamedRef.fromJson(Json json) => NamedRef(id: asInt(json['id']), name: asString(json['name']), slug: asString(json['slug']));
}

class DurationPrice {
  const DurationPrice({required this.minutes, required this.price});

  final int minutes;
  final int price;

  factory DurationPrice.fromJson(Json json) => DurationPrice(minutes: asInt(json['minutes']), price: asInt(json['price']));
}

/// Öğretmenin verdiği bir ders (kademe + ders + hizmet) ve süreye göre fiyatları.
class Offering {
  const Offering({
    required this.id,
    required this.level,
    required this.subject,
    required this.service,
    required this.hourlyPrice,
    this.durations = const [],
    this.questionPrice,
  });

  final String id;
  final NamedRef level;
  final NamedRef subject;
  final NamedRef service;
  final int hourlyPrice;
  final List<DurationPrice> durations;

  /// Fotoğrafla soru kabul ediliyorsa soru başı ücret (kuruş).
  final int? questionPrice;

  String get title => '${level.name} ${subject.name}';
  bool get acceptsQuestions => questionPrice != null && questionPrice! > 0;

  factory Offering.fromJson(Json json) => Offering(
        id: asString(json['id']),
        level: NamedRef.fromJson(asJson(json['level'])),
        subject: NamedRef.fromJson(asJson(json['subject'])),
        service: NamedRef.fromJson(asJson(json['service'])),
        hourlyPrice: asInt(json['hourlyPrice']),
        durations: asList(json['durations'], DurationPrice.fromJson),
        questionPrice: asIntOrNull(json['questionPrice']),
      );
}

class Review {
  const Review({
    required this.id,
    required this.rating,
    this.comment,
    required this.studentName,
    required this.lesson,
    this.teacherReply,
    this.teacherRepliedAt,
    required this.createdAt,
    this.status,
  });

  final String id;
  final int rating;
  final String? comment;
  final String studentName;
  final String lesson;
  final String? teacherReply;
  final DateTime? teacherRepliedAt;
  final DateTime createdAt;

  /// Öğretmen görünümünde yorumun durumu (PUBLISHED, HIDDEN…)
  final String? status;

  factory Review.fromJson(Json json) => Review(
        id: asString(json['id']),
        rating: asInt(json['rating']),
        comment: asStringOrNull(json['comment']),
        studentName: asString(json['studentName']),
        lesson: asString(json['lesson']),
        teacherReply: asStringOrNull(json['teacherReply']),
        teacherRepliedAt: asDate(json['teacherRepliedAt']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
        status: asStringOrNull(json['status']),
      );
}

class ServiceDistrict {
  const ServiceDistrict({required this.id, required this.name, required this.cityId, required this.cityName});

  final int id;
  final String name;
  final int cityId;
  final String cityName;

  factory ServiceDistrict.fromJson(Json json) => ServiceDistrict(
        id: asInt(json['id']),
        name: asString(json['name']),
        cityId: asInt(json['cityId']),
        cityName: asString(json['cityName']),
      );
}

/// Öğretmen profili (`GET /ogretmenler/{slug}`).
class TeacherProfile {
  const TeacherProfile({
    required this.userId,
    required this.slug,
    required this.name,
    this.headline,
    this.bio,
    this.photoUrl,
    this.videoUrl,
    this.education,
    this.experienceYears,
    this.gender,
    this.verified = false,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.completedLessons = 0,
    this.avgResponseMinutes,
    this.offersOnline = false,
    this.offersInPerson = false,
    this.inPersonAtStudentHome = false,
    this.inPersonAtTeacherPlace = false,
    this.city,
    this.district,
    this.serviceDistricts = const [],
    this.offerings = const [],
    this.reviews = const [],
    this.isFavorite = false,
  });

  final String userId;
  final String slug;
  final String name;
  final String? headline;
  final String? bio;
  final String? photoUrl;
  final String? videoUrl;
  final String? education;
  final int? experienceYears;
  final String? gender;
  final bool verified;
  final double ratingAvg;
  final int ratingCount;
  final int completedLessons;
  final int? avgResponseMinutes;
  final bool offersOnline;
  final bool offersInPerson;
  final bool inPersonAtStudentHome;
  final bool inPersonAtTeacherPlace;
  final NamedRef? city;
  final NamedRef? district;
  final List<ServiceDistrict> serviceDistricts;
  final List<Offering> offerings;
  final List<Review> reviews;
  final bool isFavorite;

  int? get minHourlyPrice => offerings.isEmpty ? null : offerings.map((o) => o.hourlyPrice).reduce((a, b) => a < b ? a : b);
  bool get acceptsQuestions => offerings.any((o) => o.acceptsQuestions);

  factory TeacherProfile.fromJson(Json json) => TeacherProfile(
        userId: asString(json['userId']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        headline: asStringOrNull(json['headline']),
        bio: asStringOrNull(json['bio']),
        photoUrl: asStringOrNull(json['photoUrl']),
        videoUrl: asStringOrNull(json['videoUrl']),
        education: asStringOrNull(json['education']),
        experienceYears: asIntOrNull(json['experienceYears']),
        gender: asStringOrNull(json['gender']),
        verified: asBool(json['verified']),
        ratingAvg: asDouble(json['ratingAvg']),
        ratingCount: asInt(json['ratingCount']),
        completedLessons: asInt(json['completedLessons']),
        avgResponseMinutes: asIntOrNull(json['avgResponseMinutes']),
        offersOnline: asBool(json['offersOnline']),
        offersInPerson: asBool(json['offersInPerson']),
        inPersonAtStudentHome: asBool(json['inPersonAtStudentHome']),
        inPersonAtTeacherPlace: asBool(json['inPersonAtTeacherPlace']),
        city: json['city'] is Map ? NamedRef.fromJson(asJson(json['city'])) : null,
        district: json['district'] is Map ? NamedRef.fromJson(asJson(json['district'])) : null,
        serviceDistricts: asList(json['serviceDistricts'], ServiceDistrict.fromJson),
        offerings: asList(json['offerings'], Offering.fromJson),
        reviews: asList(json['reviews'], Review.fromJson),
        isFavorite: asBool(json['isFavorite']),
      );

  TeacherProfile copyWith({bool? isFavorite}) => TeacherProfile(
        userId: userId,
        slug: slug,
        name: name,
        headline: headline,
        bio: bio,
        photoUrl: photoUrl,
        videoUrl: videoUrl,
        education: education,
        experienceYears: experienceYears,
        gender: gender,
        verified: verified,
        ratingAvg: ratingAvg,
        ratingCount: ratingCount,
        completedLessons: completedLessons,
        avgResponseMinutes: avgResponseMinutes,
        offersOnline: offersOnline,
        offersInPerson: offersInPerson,
        inPersonAtStudentHome: inPersonAtStudentHome,
        inPersonAtTeacherPlace: inPersonAtTeacherPlace,
        city: city,
        district: district,
        serviceDistricts: serviceDistricts,
        offerings: offerings,
        reviews: reviews,
        isFavorite: isFavorite ?? this.isFavorite,
      );
}

class Slot {
  const Slot({required this.startAt, required this.endAt, required this.time, required this.available});

  final DateTime startAt;
  final DateTime endAt;
  final String time;
  final bool available;

  factory Slot.fromJson(Json json) => Slot(
        startAt: asDateOr(json['startAt'], DateTime.now()),
        endAt: asDateOr(json['endAt'], DateTime.now()),
        time: asString(json['time']),
        available: asBool(json['available']),
      );
}

class SlotDay {
  const SlotDay({required this.date, required this.weekday, required this.day, this.slots = const []});

  final String date;
  final String weekday;
  final String day;
  final List<Slot> slots;

  int get availableCount => slots.where((s) => s.available).length;

  factory SlotDay.fromJson(Json json) => SlotDay(
        date: asString(json['date']),
        weekday: asString(json['weekday']),
        day: asString(json['day']),
        slots: asList(json['slots'], Slot.fromJson),
      );
}

/// 7 günlük boş/dolu saatler.
class SlotWeek {
  const SlotWeek({required this.startDate, required this.durationMinutes, this.days = const []});

  final String startDate;
  final int durationMinutes;
  final List<SlotDay> days;

  factory SlotWeek.fromJson(Json json) => SlotWeek(
        startDate: asString(json['startDate']),
        durationMinutes: asInt(json['durationMinutes']),
        days: asList(json['days'], SlotDay.fromJson),
      );
}

/// Favori listesindeki öğretmen.
class FavoriteTeacher {
  const FavoriteTeacher({
    required this.userId,
    required this.slug,
    required this.name,
    this.headline,
    this.photoUrl,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.verified = false,
    this.minHourlyPrice,
    this.subjects = const [],
  });

  final String userId;
  final String slug;
  final String name;
  final String? headline;
  final String? photoUrl;
  final double ratingAvg;
  final int ratingCount;
  final bool verified;
  final int? minHourlyPrice;
  final List<String> subjects;

  TeacherCard toCard() => TeacherCard(
        userId: userId,
        slug: slug,
        name: name,
        headline: headline,
        photoUrl: photoUrl,
        ratingAvg: ratingAvg,
        ratingCount: ratingCount,
        verified: verified,
        minHourlyPrice: minHourlyPrice,
        subjects: subjects,
      );

  factory FavoriteTeacher.fromJson(Json json) => FavoriteTeacher(
        userId: asString(json['userId']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        headline: asStringOrNull(json['headline']),
        photoUrl: asStringOrNull(json['photoUrl']),
        ratingAvg: asDouble(json['ratingAvg']),
        ratingCount: asInt(json['ratingCount']),
        verified: asBool(json['verified']),
        minHourlyPrice: asIntOrNull(json['minHourlyPrice']),
        subjects: asStringList(json['subjects']),
      );
}
