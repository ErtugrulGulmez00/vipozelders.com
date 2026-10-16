// Form doğrulamaları sunucudaki kurallarla aynıdır; son karar her zaman sunucunundur.

String? passwordProblem(String? password) {
  final value = password ?? '';
  if (value.length < 8) return 'Şifre en az 8 karakter olmalı.';
  if (value.length > 128) return 'Şifre en fazla 128 karakter olabilir.';
  if (!RegExp(r'[a-zA-ZçğıöşüÇĞİÖŞÜ]').hasMatch(value) || !RegExp(r'\d').hasMatch(value)) {
    return 'Şifre en az bir harf ve bir rakam içermeli.';
  }
  return null;
}

String? emailProblem(String? email) {
  final value = (email ?? '').trim();
  if (value.isEmpty) return 'E-posta adresinizi yazın.';
  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value)) return 'Geçerli bir e-posta adresi yazın.';
  return null;
}

/// Türkiye cep telefonu: 05XX XXX XX XX (boş bırakılabilir).
String? phoneProblem(String? phone, {bool required = false}) {
  final digits = (phone ?? '').replaceAll(RegExp(r'\D'), '');
  if (digits.isEmpty) return required ? 'Telefon numaranızı yazın.' : null;
  final normalized = digits.startsWith('90') && digits.length == 12 ? '0${digits.substring(2)}' : (digits.length == 10 ? '0$digits' : digits);
  if (!RegExp(r'^05\d{9}$').hasMatch(normalized)) return 'Telefon numarası 05XX XXX XX XX biçiminde olmalı.';
  return null;
}

String? requiredText(String? value, String message, {int min = 1}) {
  if ((value ?? '').trim().length < min) return message;
  return null;
}
