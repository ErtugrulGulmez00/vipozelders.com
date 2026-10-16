import 'json.dart';

// Kurum (etüt merkezi / dershane) veli portalı. Tutarlar kuruş, günler "YYYY-MM-DD".

const attendanceLabels = {'PRESENT': 'Geldi', 'ABSENT': 'Gelmedi', 'LATE': 'Geç geldi', 'EXCUSED': 'İzinli'};
const homeworkLabels = {'PENDING': 'Kontrol edilmedi', 'DONE': 'Yaptı', 'PARTIAL': 'Eksik yaptı', 'MISSING': 'Yapmadı'};
const installmentLabels = {'paid': 'Ödendi', 'partial': 'Kısmen ödendi', 'overdue': 'Gecikti', 'due': 'Bugün', 'upcoming': 'Bekliyor'};
const questionStatusLabels = {'OPEN': 'Cevap bekliyor', 'ANSWERED': 'Çözüldü', 'IN_PERSON': 'Yüz yüze anlatılacak'};
const noteKindLabels = {'GENERAL': 'Genel not', 'GUIDANCE': 'Rehberlik görüşmesi', 'PARENT_MEETING': 'Veli görüşmesi', 'BEHAVIOR': 'Davranış'};
const paymentMethodLabels = {'CASH': 'Nakit', 'CARD': 'Kredi / banka kartı', 'TRANSFER': 'Havale / EFT', 'OTHER': 'Diğer'};
const etudStatusLabels = {'PLANNED': 'Planlandı', 'DONE': 'Yapıldı', 'CANCELLED': 'İptal'};
const examKindLabels = {
  'LGS': 'LGS',
  'TYT': 'TYT',
  'AYT_SAY': 'AYT Sayısal',
  'AYT_EA': 'AYT Eşit Ağırlık',
  'AYT_SOZ': 'AYT Sözel',
  'YDT': 'YDT',
  'CUSTOM': 'Deneme',
};

class CenterInfo {
  const CenterInfo({required this.name, this.phone, this.email, this.address, this.logoUrl});

  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final String? logoUrl;

  factory CenterInfo.fromJson(Json json) => CenterInfo(
        name: asString(json['name']),
        phone: asStringOrNull(json['phone']),
        email: asStringOrNull(json['email']),
        address: asStringOrNull(json['address']),
        logoUrl: asStringOrNull(json['logoUrl']),
      );
}

class CenterStudent {
  const CenterStudent({required this.firstName, required this.lastName, this.gradeName, this.studentNumber, this.groups = const []});

  final String firstName;
  final String lastName;
  final String? gradeName;
  final String? studentNumber;
  final List<String> groups;

  String get fullName => '$firstName $lastName';

  factory CenterStudent.fromJson(Json json) => CenterStudent(
        firstName: asString(json['firstName']),
        lastName: asString(json['lastName']),
        gradeName: asStringOrNull(json['gradeName']),
        studentNumber: asStringOrNull(json['studentNumber']),
        groups: asStringList(json['groups']),
      );
}

/// Veli portalı bağlantısı (`GET /kurum`). [id] bağlantı kimliğidir.
class CenterLink {
  const CenterLink({required this.id, this.relation, required this.student, required this.center});

  final String id;
  final String? relation;
  final CenterStudent student;
  final CenterInfo center;

  factory CenterLink.fromJson(Json json) => CenterLink(
        id: asString(json['id']),
        relation: asStringOrNull(json['relation']),
        student: CenterStudent.fromJson(asJson(json['student'])),
        center: CenterInfo.fromJson(asJson(json['center'])),
      );
}

class Balance {
  const Balance({this.total = 0, this.paid = 0, this.remaining = 0, this.overdue = 0});

  final int total;
  final int paid;
  final int remaining;
  final int overdue;

  factory Balance.fromJson(Json json) => Balance(
        total: asInt(json['total']),
        paid: asInt(json['paid']),
        remaining: asInt(json['remaining']),
        overdue: asInt(json['overdue']),
      );
}

