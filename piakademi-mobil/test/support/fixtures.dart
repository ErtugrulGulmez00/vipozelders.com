// Testlerde kullanılan örnek API yanıtları (sunucudaki gerçek biçimle aynı).

const fakeBase = 'https://ornek.pikampus.test';

Map<String, dynamic> catalogJson() => {
      'site': {'name': 'Pi Kampüs', 'tagline': 'Doğru öğretmen bir tık uzağında.', 'contactEmail': 'destek@example.com', 'contactPhone': '', 'url': fakeBase},
      'maintenance': {'on': false, 'message': null},
      'rules': {
        'paymentHoldMinutes': 15,
        'approvalWindowHours': 12,
        'minNoticeHours': 12,
        'maxAdvanceDays': 30,
        'classroomOpensMinutesBefore': 10,
        'fullRefundHours': 24,
        'partialRefundHours': 2,
        'partialRefundPercent': 50,
        'disputeWindowHours': 48,
        'reviewWindowDays': 30,
        'questionAnswerHours': 24,
      },
      'levels': [
        {
          'id': 3,
          'name': 'Ortaokul',
          'slug': 'ortaokul',
          'group': 'SCHOOL',
          'grades': [
            {'id': 7, 'name': '5. Sınıf'},
            {'id': 10, 'name': '8. Sınıf'},
          ],
          'subjectIds': [5],
        },
      ],
      'subjects': [
        {'id': 5, 'name': 'Matematik', 'slug': 'matematik'},
      ],
      'services': [
        {'id': 1, 'name': 'Özel Ders', 'slug': 'ozel-ders', 'description': 'Konu anlatımı ve birebir çalışma'},
      ],
      'cities': [
        {'id': 34, 'name': 'İstanbul', 'slug': 'istanbul'},
      ],
      'sortOptions': [
        {'value': 'onerilen', 'label': 'Önerilen'},
      ],
      'timeOptions': [
        {'value': 'hafta-sonu', 'label': 'Hafta sonu'},
      ],
      'pages': [
        {'slug': 'kvkk-aydinlatma-metni', 'title': 'KVKK Aydınlatma Metni', 'url': '$fakeBase/sayfa/kvkk-aydinlatma-metni'},
      ],
      'paymentReturnPrefix': '$fakeBase/odeme/sonuc/',
    };

Map<String, dynamic> teacherCardJson() => {
      'userId': 't1',
      'slug': 'ayse-yilmaz',
      'name': 'Ayşe Yılmaz',
      'headline': 'Matematik öğretmeni',
      'photoUrl': null,
      'ratingAvg': 4.67,
      'ratingCount': 3,
      'completedLessons': 9,
      'experienceYears': 12,
      'cityName': 'İstanbul',
      'offersOnline': true,
      'offersInPerson': false,
      'verified': true,
      'featured': true,
      'minHourlyPrice': 60000,
      'subjects': ['Matematik'],
      'avgResponseMinutes': 13,
    };

Map<String, dynamic> teacherProfileJson({bool questions = false}) => {
      ...teacherCardJson(),
      'bio': 'Boğaziçi mezunu, 12 yıllık deneyim.',
      'videoUrl': null,
      'education': 'Boğaziçi Üniversitesi',
      'gender': 'FEMALE',
      'inPersonAtStudentHome': false,
      'inPersonAtTeacherPlace': false,
      'city': {'id': 34, 'name': 'İstanbul'},
      'district': null,
      'serviceDistricts': <Map<String, dynamic>>[],
      'offerings': [
        {
          'id': 'o1',
          'level': {'id': 3, 'name': 'Ortaokul', 'slug': 'ortaokul'},
          'subject': {'id': 5, 'name': 'Matematik', 'slug': 'matematik'},
          'service': {'id': 1, 'name': 'Özel Ders', 'slug': 'ozel-ders'},
          'hourlyPrice': 80000,
          'durations': [
            {'minutes': 45, 'price': 60000},
            {'minutes': 60, 'price': 80000},
          ],
          'questionPrice': questions ? 15000 : null,
        },
      ],
      'reviews': [
        {
          'id': 'r1',
          'rating': 5,
          'comment': 'Çok sabırlı.',
          'studentName': 'Hülya K.',
          'lesson': 'Ortaokul Matematik',
          'teacherReply': null,
          'teacherRepliedAt': null,
          'createdAt': '2026-10-06T16:00:00.000Z',
        },
      ],
      'isFavorite': false,
    };

