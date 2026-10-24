import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/account_screen.dart';
import '../../features/account/delete_account_screen.dart';
import '../../features/account/profile_edit_screen.dart';
import '../../features/account/web_page_screen.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/auth/forgot_password_screen.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/register_screen.dart';
import '../../features/auth/splash_screen.dart';
import '../../features/booking/booking_screen.dart';
import '../../features/booking/payment_screen.dart';
import '../../features/booking/payment_status_screen.dart';
import '../../features/booking/question_screen.dart';
import '../../features/center/center_child_screen.dart';
import '../../features/center/center_list_screen.dart';
import '../../features/center/invite_screen.dart';
import '../../features/center/report_card_screen.dart';
import '../../features/classroom/classroom_screen.dart';
import '../../features/explore/explore_screen.dart';
import '../../features/favorites/favorites_screen.dart';
import '../../features/messages/messages_screen.dart';
import '../../features/messages/thread_screen.dart';
import '../../features/questions/ask_question_screen.dart';
import '../../features/questions/credit_payment_status_screen.dart';
import '../../features/questions/credits_screen.dart';
import '../../features/questions/my_questions_screen.dart';
import '../../features/questions/question_detail_screen.dart';
import '../../features/lessons/lesson_detail_screen.dart';
import '../../features/lessons/lessons_screen.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/shell/shells.dart';
import '../../features/teacher/earnings_screen.dart';
import '../../features/teacher/pool_question_screen.dart';
import '../../features/teacher/pool_screen.dart';
import '../../features/teacher/requests_screen.dart';
import '../../features/teacher/teacher_account_screen.dart';
import '../../features/teacher/teacher_calendar_screen.dart';
import '../../features/teacher/teacher_home_screen.dart';
import '../../features/teacher/teacher_lessons_screen.dart';
import '../../features/teacher/teacher_reviews_screen.dart';
import '../../features/teachers/teacher_list_screen.dart';
import '../../features/teachers/teacher_profile_screen.dart';
import '../api/pi_api.dart';
import '../auth/session.dart';
import '../models/booking.dart';
import '../providers.dart';

export '../api/pi_api.dart' show TeacherQuery;

final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

class Routes {
  Routes._();

  static const splash = '/splash';
  static const offline = '/baglanti';
  static const explore = '/kesfet';
  static const lessons = '/derslerim';
  static const center = '/kurumum';
  static const favorites = '/favoriler';
  static const account = '/hesabim';
  static const login = '/giris';
  static const register = '/kayit';
  static const forgot = '/sifremi-unuttum';
  static const changePassword = '/sifre-degistir';
  static const teachers = '/ogretmenler';
  static const notifications = '/bildirimler';
  static const profileEdit = '/hesap/profil';
  static const deleteAccount = '/hesap/silme';

  static const teacherHome = '/panel';
  static const teacherRequests = '/panel/talepler';
  static const teacherLessons = '/panel/dersler';
  static const teacherCalendar = '/panel/takvim';
  static const teacherAccount = '/panel/hesap';
  static const earnings = '/panel/kazanclar';
  static const teacherReviews = '/panel/yorumlar';
  static const teacherPool = '/panel/soru-havuzu';

  // Soru kredisi ve soru havuzu (veli/öğrenci), mesajlar (iki taraf)
  static const ask = '/soru-sor';
  static const askQuestion = '/soru-sor/gonder';
  static const myQuestions = '/sorularim';
  static const messages = '/mesajlar';

  static String teacher(String slug) => '/ogretmen/$slug';
  static String booking(String slug, {String? offeringId}) => Uri(path: '/ogretmen/$slug/randevu', queryParameters: offeringId == null ? null : {'ders': offeringId}).toString();
  static String question(String slug, {String? offeringId}) => Uri(path: '/ogretmen/$slug/soru', queryParameters: offeringId == null ? null : {'ders': offeringId}).toString();
  static String lesson(String id) => '/ders/$id';
  static String intro(String slug) => '/ogretmen/$slug/tanisma';
  static String messageTeacher(String slug) => '/ogretmen/$slug/mesaj';
  static String myQuestion(String id) => '/sorularim/$id';
  static String poolQuestion(String id) => '/panel/soru-havuzu/$id';
  static String thread(String id) => '/mesajlar/$id';
  static String creditPayment(String purchaseId) => '/kredi-odeme/$purchaseId';
  static String creditPaymentStatus(String purchaseId) => '/kredi-odeme-durumu/$purchaseId';
  static String classroom(String id) => '/ders/$id/sinif';
  static String payment(String bookingId) => '/odeme/$bookingId';
  static String paymentStatus(String bookingId) => '/odeme-durumu/$bookingId';
  static String centerChild(String id, {String? tab}) => Uri(path: '/kurum/$id', queryParameters: tab == null ? null : {'sekme': tab}).toString();
  static String reportCard(String id, String examId) => '/kurum/$id/deneme/$examId';
  static String invite(String token) => '/kurum-davet/$token';
  static String page(String slug) => '/sayfa/$slug';
  static String teacherWeb(String panelPath, String title) => Uri(path: '/panel/web', queryParameters: {'yol': panelPath, 'baslik': title}).toString();
  static String teacherSearch(TeacherQuery query) => Uri(path: teachers, queryParameters: query.toUri().isEmpty ? null : query.toUri()).toString();

