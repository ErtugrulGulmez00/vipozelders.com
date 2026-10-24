import 'package:flutter_test/flutter_test.dart';
import 'package:pikampus/core/api/pi_api.dart';
import 'package:pikampus/core/deep_links.dart';
import 'package:pikampus/core/models/booking.dart';
import 'package:pikampus/core/models/commerce.dart';
import 'package:pikampus/core/models/teacher.dart';
import 'package:pikampus/core/router/app_router.dart';
import 'package:pikampus/features/shared/purchase_status_screen.dart';

void main() {
  group('paket, abonelik, grup dersi modelleri', () {
    test('profildeki teklifler ve paket indirimi', () {
      final profile = TeacherProfile.fromJson({
        'userId': 'u1',
        'slug': 'ayse-yilmaz',
        'name': 'Ayşe Yılmaz',
        'packageOffers': [
          {'lessons': 5, 'percent': 5},
          {'lessons': 10, 'percent': 10},
        ],
        'questionPlans': [
          {'id': 'p1', 'levelName': 'Lise', 'subjectName': 'Matematik', 'price': 25000, 'dailyLimit': 3, 'answerHours': 12, 'days': 30},
        ],
        'groupCourses': [
          {'id': 'g1', 'code': 'GD-1', 'title': 'LGS kampı', 'levelName': 'LGS', 'subjectName': 'Matematik', 'price': 40000, 'capacity': 8, 'seatsTaken': 3, 'status': 'OPEN', 'statusLabel': 'Kayıtlar açık', 'sessionCount': 6},
        ],
        'myPackages': [
          {'id': 'k1', 'code': 'PK-1', 'offeringId': 'o1', 'durationMinutes': 60, 'left': 4},
        ],
      });
      expect(packageDiscountFor(profile.packageOffers, 4), 0);
      expect(packageDiscountFor(profile.packageOffers, 7), 5);
      expect(packageDiscountFor(profile.packageOffers, 12), 10);
      expect(profile.questionPlans.single.title, 'Lise · Matematik');
      expect(profile.groupCourses.single.seatsLeft, 5);
      expect(profile.myPackages.single.left, 4);
      // Favori değişince teklifler kaybolmaz
      expect(profile.copyWith(isFavorite: true).myPackages, hasLength(1));
    });

    test('paketlerim ve abonelik', () {
      final pkg = LessonPackage.fromJson({
        'id': 'k1',
        'code': 'PK-1',
        'teacher': {'name': 'Ayşe Yılmaz', 'slug': 'ayse-yilmaz'},
        'levelName': 'Lise',
        'subjectName': 'Matematik',
        'durationMinutes': 60,
        'lessonCount': 5,
        'unitPrice': 76000,
        'price': 380000,
        'status': 'PAID',
        'statusLabel': 'Aktif',
        'active': true,
        'left': 3,
        'refund': {'allowed': true, 'amount': 200000, 'reason': null},
        'bookings': [
          {'id': 'b1', 'startAt': '2026-10-25T09:00:00.000Z', 'endAt': '2026-10-25T10:00:00.000Z', 'status': 'COMPLETED', 'statusLabel': 'Tamamlandı'},
        ],
      });
      expect(pkg.refund.allowed, isTrue);
      expect(pkg.bookings.single.statusLabel, 'Tamamlandı');
      final sub = QuestionSubscription.fromJson({
        'id': 's1',
        'code': 'AB-1',
        'teacher': {'name': 'Ayşe Yılmaz', 'slug': 'ayse-yilmaz'},
        'levelName': 'Lise',
        'subjectName': 'Matematik',
        'price': 25000,
        'status': 'ACTIVE',
        'statusLabel': 'Aktif',
        'dailyLimit': 3,
        'usedToday': 5,
        'running': true,
        'payment': {'status': 'SUCCEEDED'},
      });
      expect(sub.leftToday, 0);
      expect(sub.payment!.failed, isFalse);
    });

    test('grup dersi ayrıntısı, kayıt ve erteleme', () {
      final course = GroupCourse.fromJson({
        'id': 'g1',
        'code': 'GD-1',
        'title': 'LGS kampı',
        'levelName': 'LGS',
        'subjectName': 'Matematik',
        'price': 40000,
        'capacity': 8,
        'status': 'CONFIRMED',
        'statusLabel': 'Kesinleşti',
        'sessions': [
          {'id': 's1', 'index': 0, 'startAt': '2026-10-25T09:00:00.000Z', 'endAt': '2026-10-25T10:00:00.000Z', 'status': 'SCHEDULED', 'statusLabel': 'Planlandı', 'canJoin': true},
        ],
        'enrollment': {'id': 'e1', 'code': 'GK-1', 'status': 'PAID', 'statusLabel': 'Kayıtlı', 'price': 40000},
        'actions': {'canEnroll': false, 'canCancel': false},
      });
      expect(course.sessions.single.canJoin, isTrue);
      expect(course.enrollment!.status, 'PAID');
      final detail = BookingDetail.fromJson({
        'id': 'b1',
        'status': 'CONFIRMED',
        'price': 0,
        'packageId': 'k1',
        'packageCode': 'PK-1',
        'discountAmount': 0,
        'counterpart': {'name': 'Ayşe Y.'},
        'reschedule': {
          'allowed': false,
          'count': 1,
          'pending': {'id': 'r1', 'newStartAt': '2026-10-26T09:00:00.000Z', 'note': 'Gezi', 'mine': false},
        },
      });
      expect(detail.summary.packageId, 'k1');
      expect(detail.packageCode, 'PK-1');
      expect(detail.reschedule.hasPending, isTrue);
      expect(detail.reschedule.pendingMine, isFalse);
    });

    test('indirim kodu ve davet', () {
      final ok = CouponCheck.fromJson({'ok': true, 'discount': 2000, 'finalPrice': 18000, 'label': 'E2E indirimi'});
      expect(ok.finalPrice, 18000);
      final bad = CouponCheck.fromJson({'ok': false, 'error': 'İndirim kodu bulunamadı.'});
      expect(bad.ok, isFalse);
      expect(bad.error, isNotNull);
      final invite = InviteInfo.fromJson({'enabled': true, 'code': 'ABC1234', 'url': 'https://x/kayit?davet=ABC1234', 'shareText': '...', 'discountPercent': 10, 'rewardCredits': 3});
      expect(invite.rewardCredits, 3);
    });

    test('randevu isteği: paketten ders ödemesiz, kupon yalnızca ödemeli derste', () {
      final fromPackage = BookingRequest(offeringId: 'o1', startAt: DateTime.utc(2026, 10, 25, 9), durationMinutes: 60, mode: 'ONLINE', learnerName: 'Ali', packageId: 'k1', couponCode: 'KOD').toJson();
      expect(fromPackage['packageId'], 'k1');
      expect(fromPackage.containsKey('consent'), isFalse);
      expect(fromPackage.containsKey('couponCode'), isFalse);
      final paid = BookingRequest(offeringId: 'o1', startAt: DateTime.utc(2026, 10, 25, 9), durationMinutes: 60, mode: 'ONLINE', learnerName: 'Ali', couponCode: ' KOD ').toJson();
      expect(paid['consent'], isTrue);
      expect(paid['couponCode'], 'KOD');
    });
  });

  group('yönlendirme', () {
    test('site adresleri ve derin bağlantılar', () {
      expect(mapWebPath(Uri.parse('/hesabim/paketlerim')), '/paketlerim');
      expect(mapWebPath(Uri.parse('/hesabim/abonelikler')), '/aboneliklerim');
      expect(mapWebPath(Uri.parse('/hesabim/grup-derslerim/e1')), '/grup-derslerim');
      expect(mapWebPath(Uri.parse('/hesabim/davet')), '/davet');
      expect(mapWebPath(Uri.parse('/ogretmen-paneli/grup-dersleri/g1')), '/grup-derslerim');
      expect(DeepLinks.locationFor(Uri.parse('https://pikampus.com/grup-dersleri/GD-1')), '/grup-dersleri/GD-1');
      expect(DeepLinks.locationFor(Uri.parse('https://pikampus.com/rehber')), '/rehber');
    });

    test('bildirim hedefleri ve giriş gerektirenler', () {
      expect(routeForTarget('packages', null), '/paketlerim');
      expect(routeForTarget('subscriptions', null), '/aboneliklerim');
      expect(routeForTarget('myGroups', null), '/grup-derslerim');
      expect(routeForTarget('group', 'GD-1'), '/grup-dersleri/GD-1');
      expect(routeForTarget('invite', null), '/davet');
      expect(Routes.needsAuth('/paketlerim'), isTrue);
      expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/paket'), isTrue);
      expect(Routes.needsAuth('/ogretmen/ayse-yilmaz/abonelik/p1'), isTrue);
      expect(Routes.needsAuth('/grup-oturum/s1/sinif'), isTrue);
      expect(Routes.needsAuth('/grup-dersleri'), isFalse);
      expect(Routes.needsAuth('/grup-dersleri/GD-1'), isFalse);
      expect(Routes.purchasePayment(PurchaseKind.subscription, 's1'), '/satin-al/abonelik/s1');
      expect(PurchaseKind.fromSlug('grup'), PurchaseKind.group);
      expect(Routes.packageBuy('ayse-yilmaz', recurring: true), '/ogretmen/ayse-yilmaz/paket?tekrar=1');
    });
  });
}
