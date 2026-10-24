import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/deep_links.dart';
import 'package:pikampus/core/models/booking.dart';
import 'package:pikampus/core/models/me.dart';
import 'package:pikampus/core/models/messages.dart';
import 'package:pikampus/core/models/pool.dart';
import 'package:pikampus/core/router/app_router.dart';

void main() {
  group('soru kredisi ve soru havuzu modelleri', () {
    test('kredi ekranı', () {
      final credits = Credits.fromJson({
        'balance': 9,
        'salesOpen': true,
        'rules': {'validityMonths': 12, 'refundDays': 14, 'answerHours': 24, 'disputeHours': 48, 'singlePrice': 4900},
        'packages': [
          {'credits': 1, 'price': 4900, 'unitPrice': 4900, 'savingPercent': 0},
          {'credits': 10, 'price': 39000, 'unitPrice': 3900, 'savingPercent': 20},
        ],
        'subjects': [
          {'levelId': 3, 'subjectId': 5, 'levelName': 'Ortaokul', 'subjectName': 'Matematik'},
        ],
        'purchases': [
          {
            'id': 'p1', 'code': 'KR-1', 'credits': 10, 'price': 39000, 'status': 'PAID', 'statusLabel': 'Aktif', 'remaining': 9,
            'refund': {'allowed': true, 'amount': 34100, 'reason': null},
          },
        ],
        'entries': [
          {'id': 'e1', 'kind': 'SPEND', 'kindLabel': 'Soru gönderildi', 'amount': -1, 'note': 'SH-1 gönderildi', 'createdAt': '2026-10-24T08:00:00.000Z'},
        ],
      });
      expect(credits.balance, 9);
      expect(credits.packages[1].title, '10 soru');
      expect(credits.packages[0].title, 'Tek soru');
      expect(credits.subjects.single.title, 'Ortaokul · Matematik');
      expect(credits.purchases.single.refundAllowed, isTrue);
      expect(credits.purchases.single.refundAmount, 34100);
      expect(credits.purchases.single.isPaid, isTrue);
      expect(credits.entries.single.amount, -1);
    });

    test('öğrencinin sorusu: çözüm, ek soru ve yapılabilecekler', () {
      final q = PoolQuestion.fromJson({
        'id': 'q1', 'code': 'SH-1', 'levelName': 'Ortaokul', 'subjectName': 'Matematik', 'status': 'ANSWERED', 'statusLabel': 'Çözüldü',
        'createdAt': '2026-10-24T08:00:00.000Z', 'imageUrl': 'https://x/api/dosya/a.png',
        'teacher': {'name': 'Ayşe Y.', 'photoUrl': null},
        'answer': {
          'text': 'x = 4', 'imageUrl': null, 'videoUrl': 'https://x/api/dosya/v.mp4', 'answeredAt': '2026-10-24T09:00:00.000Z',
          'followUp': {'text': 'Neden?', 'askedAt': '2026-10-24T09:10:00.000Z', 'answer': null, 'answeredAt': null},
        },
        'actions': {'canCancel': false, 'canFollowUp': false, 'canRate': true, 'canDispute': true},
      });
      expect(q.title, 'Ortaokul · Matematik');
      expect(q.teacherName, 'Ayşe Y.');
      expect(q.answer!.videoUrl, isNotNull);
      expect(q.answer!.followUp!.answer, isNull);
      expect(q.can('canRate'), isTrue);
      expect(q.can('canCancel'), isFalse);
      expect(q.can('bilinmeyen'), isFalse);
    });

    test('öğretmen havuzu', () {
      final pool = TeacherPool.fromJson({
        'answersPool': true,
        'eligible': true,
        'blocked': false,
        'standing': {'ratingAvg': 4.5, 'ratingCount': 2, 'upheldDisputes': 0},
        'rules': {'claimMinutes': 30, 'maxActiveClaims': 3, 'fee': 800},
        'open': [
          {'id': 'q1', 'code': 'SH-1', 'levelName': 'Lise', 'subjectName': 'Fizik', 'status': 'OPEN', 'statusLabel': 'Öğretmen bekleniyor', 'createdAt': '2026-10-24T08:00:00.000Z', 'fee': 800},
        ],
        'mine': [
          {'id': 'q2', 'code': 'SH-2', 'levelName': 'Lise', 'subjectName': 'Fizik', 'status': 'CLAIMED', 'statusLabel': 'Öğretmen çözüyor', 'createdAt': '2026-10-24T08:00:00.000Z', 'mine': true},
        ],
      });
      expect(pool.open.single.fee, 800);
      expect(pool.activeClaims, 1);
      expect(pool.ratingAvg, 4.5);
    });
  });

  test('mesajlar', () {
    final list = ThreadSummary.fromJson({
      'id': 't1',
      'counterpart': {'name': 'Ayşe Yılmaz', 'photoUrl': null, 'teacherSlug': 'ayse-yilmaz'},
      'last': {'body': 'Merhaba', 'mine': false, 'createdAt': '2026-10-24T08:00:00.000Z'},
      'unread': true,
    });
    expect(list.unread, isTrue);
    expect(list.counterpart.teacherSlug, 'ayse-yilmaz');
    final thread = MessageThread.fromJson({
      'id': 't1',
      'counterpart': {'name': 'Ayşe Yılmaz'},
      'messages': [
        {'id': 'm1', 'mine': true, 'body': 'Numaram ***', 'masked': true, 'createdAt': '2026-10-24T08:00:00.000Z'},
      ],
      'masked': true,
    });
    expect(thread.messages.single.masked, isTrue);
    expect(thread.lastMasked, isTrue);
  });

  test('ben: okunmamış mesaj ve kredi; tanışma görüşmesi; ödemesiz randevu', () {
    final me = Me.fromJson({'id': 'u1', 'role': 'STUDENT', 'firstName': 'Fatma', 'lastName': 'D', 'unreadMessages': 2, 'questionCredits': 9});
    expect(me.unreadMessages, 2);
    expect(me.questionCredits, 9);
    expect(me.copyWith(unreadMessages: 0).questionCredits, 9);
    final teacher = Me.fromJson({'id': 'u2', 'role': 'TEACHER', 'firstName': 'Ayşe', 'lastName': 'Y', 'questionCredits': null});
    expect(teacher.questionCredits, isNull);

    final checkout = CheckoutResult.fromJson({
      'booking': {'id': 'b1', 'status': 'PENDING_APPROVAL', 'isIntro': true, 'price': 0, 'counterpart': {'name': 'Ayşe Y.'}},
      'payment': null,
    });
    expect(checkout.payment, isNull);
    expect(checkout.booking.summary.isIntro, isTrue);
  });

  group('yönlendirme', () {
    test('sitenin soru, kredi ve mesaj adresleri', () {
      expect(mapWebPath(Uri.parse('/hesabim/sorularim/q1')), '/sorularim/q1');
      expect(mapWebPath(Uri.parse('/hesabim/sorularim')), '/sorularim');
      expect(mapWebPath(Uri.parse('/hesabim/krediler')), '/soru-sor');
      expect(mapWebPath(Uri.parse('/hesabim/mesajlar/t1')), '/mesajlar/t1');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/mesajlar/t1')), '/mesajlar/t1');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/mesajlar')), '/mesajlar');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/soru-havuzu/q1')), '/panel/soru-havuzu/q1');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/soru-havuzu')), '/panel/soru-havuzu');
    });

    test('pikampus:// ile soru ve mesaj ekranları', () {
      expect(DeepLinks.locationFor(Uri.parse('pikampus://soru-sor')), '/soru-sor');
      expect(DeepLinks.locationFor(Uri.parse('pikampus://sorularim/q1')), '/sorularim/q1');
      expect(DeepLinks.locationFor(Uri.parse('https://pikampus.com/hesabim/sorularim/q1')), '/sorularim/q1');
      expect(DeepLinks.locationFor(Uri.parse('pikampus://mesajlar')), '/mesajlar');
    });

    test('bildirim hedefleri', () {
      expect(routeForTarget('question', 'q1'), '/sorularim/q1');
      expect(routeForTarget('credits', null), '/soru-sor');
      expect(routeForTarget('poolQuestion', 'q1'), '/panel/soru-havuzu/q1');
      expect(routeForTarget('pool', null), '/panel/soru-havuzu');
      expect(routeForTarget('thread', 't1'), '/mesajlar/t1');
      expect(routeForTarget('messages', null), '/mesajlar');
    });

    test('giriş gerektirenler', () {
      expect(Routes.needsAuth('/sorularim/q1'), isTrue);
      expect(Routes.needsAuth('/soru-sor/gonder'), isTrue);
      expect(Routes.needsAuth('/mesajlar'), isTrue);
      expect(Routes.needsAuth('/satin-al/kredi/p1'), isTrue);
      expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/tanisma'), isTrue);
      expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/mesaj'), isTrue);
      // Paketler misafire de gösterilir
      expect(Routes.needsAuth('/soru-sor'), isFalse);
    });
  });
}