  /// Giriş gerektiren tam ekran sayfalar.
  static bool needsAuth(String path) =>
      path.startsWith('/ders/') ||
      path.startsWith('/odeme') ||
      path.startsWith('/kredi-odeme') ||
      path.startsWith(askQuestion) ||
      path.startsWith(myQuestions) ||
      path.startsWith(messages) ||
      path.startsWith('/kurum/') ||
      path.startsWith('/kurum-davet/') ||
      path.startsWith('/hesap/') ||
      path.startsWith('/panel') ||
      path == notifications ||
      path == changePassword ||
      RegExp(r'^/ogretmen/[^/]+/(randevu|soru|tanisma|mesaj)$').hasMatch(path);

  static bool isAuthPage(String path) => path == login || path == register || path == forgot;

  static const studentOnly = [explore, lessons, center, favorites, account];
}

/// Sitenin adresleri uygulamadaki karşılıklarına çevrilir (bildirim bağlantıları ve App Links).
String? mapWebPath(Uri uri) {
  final path = uri.path;
  final lesson = RegExp(r'^/(?:hesabim/derslerim|ogretmen-paneli/dersler|odeme/sonuc)/([A-Za-z0-9]+)').firstMatch(path);
  if (lesson != null) return Routes.lesson(lesson.group(1)!);
  final center = RegExp(r'^/hesabim/kurum/([A-Za-z0-9]+)(?:/deneme/([A-Za-z0-9]+))?').firstMatch(path);
  if (center != null) {
    return center.group(2) != null ? Routes.reportCard(center.group(1)!, center.group(2)!) : Routes.centerChild(center.group(1)!);
  }
  if (path == '/hesabim/kurum') return Routes.center;
  if (path == '/hesabim/derslerim' || path == '/hesabim') return path == '/hesabim' ? Routes.account : Routes.lessons;
  if (path == '/hesabim/favoriler') return Routes.favorites;
  final question = RegExp(r'^/hesabim/sorularim/([A-Za-z0-9]+)').firstMatch(path);
  if (question != null) return Routes.myQuestion(question.group(1)!);
  if (path == '/hesabim/sorularim') return Routes.myQuestions;
  if (path == '/hesabim/krediler') return Routes.ask;
  if (path == '/hesabim/bildirimler' || path == '/ogretmen-paneli/bildirimler') return Routes.notifications;
  if (path.startsWith('/ogretmen-paneli/talepler')) return Routes.teacherRequests;
  if (path.startsWith('/ogretmen-paneli/kazanclar')) return Routes.earnings;
  if (path.startsWith('/ogretmen-paneli/yorumlar')) return Routes.teacherReviews;
  if (path.startsWith('/ogretmen-paneli/takvim')) return Routes.teacherCalendar;
  final poolQuestion = RegExp(r'^/ogretmen-paneli/soru-havuzu/([A-Za-z0-9]+)').firstMatch(path);
  if (poolQuestion != null) return Routes.poolQuestion(poolQuestion.group(1)!);
  if (path.startsWith('/ogretmen-paneli/soru-havuzu')) return Routes.teacherPool;
  final thread = RegExp(r'^/(?:hesabim|ogretmen-paneli)/mesajlar/([A-Za-z0-9]+)').firstMatch(path);
  if (thread != null) return Routes.thread(thread.group(1)!);
  if (path == '/hesabim/mesajlar' || path == '/ogretmen-paneli/mesajlar') return Routes.messages;
  if (path.startsWith('/ogretmen-paneli')) return Routes.teacherHome;
  final level = RegExp(r'^/ozel-ders/([a-z0-9-]+)(?:/([a-z0-9-]+))?').firstMatch(path);
  if (level != null) {
    return Routes.teacherSearch(TeacherQuery(level: level.group(1), subject: level.group(2)));
  }
  return null;
}