/// Yarın 11:00 (İstanbul) boş saat; bugün dolu.
Map<String, dynamic> slotsJson(DateTime now) {
  final today = DateTime.utc(now.year, now.month, now.day);
  String day(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  final tomorrow = today.add(const Duration(days: 1));
  return {
    'startDate': day(today),
    'durationMinutes': 60,
    'days': [
      {
        'date': day(today),
        'weekday': 'Bug',
        'day': '${today.day} Eki',
        'slots': [
          {'startAt': today.add(const Duration(hours: 15)).toIso8601String(), 'endAt': today.add(const Duration(hours: 16)).toIso8601String(), 'time': '18:00', 'available': false},
        ],
      },
      {
        'date': day(tomorrow),
        'weekday': 'Yrn',
        'day': '${tomorrow.day} Eki',
        'slots': [
          {'startAt': tomorrow.add(const Duration(hours: 8)).toIso8601String(), 'endAt': tomorrow.add(const Duration(hours: 9)).toIso8601String(), 'time': '11:00', 'available': true},
        ],
      },
    ],
  };
}

/// sides: GET /ben taraf bilgisi (kurum / özel ders); verilmezse yalnızca özel ders tarafı
Map<String, dynamic> meJson({String role = 'STUDENT', bool mustChangePassword = false, Map<String, dynamic>? sides}) => {
      'id': 'u1',
      'role': role,
      'firstName': role == 'TEACHER' ? 'Ayşe' : (role == 'CENTER' ? 'Kemal' : 'Fatma'),
      'lastName': role == 'TEACHER' ? 'Yılmaz' : (role == 'CENTER' ? 'Arslan' : 'Demirtaş'),
      'email': role == 'TEACHER' ? null : 'veli@ornek.com',
      'sides': sides ?? {'kurum': false, 'ozel': role != 'CENTER', 'staff': false, 'portal': false, 'privateActivity': role == 'TEACHER'},
      'username': role == 'TEACHER' ? 'ayse.yilmaz' : null,
      'phone': '05321112233',
      'emailVerified': true,
      'mustChangePassword': mustChangePassword,
      'unreadNotifications': 2,
      'student': role == 'STUDENT'
          ? {
              'accountType': 'PARENT',
              'city': {'id': 34, 'name': 'İstanbul'},
              'marketingConsent': false,
            }
          : null,
      'teacher': role == 'TEACHER' ? {'slug': 'ayse-yilmaz', 'status': 'PUBLISHED', 'verified': true, 'photoUrl': null} : null,
    };

Map<String, dynamic> bookingDetailJson({required String status, DateTime? startAt, bool failed = false, String mode = 'ONLINE'}) {
  final start = startAt ?? DateTime.utc(2026, 10, 17, 8);
  return {
    'id': 'b1',
    'code': 'VD-TEST01',
    'status': status,
    'statusLabel': switch (status) {
      'PENDING_PAYMENT' => 'Ödeme bekleniyor',
      'PENDING_APPROVAL' => 'Öğretmen onayı bekleniyor',
      'CONFIRMED' => 'Onaylandı',
      _ => status,
    },
    'startAt': start.toIso8601String(),
    'endAt': start.add(const Duration(hours: 1)).toIso8601String(),
    'durationMinutes': 60,
    'levelName': 'Ortaokul',
    'subjectName': 'Matematik',
    'serviceName': 'Özel Ders',
    'mode': mode,
    'learnerName': 'Ali',
    'amount': 80000,
    'approvalDeadline': status == 'PENDING_APPROVAL' ? DateTime.now().toUtc().add(const Duration(hours: 12)).toIso8601String() : null,
    'isTest': false,
    'counterpart': {'name': 'Ayşe Yılmaz', 'photoUrl': null, 'teacherSlug': 'ayse-yilmaz'},
    'learnerGrade': '8. Sınıf',
    'inPersonPlace': null,
    'note': null,
    'price': 80000,
    'refundedAmount': 0,
    'holdExpiresAt': status == 'PENDING_PAYMENT' ? DateTime.now().toUtc().add(const Duration(minutes: 15)).toIso8601String() : null,
    'rejectionReason': null,
    'cancelReason': null,
    'disputeReason': null,
    'location': null,
    'classroom': mode == 'ONLINE' ? {'opensAt': start.subtract(const Duration(minutes: 10)).toIso8601String(), 'closesAt': start.add(const Duration(minutes: 75)).toIso8601String(), 'open': false} : null,
    'createdAt': '2026-10-16T05:00:00.000Z',
    'question': null,
    'events': [
      {'status': status, 'statusLabel': 'Öğretmen onayı bekleniyor', 'note': 'Ödeme alındı', 'createdAt': '2026-10-16T05:01:00.000Z'},
    ],
    'payments': [
      {
        'id': 'p1',
        'provider': 'paytr',
        'amount': 80000,
        'refundedAmount': 0,
        'status': failed ? 'FAILED' : (status == 'PENDING_PAYMENT' ? 'INITIATED' : 'SUCCEEDED'),
        'statusLabel': failed ? 'Başarısız' : 'Ödendi',
        'failureReason': failed ? 'Kart bankası ödemeyi onaylamadı.' : null,
        'createdAt': '2026-10-16T05:00:30.000Z',
        'refunds': <Map<String, dynamic>>[],
      },
    ],
    'review': null,
    'actions': {
      'canPay': status == 'PENDING_PAYMENT',
      'canJoin': false,
      'canCancel': status == 'PENDING_APPROVAL' || status == 'CONFIRMED',
      'cancelPreview': {'refundAmount': 80000, 'refundPercent': 100, 'reason': null},
      'canReview': false,
      'canDispute': false,
      'canMessage': false,
    },
  };
}

/// GET /kurum bağlantısı
Map<String, dynamic> centerLinkJson({bool studentAccount = false}) => {
      'id': 'g1',
      'relation': studentAccount ? null : 'Anne',
      'isStudentAccount': studentAccount,
      'student': {'firstName': 'Ali', 'lastName': 'Demirtaş', 'gradeName': '8. Sınıf', 'groups': ['LGS-A']},
      'center': {'name': 'Başarı Etüt Merkezi', 'phone': '0212 000 00 00', 'logoUrl': null},
    };

/// GET /kurum/{id}: Etüt Merkezi paketi (ders programı yok), deneme modülü kapalı
Map<String, dynamic> centerChildJson({bool studentAccount = false}) => {
      'id': 'g1',
      'isStudentAccount': studentAccount,
      'modules': {'exams': false, 'payments': true, 'homework': true, 'study': true, 'questions': true, 'etuds': true, 'hall': true, 'schedule': false},
      'student': {'firstName': 'Ali', 'lastName': 'Demirtaş', 'gradeName': '8. Sınıf', 'studentNumber': '12'},
      'center': {'name': 'Başarı Etüt Merkezi', 'phone': '0212 000 00 00', 'email': null, 'address': null, 'logoUrl': null},
      'balance': {'total': 0, 'paid': 0, 'remaining': 0, 'overdue': 0},
    };
