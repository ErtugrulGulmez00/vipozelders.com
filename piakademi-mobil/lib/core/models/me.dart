import '../format/text.dart';
import 'json.dart';

/// other: yönetici (uygulamada kullanılamaz)
enum UserRole { student, teacher, center, other }

/// Giriş yapan kullanıcı (`GET /ben`).
class Me {
  const Me({
    required this.id,
    required this.role,
    required this.firstName,
    required this.lastName,
    this.email,
    this.username,
    this.phone,
    this.emailVerified = false,
    this.mustChangePassword = false,
    this.unreadNotifications = 0,
    this.unreadMessages = 0,
    this.unreadKurum,
    this.unreadOzel,
    this.questionCredits,
    this.whatsappNotifications = true,
    this.sides = const AccountSides(),
    this.student,
    this.teacher,
  });

  final String id;
  final UserRole role;
  final String firstName;
  final String lastName;
  final String? email;
  final String? username;
  final String? phone;
  final bool emailVerified;
  final bool mustChangePassword;
  final int unreadNotifications;

  /// Okunmamış mesaj konuşması sayısı
  final int unreadMessages;

  /// İki taraflı hesapta taraf başına okunmamış bildirim (tek taraflıda null; unreadNotifications geçerli)
  final int? unreadKurum;
  final int? unreadOzel;

  /// Soru kredisi bakiyesi (yalnızca veli/öğrenci)
  final int? questionCredits;

  /// Önemli bildirimleri WhatsApp ile de almak istiyor
  final bool whatsappNotifications;

  /// Kurum ve özel ders tarafları (sitedeki "tek hesap, iki kapı")
  final AccountSides sides;
  final StudentInfo? student;
  final TeacherInfo? teacher;

  String get fullName => '$firstName $lastName'.trim();
  bool get isTeacher => role == UserRole.teacher;
  bool get isStudent => role == UserRole.student;

  /// Yalnızca kurum personeli (özel ders tarafı yok)
  bool get isCenter => role == UserRole.center;

  String get initials => initialsOf(fullName);

  factory Me.fromJson(Json json) {
    final role = asString(json['role']);
    final bySide = asJsonOrNull(json['unreadBySide']);
    return Me(
      id: asString(json['id']),
      role: switch (role) {
        'TEACHER' => UserRole.teacher,
        'STUDENT' => UserRole.student,
        'CENTER' => UserRole.center,
        _ => UserRole.other,
      },
      firstName: asString(json['firstName']),
      lastName: asString(json['lastName']),
      email: asStringOrNull(json['email']),
      username: asStringOrNull(json['username']),
      phone: asStringOrNull(json['phone']),
      emailVerified: asBool(json['emailVerified']),
      mustChangePassword: asBool(json['mustChangePassword']),
      unreadNotifications: asInt(json['unreadNotifications']),
      unreadMessages: asInt(json['unreadMessages']),
      unreadKurum: bySide == null ? null : asInt(bySide['kurum']),
      unreadOzel: bySide == null ? null : asInt(bySide['ozel']),
      questionCredits: asIntOrNull(json['questionCredits']),
      whatsappNotifications: asBool(json['whatsappNotifications'], true),
      sides: json['sides'] is Map ? AccountSides.fromJson(asJson(json['sides'])) : AccountSides(ozel: role != 'CENTER'),
      student: json['student'] is Map ? StudentInfo.fromJson(asJson(json['student'])) : null,
      teacher: json['teacher'] is Map ? TeacherInfo.fromJson(asJson(json['teacher'])) : null,
    );
  }

  Me copyWith({int? unreadNotifications, int? unreadMessages, int? questionCredits, bool? mustChangePassword, int? unreadKurum, int? unreadOzel}) => Me(
        id: id,
        role: role,
        firstName: firstName,
        lastName: lastName,
        email: email,
        username: username,
        phone: phone,
        emailVerified: emailVerified,
        mustChangePassword: mustChangePassword ?? this.mustChangePassword,
        unreadNotifications: unreadNotifications ?? this.unreadNotifications,
        unreadMessages: unreadMessages ?? this.unreadMessages,
        unreadKurum: unreadKurum ?? this.unreadKurum,
        unreadOzel: unreadOzel ?? this.unreadOzel,
        questionCredits: questionCredits ?? this.questionCredits,
        whatsappNotifications: whatsappNotifications,
        sides: sides,
        student: student,
        teacher: teacher,
      );
}

class StudentInfo {
  const StudentInfo({required this.accountType, this.cityId, this.cityName, this.marketingConsent = false});

  /// PARENT veya STUDENT
  final String accountType;
  final int? cityId;
  final String? cityName;
  final bool marketingConsent;

  bool get isParent => accountType == 'PARENT';

  factory StudentInfo.fromJson(Json json) {
    final city = asJsonOrNull(json['city']);
    return StudentInfo(
      accountType: asString(json['accountType'], 'PARENT'),
      cityId: city == null ? null : asIntOrNull(city['id']),
      cityName: city == null ? null : asStringOrNull(city['name']),
      marketingConsent: asBool(json['marketingConsent']),
    );
  }
}

class TeacherInfo {
  const TeacherInfo({required this.slug, required this.status, this.verified = false, this.photoUrl});

  final String slug;

  /// DRAFT, PUBLISHED, SUSPENDED
  final String status;
  final bool verified;
  final String? photoUrl;

  factory TeacherInfo.fromJson(Json json) => TeacherInfo(
        slug: asString(json['slug']),
        status: asString(json['status']),
        verified: asBool(json['verified']),
        photoUrl: asStringOrNull(json['photoUrl']),
      );
}

/// Hesabın tarafları: kurum (personel paneli ya da veli/öğrenci portalı) ve özel ders.
class AccountSides {
  const AccountSides({this.kurum = false, this.ozel = true, this.staff = false, this.portal = false, this.privateActivity = false});

  /// Kurum tarafı var (etkin personel üyeliği ya da veli/öğrenci portalı bağlantısı)
  final bool kurum;

  /// Özel ders tarafı açık (kurumun açtığı ve özel derste işlemi olmayan öğrenci hesabında kapalı)
  final bool ozel;

  /// Bir kurumun etkin personeli (kurum paneli)
  final bool staff;

  /// Veli/öğrenci portalı bağlantısı var
  final bool portal;

  /// Özel ders tarafında işlem yapmış (kurum velisine özel derse geçiş yalnızca o zaman gösterilir)
  final bool privateActivity;

  factory AccountSides.fromJson(Json json) => AccountSides(
        kurum: asBool(json['kurum']),
        ozel: asBool(json['ozel'], true),
        staff: asBool(json['staff']),
        portal: asBool(json['portal']),
        privateActivity: asBool(json['privateActivity']),
      );
}