class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefresh();
  ref.listen(
    sessionProvider.select((s) => (s.status, s.me?.id, s.me?.role, s.me?.mustChangePassword)),
    (_, _) => refresh.ping(),
  );

  String home(SessionState s) => s.isTeacher ? Routes.teacherHome : Routes.explore;

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = ref.read(sessionProvider);
      final path = state.uri.path;
      final target = state.uri.toString();

      // Sitenin adresleri (bildirim, paylaşılan bağlantı)
      final mapped = mapWebPath(state.uri);
      if (mapped != null && mapped != target) return mapped;

      if (session.status == SessionStatus.loading) {
        return path == Routes.splash ? null : Uri(path: Routes.splash, queryParameters: {'devam': target}).toString();
      }
      if (session.status == SessionStatus.offline) {
        return path == Routes.offline ? null : Routes.offline;
      }
      if (path == Routes.splash || path == Routes.offline || path == '/') {
        final next = state.uri.queryParameters['devam'];
        if (next != null && next.isNotEmpty && next != Routes.splash && !next.startsWith(Routes.splash)) return next;
        return home(session);
      }

      if (session.isSignedIn) {
        if (session.mustChangePassword) return path == Routes.changePassword ? null : Routes.changePassword;
        if (Routes.isAuthPage(path)) {
          final next = state.uri.queryParameters['devam'];
          return (next != null && next.startsWith('/')) ? next : home(session);
        }
        if (session.isTeacher && Routes.studentOnly.contains(path)) return Routes.teacherHome;
        if (!session.isTeacher && path.startsWith('/panel')) return Routes.explore;
        return null;
      }

      // Misafir
      if (Routes.needsAuth(path)) return Uri(path: Routes.login, queryParameters: {'devam': target}).toString();
      return null;
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.offline, builder: (_, _) => const OfflineScreen()),
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),

      // Veli / öğrenci (ve misafir) alt menüsü
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => StudentShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.explore, builder: (_, _) => const ExploreScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.lessons, builder: (_, _) => const LessonsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.center, builder: (_, _) => const CenterListScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.favorites, builder: (_, _) => const FavoritesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.account, builder: (_, _) => const AccountScreen())]),
        ],
      ),

      // Öğretmen alt menüsü
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => TeacherShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.teacherHome, builder: (_, _) => const TeacherHomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.teacherRequests, builder: (_, _) => const RequestsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.teacherLessons, builder: (_, _) => const TeacherLessonsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.teacherCalendar, builder: (_, _) => const TeacherCalendarScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.teacherAccount, builder: (_, _) => const TeacherAccountScreen())]),
        ],
      ),

      // Tam ekran sayfalar
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.login,
        builder: (_, state) => LoginScreen(next: state.uri.queryParameters['devam']),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.register,
        builder: (_, state) => RegisterScreen(next: state.uri.queryParameters['devam']),
      ),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.forgot, builder: (_, _) => const ForgotPasswordScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.changePassword, builder: (_, _) => const ChangePasswordScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.teachers,
        builder: (_, state) => TeacherListScreen(
          initial: TeacherQuery.fromUri(state.uri.queryParameters),
          autofocus: state.uri.queryParameters['odak'] == '1',
        ),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/ogretmen/:slug',
        builder: (_, state) => TeacherProfileScreen(slug: state.pathParameters['slug']!),
        routes: [
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'randevu',
            builder: (_, state) => BookingScreen(slug: state.pathParameters['slug']!, offeringId: state.uri.queryParameters['ders']),
          ),
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'tanisma',
            builder: (_, state) => BookingScreen(slug: state.pathParameters['slug']!, offeringId: state.uri.queryParameters['ders'], intro: true),
          ),
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'mesaj',
            builder: (_, state) => ThreadScreen(teacherSlug: state.pathParameters['slug']!, teacherName: state.uri.queryParameters['ad']),
          ),
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'soru',
            builder: (_, state) => QuestionScreen(slug: state.pathParameters['slug']!, offeringId: state.uri.queryParameters['ders']),
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/odeme/:id',
        builder: (_, state) => PaymentScreen(bookingId: state.pathParameters['id']!, link: state.extra is PaymentLink ? state.extra as PaymentLink : null),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/odeme-durumu/:id',
        builder: (_, state) => PaymentStatusScreen(bookingId: state.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/ders/:id',
        builder: (_, state) => LessonDetailScreen(id: state.pathParameters['id']!),
        routes: [
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'sinif',
            builder: (_, state) => ClassroomScreen(bookingId: state.pathParameters['id']!),
          ),
        ],
      ),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.notifications, builder: (_, _) => const NotificationsScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.ask,
        builder: (_, _) => const CreditsScreen(),
        routes: [GoRoute(parentNavigatorKey: rootNavigatorKey, path: 'gonder', builder: (_, _) => const AskQuestionScreen())],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.myQuestions,
        builder: (_, _) => const MyQuestionsScreen(),
        routes: [GoRoute(parentNavigatorKey: rootNavigatorKey, path: ':id', builder: (_, state) => QuestionDetailScreen(id: state.pathParameters['id']!))],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/kredi-odeme/:id',
        builder: (_, state) => PaymentScreen(bookingId: state.pathParameters['id']!, link: state.extra is PaymentLink ? state.extra as PaymentLink : null, creditPurchase: true),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/kredi-odeme-durumu/:id',
        builder: (_, state) => CreditPaymentStatusScreen(purchaseId: state.pathParameters['id']!),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.messages,
        builder: (_, _) => const MessagesScreen(),
        routes: [GoRoute(parentNavigatorKey: rootNavigatorKey, path: ':id', builder: (_, state) => ThreadScreen(threadId: state.pathParameters['id']!))],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: Routes.teacherPool,
        builder: (_, _) => const TeacherPoolScreen(),
        routes: [GoRoute(parentNavigatorKey: rootNavigatorKey, path: ':id', builder: (_, state) => PoolQuestionScreen(id: state.pathParameters['id']!))],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/kurum/:id',
        builder: (_, state) => CenterChildScreen(id: state.pathParameters['id']!, initialTab: state.uri.queryParameters['sekme']),
        routes: [
          GoRoute(
            parentNavigatorKey: rootNavigatorKey,
            path: 'deneme/:examId',
            builder: (_, state) => ReportCardScreen(id: state.pathParameters['id']!, examId: state.pathParameters['examId']!),
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/kurum-davet/:token',
        builder: (_, state) => InviteScreen(token: state.pathParameters['token']!),
      ),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.profileEdit, builder: (_, _) => const ProfileEditScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.deleteAccount, builder: (_, _) => const DeleteAccountScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.earnings, builder: (_, _) => const EarningsScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: Routes.teacherReviews, builder: (_, _) => const TeacherReviewsScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/panel/web',
        builder: (_, state) => WebPageScreen.teacherPanel(
          path: state.uri.queryParameters['yol'] ?? '/ogretmen-paneli/profil',
          title: state.uri.queryParameters['baslik'] ?? 'Web paneli',
        ),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/sayfa/:slug',
        builder: (_, state) => WebPageScreen.page(slug: state.pathParameters['slug']!),
      ),
    ],
    errorBuilder: (context, state) => NotFoundScreen(location: state.uri.toString()),
  );

  ref.onDispose(() {
    router.dispose();
    refresh.dispose();
  });
  return router;
});