class AttendanceRecord {
  const AttendanceRecord({required this.date, required this.startMinute, required this.subject, required this.group, required this.status});

  final String date;
  final int startMinute;
  final String subject;
  final String group;
  final String status;

  factory AttendanceRecord.fromJson(Json json) => AttendanceRecord(
        date: asString(json['date']),
        startMinute: asInt(json['startMinute']),
        subject: asString(json['subject']),
        group: asString(json['group']),
        status: asString(json['status']),
      );
}

class EtudRecord {
  const EtudRecord({required this.id, required this.date, required this.startMinute, required this.endMinute, required this.subject, this.topic, this.teacher, required this.status, this.attendance});

  final String id;
  final String date;
  final int startMinute;
  final int endMinute;
  final String subject;
  final String? topic;
  final String? teacher;
  final String status;
  final String? attendance;

  factory EtudRecord.fromJson(Json json) => EtudRecord(
        id: asString(json['id']),
        date: asString(json['date']),
        startMinute: asInt(json['startMinute']),
        endMinute: asInt(json['endMinute']),
        subject: asString(json['subject']),
        topic: asStringOrNull(json['topic']),
        teacher: asStringOrNull(json['teacher']),
        status: asString(json['status']),
        attendance: asStringOrNull(json['attendance']),
      );
}

class SectionNet {
  const SectionNet({required this.name, required this.questionCount, this.net});

  final String name;
  final int questionCount;
  final double? net;

  factory SectionNet.fromJson(Json json) => SectionNet(name: asString(json['name']), questionCount: asInt(json['questionCount']), net: asDoubleOrNull(json['net']));
}

class ExamResult {
  const ExamResult({
    required this.examId,
    required this.name,
    required this.kind,
    required this.date,
    required this.net,
    this.correct = 0,
    this.wrong = 0,
    this.blank = 0,
    this.rank,
    this.participants = 0,
    this.sections = const [],
  });

  final String examId;
  final String name;
  final String kind;
  final String date;
  final double net;
  final int correct;
  final int wrong;
  final int blank;
  final int? rank;
  final int participants;
  final List<SectionNet> sections;

  int get questionCount => sections.fold(0, (total, s) => total + s.questionCount);

  factory ExamResult.fromJson(Json json) => ExamResult(
        examId: asString(json['examId']),
        name: asString(json['name']),
        kind: asString(json['kind']),
        date: asString(json['date']),
        net: asDouble(json['net']),
        correct: asInt(json['correct']),
        wrong: asInt(json['wrong']),
        blank: asInt(json['blank']),
        rank: asIntOrNull(json['rank']),
        participants: asInt(json['participants']),
        sections: asList(json['sections'], SectionNet.fromJson),
      );
}

class TrendPoint {
  const TrendPoint({required this.name, required this.date, required this.net, this.average});

  final String name;
  final String date;
  final double net;
  final double? average;

  factory TrendPoint.fromJson(Json json) => TrendPoint(
        name: asString(json['name']),
        date: asString(json['date']),
        net: asDouble(json['net']),
        average: asDoubleOrNull(json['average']),
      );
}

class WeakTopic {
  const WeakTopic({required this.topic, required this.section, required this.rate, this.questions, this.teachersUrl});

  final String topic;
  final String section;

  /// 0-1 arası doğru oranı
  final double rate;
  final int? questions;
  final String? teachersUrl;

  factory WeakTopic.fromJson(Json json) => WeakTopic(
        topic: asString(json['topic']),
        section: asString(json['section']),
        rate: asDouble(json['rate']),
        questions: asIntOrNull(json['questions']),
        teachersUrl: asStringOrNull(json['teachersUrl']),
      );
}

class Installment {
  const Installment({required this.title, required this.order, required this.dueDate, required this.amount, required this.paidAmount, required this.state});

