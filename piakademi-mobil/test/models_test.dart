import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/api/api_exception.dart';
import 'package:pikampus/core/models/booking.dart';
import 'package:pikampus/core/models/catalog.dart';
import 'package:pikampus/core/models/center.dart';
import 'package:pikampus/core/models/me.dart';
import 'package:pikampus/core/models/teacher.dart';

import 'support/fixtures.dart';

void main() {
  test('katalog', () {
    final catalog = Catalog.fromJson(catalogJson());
    expect(catalog.site.name, 'Pi Kampüs');
    expect(catalog.rules.questionAnswerHours, 24);
    expect(catalog.levelBySlug('ortaokul')?.grades.map((g) => g.name), ['5. Sınıf', '8. Sınıf']);
    expect(catalog.subjectsFor(catalog.levels.first).single.name, 'Matematik');
    expect(catalog.page('kvkk-aydinlatma-metni')?.title, 'KVKK Aydınlatma Metni');
  });

  test('eksik ve yanlış tipteki alanlar uygulamayı çökertmez', () {
    final rules = Rules.fromJson({'paymentHoldMinutes': '20', 'approvalWindowHours': null});
    expect(rules.paymentHoldMinutes, 20);
    expect(rules.approvalWindowHours, 12);
    final card = TeacherCard.fromJson({'slug': 'x', 'ratingAvg': 5, 'subjects': null});
    expect(card.ratingAvg, 5.0);
    expect(card.subjects, isEmpty);
    expect(card.minHourlyPrice, isNull);
  });

  test('öğretmen profili ve fotoğrafla soru ücreti', () {
    final profile = TeacherProfile.fromJson(teacherProfileJson(questions: true));
    expect(profile.verified, isTrue);
    expect(profile.offerings.single.durations.map((d) => d.minutes), [45, 60]);
    expect(profile.offerings.single.acceptsQuestions, isTrue);
    expect(profile.acceptsQuestions, isTrue);
    expect(profile.minHourlyPrice, 80000);
    expect(TeacherProfile.fromJson(teacherProfileJson()).acceptsQuestions, isFalse);
  });

  test('ders ayrıntısı ve işlemler', () {
    final detail = BookingDetail.fromJson(bookingDetailJson(status: 'PENDING_PAYMENT', failed: true));
    expect(detail.summary.code, 'VD-TEST01');
    expect(detail.actions.canPay, isTrue);
    expect(detail.lastPayment?.failureReason, 'Kart bankası ödemeyi onaylamadı.');
    expect(detail.classroom, isNotNull);
    expect(detail.summary.startAt.isUtc, isTrue);
  });

  test('fotoğrafla soru yazışması', () {
    final json = bookingDetailJson(status: 'COMPLETED', mode: 'QUESTION')
      ..['question'] = {
        'answerDeadline': null,
        'answeredAt': '2026-10-16T05:30:00.000Z',
        'threadOpen': true,
        'messages': [
          {'id': 'm1', 'mine': true, 'fromTeacher': false, 'authorName': 'Fatma D.', 'body': 'Takıldım', 'imageUrl': '$fakeBase/api/dosya/private/soru-cozum/a.jpg', 'videoUrl': null, 'isSolution': false, 'createdAt': '2026-10-16T05:00:00.000Z'},
          {'id': 'm2', 'mine': false, 'fromTeacher': true, 'authorName': 'Ayşe Yılmaz', 'body': 'x = 6', 'imageUrl': null, 'videoUrl': null, 'isSolution': true, 'createdAt': '2026-10-16T05:30:00.000Z'},
        ],
      }
      ..['actions'] = {'canMessage': true, 'canSolve': false};
    final detail = BookingDetail.fromJson(json);
    expect(detail.summary.isQuestion, isTrue);
    expect(detail.question!.messages.last.isSolution, isTrue);
    expect(detail.actions.canMessage, isTrue);
  });

  test('kullanıcı rolleri', () {
    expect(Me.fromJson(meJson()).isStudent, isTrue);
    expect(Me.fromJson(meJson()).student!.isParent, isTrue);
    expect(Me.fromJson(meJson(role: 'TEACHER')).isTeacher, isTrue);
    expect(Me.fromJson(meJson()).initials, 'FD');
    expect(Me.fromJson(meJson(role: 'CENTER')).role, UserRole.other);
  });

  test('deneme karnesi: kurum ortalaması sayı ya da nesne olabilir', () {
    final base = {
      'exam': {'id': 'e1', 'name': 'LGS Deneme 3', 'kind': 'LGS', 'date': '2026-10-09', 'publisher': 'Kurum içi'},
      'result': {'net': 86.01, 'correct': 87, 'wrong': 3, 'blank': 0, 'score': null, 'rank': 1, 'participants': 19},
      'sections': [
        {'name': 'Türkçe', 'questionCount': 20, 'correct': 20, 'wrong': 0, 'blank': 0, 'net': 20, 'averageNet': 13.25, 'topics': []},
      ],
      'weakTopics': [],
      'trend': [],
    };
    expect(ReportCard.fromJson({...base, 'average': 58.95}).averageNet, 58.95);
    expect(ReportCard.fromJson({...base, 'average': {'net': 60.5}}).averageNet, 60.5);
  });

  test('kurum öğrencisi: devam oranı', () {
    final child = CenterChild.fromJson({
      'id': 'g1',
      'student': {'firstName': 'Ali', 'lastName': 'Demirtaş'},
      'center': {'name': 'Başarı Etüt Merkezi'},
      'attendance': [
        {'date': '2026-10-12', 'startMinute': 960, 'subject': 'Fen', 'group': '8-A', 'status': 'PRESENT'},
        {'date': '2026-10-13', 'startMinute': 960, 'subject': 'Fen', 'group': '8-A', 'status': 'LATE'},
        {'date': '2026-10-14', 'startMinute': 960, 'subject': 'Fen', 'group': '8-A', 'status': 'ABSENT'},
        {'date': '2026-10-15', 'startMinute': 960, 'subject': 'Fen', 'group': '8-A', 'status': 'EXCUSED'},
      ],
    });
    expect(child.attendanceRate, 0.5);
    expect(child.absences, 1);
    expect(child.student.fullName, 'Ali Demirtaş');
  });

  group('API hata biçimi', () {
    test('alan hataları', () {
      final error = ApiException.fromResponse(422, {
        'error': {'code': 'VALIDATION', 'message': 'Lütfen işaretli alanları kontrol edin.', 'fields': {'consent': 'Onaylayın.'}},
      });
      expect(error.code, 'VALIDATION');
      expect(error.field('consent'), 'Onaylayın.');
    });

    test('ek alanlar (sınıf açılış saati)', () {
      final error = ApiException.fromResponse(409, {
        'error': {'code': 'CLASSROOM_CLOSED', 'message': 'Sınıf henüz açılmadı.', 'opensAt': '2026-10-17T07:50:00.000Z'},
      });
      expect(error.extra['opensAt'], '2026-10-17T07:50:00.000Z');
    });

    test('JSON olmayan yanıtlar', () {
      expect(ApiException.fromResponse(502, '<html>Bad gateway</html>').code, 'INTERNAL');
      expect(ApiException.fromResponse(404, null).code, 'NOT_FOUND');
    });
  });
}