class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key, required this.location});

  final String location;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.explore_off_outlined, size: 56),
              const SizedBox(height: 12),
              Text('Sayfa bulunamadı', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 6),
              const Text('Bu bağlantı uygulamada açılamadı.', textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton(onPressed: () => context.go('/'), child: const Text('Ana sayfaya dön')),
            ],
          ),
        ),
      ),
    );
  }
}

/// Booking durumuna göre gidilecek ekran (bildirim hedefleri).
String routeForTarget(String screen, String? id) {
  switch (screen) {
    case 'booking':
      return id == null ? Routes.lessons : Routes.lesson(id);
    case 'requests':
      return Routes.teacherRequests;
    case 'reviews':
      return Routes.teacherReviews;
    case 'earnings':
      return Routes.earnings;
    case 'teacher':
      return id == null ? Routes.teachers : Routes.teacher(id);
    case 'centerStudent':
      return id == null ? Routes.center : Routes.centerChild(id);
    case 'center':
      return Routes.center;
    case 'question':
      return id == null ? Routes.myQuestions : Routes.myQuestion(id);
    case 'questions':
      return Routes.myQuestions;
    case 'credits':
      return Routes.ask;
    case 'poolQuestion':
      return id == null ? Routes.teacherPool : Routes.poolQuestion(id);
    case 'pool':
      return Routes.teacherPool;
    case 'thread':
      return id == null ? Routes.messages : Routes.thread(id);
    case 'messages':
      return Routes.messages;
    default:
      return Routes.notifications;
  }
}