  final String title;
  final int order;
  final String dueDate;
  final int amount;
  final int paidAmount;

  /// paid, partial, overdue, due, upcoming
  final String state;

  factory Installment.fromJson(Json json) => Installment(
        title: asString(json['title']),
        order: asInt(json['order']),
        dueDate: asString(json['dueDate']),
        amount: asInt(json['amount']),
        paidAmount: asInt(json['paidAmount']),
        state: asString(json['state']),
      );
}

class CenterPayment {
  const CenterPayment({this.receiptNo, required this.amount, required this.method, required this.paidAt});

  final int? receiptNo;
  final int amount;
  final String method;
  final DateTime paidAt;

  factory CenterPayment.fromJson(Json json) => CenterPayment(
        receiptNo: asIntOrNull(json['receiptNo']),
        amount: asInt(json['amount']),
        method: asString(json['method']),
        paidAt: asDateOr(json['paidAt'], DateTime.now()),
      );
}

class Announcement {
  const Announcement({required this.id, required this.title, required this.body, this.group, required this.createdAt});

  final String id;
  final String title;
  final String body;
  final String? group;
  final DateTime createdAt;

  factory Announcement.fromJson(Json json) => Announcement(
        id: asString(json['id']),
        title: asString(json['title']),
        body: asString(json['body']),
        group: asStringOrNull(json['group']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class TeacherNote {
  const TeacherNote({required this.kind, required this.text, this.author, required this.createdAt});

  final String kind;
  final String text;
  final String? author;
  final DateTime createdAt;

  factory TeacherNote.fromJson(Json json) => TeacherNote(
        kind: asString(json['kind']),
        text: asString(json['text']),
        author: asStringOrNull(json['author']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
      );
}

class Homework {
  const Homework({required this.id, required this.subject, required this.title, this.description, required this.assignedOn, required this.dueDate, required this.status, this.note});

  final String id;
  final String subject;
  final String title;
  final String? description;
  final String assignedOn;
  final String dueDate;
  final String status;
  final String? note;

  factory Homework.fromJson(Json json) => Homework(
        id: asString(json['id']),
        subject: asString(json['subject']),
        title: asString(json['title']),
        description: asStringOrNull(json['description']),
        assignedOn: asString(json['assignedOn']),
        dueDate: asString(json['dueDate']),
        status: asString(json['status']),
        note: asStringOrNull(json['note']),
      );
}

class CenterQuestion {
  const CenterQuestion({
    required this.id,
    required this.subject,
    this.note,
    this.imageUrl,
    required this.status,
    this.answerText,
    this.answerImageUrl,
    this.answerVideoUrl,
    this.answeredBy,
    this.answeredAt,
    required this.createdAt,
    this.mine = false,
  });

  final String id;
  final String subject;
  final String? note;
  final String? imageUrl;

  /// OPEN, ANSWERED, IN_PERSON
  final String status;
  final String? answerText;
  final String? answerImageUrl;
  final String? answerVideoUrl;
  final String? answeredBy;
  final DateTime? answeredAt;
  final DateTime createdAt;
  final bool mine;

  factory CenterQuestion.fromJson(Json json) => CenterQuestion(
        id: asString(json['id']),
        subject: asString(json['subject']),
        note: asStringOrNull(json['note']),
        imageUrl: asStringOrNull(json['imageUrl']),
        status: asString(json['status']),
        answerText: asStringOrNull(json['answerText']),
        answerImageUrl: asStringOrNull(json['answerImageUrl']),
        answerVideoUrl: asStringOrNull(json['answerVideoUrl']),
        answeredBy: asStringOrNull(json['answeredBy']),
        answeredAt: asDate(json['answeredAt']),
        createdAt: asDateOr(json['createdAt'], DateTime.now()),
        mine: asBool(json['mine']),
      );
}

class ScheduleSlot {
  const ScheduleSlot({required this.weekday, required this.startMinute, required this.endMinute, required this.subject, required this.group, this.room, this.teacher});

  final int weekday;
  final int startMinute;
  final int endMinute;
  final String subject;
  final String group;
  final String? room;
  final String? teacher;

  factory ScheduleSlot.fromJson(Json json) => ScheduleSlot(
        weekday: asInt(json['weekday']),
        startMinute: asInt(json['startMinute']),
        endMinute: asInt(json['endMinute']),
        subject: asString(json['subject']),
        group: asString(json['group']),
        room: asStringOrNull(json['room']),
        teacher: asStringOrNull(json['teacher']),
      );
}

class HallDay {
  const HallDay({required this.date, required this.hall, this.periods = const [], required this.marks, this.present = 0, this.marked = 0});

  final String date;
  final String hall;
  final List<String> periods;

  /// Periyot başına G (geldi), Y (gelmedi), - (işaretlenmedi)
  final String marks;
  final int present;
  final int marked;

  factory HallDay.fromJson(Json json) => HallDay(
        date: asString(json['date']),
        hall: asString(json['hall']),
        periods: asStringList(json['periods']),
        marks: asString(json['marks']),
        present: asInt(json['present']),
        marked: asInt(json['marked']),
      );
}

/// Öğrenci ayrıntısı (`GET /kurum/{id}`).
class CenterChild {
  const CenterChild({
    required this.id,
    required this.student,
    required this.center,
    this.balance = const Balance(),
    this.attendance = const [],
    this.etuds = const [],
    this.exams = const [],
    this.trend = const [],
    this.weakTopics = const [],
    this.installments = const [],
    this.payments = const [],
    this.announcements = const [],
    this.notes = const [],
    this.homeworks = const [],
    this.questions = const [],
    this.questionSubjects = const [],
    this.schedule = const [],
    this.hallDays = const [],
  });

  final String id;
  final CenterStudent student;
  final CenterInfo center;
  final Balance balance;
  final List<AttendanceRecord> attendance;
  final List<EtudRecord> etuds;
  final List<ExamResult> exams;
  final List<TrendPoint> trend;
  final List<WeakTopic> weakTopics;
  final List<Installment> installments;
  final List<CenterPayment> payments;
  final List<Announcement> announcements;
  final List<TeacherNote> notes;
  final List<Homework> homeworks;
  final List<CenterQuestion> questions;
  final List<String> questionSubjects;
  final List<ScheduleSlot> schedule;
  final List<HallDay> hallDays;

  /// Devam oranı (geldi + geç / toplam); kayıt yoksa 1.
  double get attendanceRate {
    if (attendance.isEmpty) return 1;
    final present = attendance.where((a) => a.status == 'PRESENT' || a.status == 'LATE').length;
    return present / attendance.length;
  }

  int get absences => attendance.where((a) => a.status == 'ABSENT').length;

  factory CenterChild.fromJson(Json json) => CenterChild(
        id: asString(json['id']),
        student: CenterStudent.fromJson(asJson(json['student'])),
        center: CenterInfo.fromJson(asJson(json['center'])),
        balance: Balance.fromJson(asJson(json['balance'])),
        attendance: asList(json['attendance'], AttendanceRecord.fromJson),
        etuds: asList(json['etuds'], EtudRecord.fromJson),
        exams: asList(json['exams'], ExamResult.fromJson),
        trend: asList(json['trend'], TrendPoint.fromJson),
        weakTopics: asList(json['weakTopics'], WeakTopic.fromJson),
        installments: asList(json['installments'], Installment.fromJson),
        payments: asList(json['payments'], CenterPayment.fromJson),
        announcements: asList(json['announcements'], Announcement.fromJson),
        notes: asList(json['notes'], TeacherNote.fromJson),
        homeworks: asList(json['homeworks'], Homework.fromJson),
        questions: asList(json['questions'], CenterQuestion.fromJson),
        questionSubjects: asStringList(json['questionSubjects']),
        schedule: asList(json['schedule'], ScheduleSlot.fromJson),
        hallDays: asList(json['hallDays'], HallDay.fromJson),
      );
}

class TopicResult {
  const TopicResult({required this.topic, required this.questions, required this.correct, required this.rate});

  final String topic;
  final int questions;
  final int correct;
  final double rate;

  factory TopicResult.fromJson(Json json) => TopicResult(
        topic: asString(json['topic']),
        questions: asInt(json['questions']),
        correct: asInt(json['correct']),
        rate: asDouble(json['rate']),
      );
}

class ReportSection {
  const ReportSection({required this.name, required this.questionCount, this.correct, this.wrong, this.blank, this.net, this.averageNet, this.topics = const []});

  final String name;
  final int questionCount;
  final int? correct;
  final int? wrong;
  final int? blank;
  final double? net;
  final double? averageNet;
  final List<TopicResult> topics;

  factory ReportSection.fromJson(Json json) => ReportSection(
        name: asString(json['name']),
        questionCount: asInt(json['questionCount']),
        correct: asIntOrNull(json['correct']),
        wrong: asIntOrNull(json['wrong']),
        blank: asIntOrNull(json['blank']),
        net: asDoubleOrNull(json['net']),
        averageNet: asDoubleOrNull(json['averageNet']),
        topics: asList(json['topics'], TopicResult.fromJson),
      );
}

/// Deneme karnesi (`GET /kurum/{id}/deneme/{examId}`).
class ReportCard {
  const ReportCard({
    required this.examName,
    required this.examKind,
    required this.examDate,
    this.publisher,
    required this.net,
    this.correct = 0,
    this.wrong = 0,
    this.blank = 0,
    this.score,
    this.rank,
    this.participants = 0,
    this.averageNet,
    this.sections = const [],
    this.weakTopics = const [],
    this.trend = const [],
  });

  final String examName;
  final String examKind;
  final String examDate;
  final String? publisher;
  final double net;
  final int correct;
  final int wrong;
  final int blank;
  final double? score;
  final int? rank;
  final int participants;
  final double? averageNet;
  final List<ReportSection> sections;
  final List<WeakTopic> weakTopics;
  final List<TrendPoint> trend;

  factory ReportCard.fromJson(Json json) {
    final exam = asJson(json['exam']);
    final result = asJson(json['result']);
    final average = json['average'];
    return ReportCard(
      examName: asString(exam['name']),
      examKind: asString(exam['kind']),
      examDate: asString(exam['date']),
      publisher: asStringOrNull(exam['publisher']),
      net: asDouble(result['net']),
      correct: asInt(result['correct']),
      wrong: asInt(result['wrong']),
      blank: asInt(result['blank']),
      score: asDoubleOrNull(result['score']),
      rank: asIntOrNull(result['rank']),
      participants: asInt(result['participants']),
      averageNet: average is Map ? asDoubleOrNull(average['net']) : asDoubleOrNull(average),
      sections: asList(json['sections'], ReportSection.fromJson),
      weakTopics: asList(json['weakTopics'], WeakTopic.fromJson),
      trend: asList(json['trend'], TrendPoint.fromJson),
    );
  }
}

class PlanItem {
  const PlanItem({required this.id, required this.date, required this.subject, this.topic, this.resource, this.targetQuestions, this.note, this.done = false});

  final String id;
  final String date;
  final String subject;
  final String? topic;
  final String? resource;
  final int? targetQuestions;
  final String? note;
  final bool done;

  PlanItem copyWith({bool? done}) => PlanItem(
        id: id,
        date: date,
        subject: subject,
        topic: topic,
        resource: resource,
        targetQuestions: targetQuestions,
        note: note,
        done: done ?? this.done,
      );

  factory PlanItem.fromJson(Json json) => PlanItem(
        id: asString(json['id']),
        date: asString(json['date']),
        subject: asString(json['subject']),
        topic: asStringOrNull(json['topic']),
        resource: asStringOrNull(json['resource']),
        targetQuestions: asIntOrNull(json['targetQuestions']),
        note: asStringOrNull(json['note']),
        done: asBool(json['done']),
      );
}

class ResourceTopic {
  const ResourceTopic({required this.topic, this.solved = 0, this.correct = 0, this.wrong = 0, this.done = false, this.accuracy});

  final String topic;
  final int solved;
  final int correct;
  final int wrong;
  final bool done;
  final double? accuracy;

  factory ResourceTopic.fromJson(Json json) => ResourceTopic(
        topic: asString(json['topic']),
        solved: asInt(json['solved']),
        correct: asInt(json['correct']),
        wrong: asInt(json['wrong']),
        done: asBool(json['done']),
        accuracy: asDoubleOrNull(json['accuracy']),
      );
}

class StudyResource {
  const StudyResource({
    required this.id,
    required this.name,
    required this.subject,
    this.publisher,
    this.topicCount = 0,
    this.doneCount = 0,
    this.completion = 0,
    this.solved = 0,
    this.accuracy,
    this.topics = const [],
  });

  final String id;
  final String name;
  final String subject;
  final String? publisher;
  final int topicCount;
  final int doneCount;
  final double completion;
  final int solved;
  final double? accuracy;
  final List<ResourceTopic> topics;

  factory StudyResource.fromJson(Json json) => StudyResource(
        id: asString(json['id']),
        name: asString(json['name']),
        subject: asString(json['subject']),
        publisher: asStringOrNull(json['publisher']),
        topicCount: asInt(json['topicCount']),
        doneCount: asInt(json['doneCount']),
        completion: asDouble(json['completion']),
        solved: asInt(json['solved']),
        accuracy: asDoubleOrNull(json['accuracy']),
        topics: asList(json['topics'], ResourceTopic.fromJson),
      );
}

class CoachingSession {
  const CoachingSession({required this.id, required this.date, this.coach, this.held = true, required this.notes, this.priorityTopics = const [], this.nextGoal});

  final String id;
  final String date;
  final String? coach;
  final bool held;
  final String notes;
  final List<String> priorityTopics;
  final String? nextGoal;

  factory CoachingSession.fromJson(Json json) => CoachingSession(
        id: asString(json['id']),
        date: asString(json['date']),
        coach: asStringOrNull(json['coach']),
        held: asBool(json['held'], true),
        notes: asString(json['notes']),
        priorityTopics: asStringList(json['priorityTopics']),
        nextGoal: asStringOrNull(json['nextGoal']),
      );
}

class Coaching {
  const Coaching({this.coach, this.weekday, this.minute, this.sessions = const []});

  final String? coach;
  final int? weekday;
  final int? minute;
  final List<CoachingSession> sessions;

  bool get isEmpty => coach == null && sessions.isEmpty;

  factory Coaching.fromJson(Json json) => Coaching(
        coach: asStringOrNull(json['coach']),
        weekday: asIntOrNull(json['weekday']),
        minute: asIntOrNull(json['minute']),
        sessions: asList(json['sessions'], CoachingSession.fromJson),
      );
}

/// Çalışma programı, kaynaklar ve koçluk (`GET /kurum/{id}/calisma`).
class StudyWeek {
  const StudyWeek({required this.weekStart, required this.weekEnd, required this.today, this.items = const [], this.resources = const [], this.coaching = const Coaching()});

  final String weekStart;
  final String weekEnd;
  final String today;
  final List<PlanItem> items;
  final List<StudyResource> resources;
  final Coaching coaching;

  factory StudyWeek.fromJson(Json json) => StudyWeek(
        weekStart: asString(json['weekStart']),
        weekEnd: asString(json['weekEnd']),
        today: asString(json['today']),
        items: asList(json['items'], PlanItem.fromJson),
        resources: asList(json['resources'], StudyResource.fromJson),
        coaching: Coaching.fromJson(asJson(json['coaching'])),
      );
}
