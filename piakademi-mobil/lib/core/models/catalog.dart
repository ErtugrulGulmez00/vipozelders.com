import 'json.dart';

/// Açılışta bir kez alınan sabit veriler (`GET /katalog`).
class Catalog {
  const Catalog({
    required this.site,
    required this.maintenance,
    required this.rules,
    required this.levels,
    required this.subjects,
    required this.services,
    required this.cities,
    required this.sortOptions,
    required this.timeOptions,
    required this.pages,
    required this.paymentReturnPrefix,
  });

  final SiteInfo site;
  final Maintenance maintenance;
  final Rules rules;
  final List<Level> levels;
  final List<Subject> subjects;
  final List<Service> services;
  final List<City> cities;
  final List<Option> sortOptions;
  final List<Option> timeOptions;
  final List<LegalPage> pages;
  final String paymentReturnPrefix;

  factory Catalog.fromJson(Json json) => Catalog(
        site: SiteInfo.fromJson(asJson(json['site'])),
        maintenance: Maintenance.fromJson(asJson(json['maintenance'])),
        rules: Rules.fromJson(asJson(json['rules'])),
        levels: asList(json['levels'], Level.fromJson),
        subjects: asList(json['subjects'], Subject.fromJson),
        services: asList(json['services'], Service.fromJson),
        cities: asList(json['cities'], City.fromJson),
        sortOptions: asList(json['sortOptions'], Option.fromJson),
        timeOptions: asList(json['timeOptions'], Option.fromJson),
        pages: asList(json['pages'], LegalPage.fromJson),
        paymentReturnPrefix: asString(json['paymentReturnPrefix']),
      );

  Level? levelBySlug(String? slug) => _firstWhere(levels, (l) => l.slug == slug);
  Subject? subjectBySlug(String? slug) => _firstWhere(subjects, (s) => s.slug == slug);
  Service? serviceBySlug(String? slug) => _firstWhere(services, (s) => s.slug == slug);
  City? cityBySlug(String? slug) => _firstWhere(cities, (c) => c.slug == slug);
  City? cityById(int? id) => _firstWhere(cities, (c) => c.id == id);
  LegalPage? page(String slug) => _firstWhere(pages, (p) => p.slug == slug);

  /// Kademede okutulan dersler (kademe seçilmemişse hepsi).
  List<Subject> subjectsFor(Level? level) =>
      level == null ? subjects : subjects.where((s) => level.subjectIds.contains(s.id)).toList();

  static T? _firstWhere<T>(List<T> items, bool Function(T) test) {
    for (final item in items) {
      if (test(item)) return item;
    }
    return null;
  }
}

class SiteInfo {
  const SiteInfo({required this.name, required this.tagline, this.contactEmail, this.contactPhone, required this.url});

  final String name;
  final String tagline;
  final String? contactEmail;
  final String? contactPhone;
  final String url;

  factory SiteInfo.fromJson(Json json) => SiteInfo(
        name: asString(json['name'], 'Pi Kampüs'),
        tagline: asString(json['tagline']),
        contactEmail: asStringOrNull(json['contactEmail']),
        contactPhone: asStringOrNull(json['contactPhone']),
        url: asString(json['url']),
      );
}

class Maintenance {
  const Maintenance({required this.on, this.message});

  final bool on;
  final String? message;

  factory Maintenance.fromJson(Json json) => Maintenance(on: asBool(json['on']), message: asStringOrNull(json['message']));
}

/// Site kuralları (yönetim panelinden değişir).
class Rules {
  const Rules({
    this.paymentHoldMinutes = 15,
    this.approvalWindowHours = 12,
    this.minNoticeHours = 12,
    this.maxAdvanceDays = 30,
    this.classroomOpensMinutesBefore = 10,
    this.fullRefundHours = 24,
    this.partialRefundHours = 2,
    this.partialRefundPercent = 50,
    this.disputeWindowHours = 48,
    this.reviewWindowDays = 30,
    this.questionAnswerHours = 24,
  });

  final int paymentHoldMinutes;
  final int approvalWindowHours;
  final int minNoticeHours;
  final int maxAdvanceDays;
  final int classroomOpensMinutesBefore;
  final int fullRefundHours;
  final int partialRefundHours;
  final int partialRefundPercent;
  final int disputeWindowHours;
  final int reviewWindowDays;
  final int questionAnswerHours;

  factory Rules.fromJson(Json json) => Rules(
        paymentHoldMinutes: asInt(json['paymentHoldMinutes'], 15),
        approvalWindowHours: asInt(json['approvalWindowHours'], 12),
        minNoticeHours: asInt(json['minNoticeHours'], 12),
        maxAdvanceDays: asInt(json['maxAdvanceDays'], 30),
        classroomOpensMinutesBefore: asInt(json['classroomOpensMinutesBefore'], 10),
        fullRefundHours: asInt(json['fullRefundHours'], 24),
        partialRefundHours: asInt(json['partialRefundHours'], 2),
        partialRefundPercent: asInt(json['partialRefundPercent'], 50),
        disputeWindowHours: asInt(json['disputeWindowHours'], 48),
        reviewWindowDays: asInt(json['reviewWindowDays'], 30),
        questionAnswerHours: asInt(json['questionAnswerHours'], 24),
      );
}

class Level {
  const Level({required this.id, required this.name, required this.slug, required this.group, this.grades = const [], this.subjectIds = const []});

  final int id;
  final String name;
  final String slug;

  /// SCHOOL, EXAM, OTHER
  final String group;
  final List<Grade> grades;
  final List<int> subjectIds;

  factory Level.fromJson(Json json) => Level(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        group: asString(json['group'], 'OTHER'),
        grades: asList(json['grades'], Grade.fromJson),
        subjectIds: (json['subjectIds'] is List) ? (json['subjectIds'] as List).map((e) => asInt(e)).toList() : const [],
      );
}

const levelGroupLabels = {'SCHOOL': 'Okul dersleri', 'EXAM': 'Sınav hazırlık', 'OTHER': 'Diğer'};

class Grade {
  const Grade({required this.id, required this.name});

  final int id;
  final String name;

  factory Grade.fromJson(Json json) => Grade(id: asInt(json['id']), name: asString(json['name']));
}

class Subject {
  const Subject({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory Subject.fromJson(Json json) => Subject(id: asInt(json['id']), name: asString(json['name']), slug: asString(json['slug']));
}

class Service {
  const Service({required this.id, required this.name, required this.slug, this.description});

  final int id;
  final String name;
  final String slug;
  final String? description;

  factory Service.fromJson(Json json) => Service(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        description: asStringOrNull(json['description']),
      );
}

class City {
  const City({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory City.fromJson(Json json) => City(id: asInt(json['id']), name: asString(json['name']), slug: asString(json['slug']));
}

class District {
  const District({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory District.fromJson(Json json) => District(id: asInt(json['id']), name: asString(json['name']), slug: asString(json['slug']));
}

class Option {
  const Option({required this.value, required this.label});

  final String value;
  final String label;

  factory Option.fromJson(Json json) => Option(value: asString(json['value']), label: asString(json['label']));
}

class LegalPage {
  const LegalPage({required this.slug, required this.title, required this.url});

  final String slug;
  final String title;
  final String url;

  factory LegalPage.fromJson(Json json) => LegalPage(slug: asString(json['slug']), title: asString(json['title']), url: asString(json['url']));
}
