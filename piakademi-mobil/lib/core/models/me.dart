import '../format/text.dart';
import 'json.dart';

enum UserRole { student, teacher, other }

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
  final StudentInfo? student;
  final TeacherInfo? teacher;

  String get fullName => '$firstName $lastName'.trim();
  bool get isTeacher => role == UserRole.teacher;
  bool get isStudent => role == UserRole.student;

  String get initials => initialsOf(fullName);

  factory Me.fromJson(Json json) {
    final role = asString(json['role']);
    return Me(
      id: asString(json['id']),
      role: role == 'TEACHER'
          ? UserRole.teacher
          : role == 'STUDENT'
              ? UserRole.student
              : UserRole.other,
      firstName: asString(json['firstName']),
      lastName: asString(json['lastName']),
      email: asStringOrNull(json['email']),
      username: asStringOrNull(json['username']),
      phone: asStringOrNull(json['phone']),
      emailVerified: asBool(json['emailVerified']),
      mustChangePassword: asBool(json['mustChangePassword']),
      unreadNotifications: asInt(json['unreadNotifications']),
      student: json['student'] is Map ? StudentInfo.fromJson(asJson(json['student'])) : null,
      teacher: json['teacher'] is Map ? TeacherInfo.fromJson(asJson(json['teacher'])) : null,
    );
  }

  Me copyWith({int? unreadNotifications, bool? mustChangePassword}) => Me(
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
