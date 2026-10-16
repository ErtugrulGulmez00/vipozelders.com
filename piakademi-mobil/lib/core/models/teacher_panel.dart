import 'booking.dart';
import 'json.dart';

class Balances {
  const Balances({this.pending = 0, this.available = 0, this.paid = 0});

  final int pending;
  final int available;
  final int paid;

  factory Balances.fromJson(Json json) => Balances(pending: asInt(json['pending']), available: asInt(json['available']), paid: asInt(json['paid']));
}

class ChecklistItem {
  const ChecklistItem({required this.key, required this.label, required this.done});

  final String key;
  final String label;
  final bool done;

  factory ChecklistItem.fromJson(Json json) => ChecklistItem(key: asString(json['key']), label: asString(json['label']), done: asBool(json['done']));
}

/// Öğretmen ana ekranı (`GET /ogretmen/ozet`).
class TeacherSummary {
  const TeacherSummary({
    required this.profileStatus,
    this.checklist = const [],
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.completedLessons = 0,
    this.balances = const Balances(),
    this.pendingRequests = const [],
    this.upcoming = const [],
  });

  final String profileStatus;
  final List<ChecklistItem> checklist;
  final double ratingAvg;
  final int ratingCount;
  final int completedLessons;
  final Balances balances;
  final List<BookingSummary> pendingRequests;
  final List<BookingSummary> upcoming;

  bool get published => profileStatus == 'PUBLISHED';
  List<ChecklistItem> get missing => checklist.where((c) => !c.done).toList();

  factory TeacherSummary.fromJson(Json json) => TeacherSummary(
        profileStatus: asString(json['profileStatus']),
        checklist: asList(json['checklist'], ChecklistItem.fromJson),
        ratingAvg: asDouble(json['ratingAvg']),
        ratingCount: asInt(json['ratingCount']),
        completedLessons: asInt(json['completedLessons']),
        balances: Balances.fromJson(asJson(json['balances'])),
        pendingRequests: asList(json['pendingRequests'], BookingSummary.fromJson),
        upcoming: asList(json['upcoming'], BookingSummary.fromJson),
      );
}

class LedgerEntry {
  const LedgerEntry({required this.id, required this.bucket, required this.bucketLabel, required this.amount, this.description, this.bookingId, this.bookingCode, required this.createdAt});

  final String id;
  final String bucket;
  final String bucketLabel;
  final int amount;
  final String? description;
  final String? bookingId;
  final String? bookingCode;
  final DateTime createdAt;

  factory LedgerEntry.fromJson(Json json) => LedgerEntry(
        id: asString(json['id']),
        bucket: asString(json['bucket']),
        bucketLabel: asString(json['bucketLabel']),
        amount: asInt(json['amount']),
        description: asStringOrNull(json['description']),
        bookingId: asStringOrNull(json['bookingId']),
        bookingCode: asStringOrNull(json['bookingCode']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class Payout {
  const Payout({required this.id, required this.amount, this.method, this.reference, required this.createdAt});

  final String id;
  final int amount;
  final String? method;
  final String? reference;
  final DateTime createdAt;

  factory Payout.fromJson(Json json) => Payout(
        id: asString(json['id']),
        amount: asInt(json['amount']),
        method: asStringOrNull(json['method']),
        reference: asStringOrNull(json['reference']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class PayoutAccount {
  const PayoutAccount({this.legalName, required this.ibanMasked});

  final String? legalName;
  final String ibanMasked;

  factory PayoutAccount.fromJson(Json json) => PayoutAccount(legalName: asStringOrNull(json['legalName']), ibanMasked: asString(json['ibanMasked']));
}

/// Kazançlar (`GET /ogretmen/kazanclar`).
class Earnings {
  const Earnings({this.balances = const Balances(), this.payoutAccount, this.entries = const [], this.payouts = const []});

  final Balances balances;
  final PayoutAccount? payoutAccount;
  final List<LedgerEntry> entries;
  final List<Payout> payouts;

  factory Earnings.fromJson(Json json) => Earnings(
        balances: Balances.fromJson(asJson(json['balances'])),
        payoutAccount: json['payoutAccount'] is Map ? PayoutAccount.fromJson(asJson(json['payoutAccount'])) : null,
        entries: asList(json['entries'], LedgerEntry.fromJson),
        payouts: asList(json['payouts'], Payout.fromJson),
      );
}

/// Haftalık müsaitlik aralığı (weekday 1 = Pazartesi … 7 = Pazar, saatler "HH:MM").
class AvailabilityRule {
  const AvailabilityRule({required this.weekday, required this.start, required this.end});

  final int weekday;
  final String start;
  final String end;

  Json toJson() => {'weekday': weekday, 'start': start, 'end': end};

  factory AvailabilityRule.fromJson(Json json) => AvailabilityRule(weekday: asInt(json['weekday']), start: asString(json['start']), end: asString(json['end']));
}

/// İzin / ek saat (kind: BLOCKED_DAY, BLOCKED, EXTRA).
class AvailabilityException {
  const AvailabilityException({required this.id, required this.date, required this.kind, this.start, this.end, this.note});

  final String id;
  final String date;
  final String kind;
  final String? start;
  final String? end;
  final String? note;

  factory AvailabilityException.fromJson(Json json) => AvailabilityException(
        id: asString(json['id']),
        date: asString(json['date']),
        kind: asString(json['kind']),
        start: asStringOrNull(json['start']),
        end: asStringOrNull(json['end']),
        note: asStringOrNull(json['note']),
      );
}

class TeacherCalendar {
  const TeacherCalendar({this.bufferMinutes = 0, this.bufferOptions = const [0, 5, 10, 15, 30], this.rules = const [], this.exceptions = const []});

  final int bufferMinutes;
  final List<int> bufferOptions;
  final List<AvailabilityRule> rules;
  final List<AvailabilityException> exceptions;

  factory TeacherCalendar.fromJson(Json json) => TeacherCalendar(
        bufferMinutes: asInt(json['bufferMinutes']),
        bufferOptions: json['bufferOptions'] is List ? (json['bufferOptions'] as List).map((e) => asInt(e)).toList() : const [0, 5, 10, 15, 30],
        rules: asList(json['rules'], AvailabilityRule.fromJson),
        exceptions: asList(json['exceptions'], AvailabilityException.fromJson),
      );
}
