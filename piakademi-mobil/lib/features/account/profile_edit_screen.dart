import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/config.dart';
import '../../core/models/catalog.dart';
import '../../core/models/json.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/cards.dart';
import '../../core/widgets/feedback.dart';
import '../auth/validators.dart';
import '../teachers/pickers.dart';

/// Profil bilgileri. Öğretmenler yalnızca telefonunu değiştirebilir (profil web panelinden düzenlenir).
class ProfileEditScreen extends ConsumerStatefulWidget {
  const ProfileEditScreen({super.key});

  @override
  ConsumerState<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends ConsumerState<ProfileEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late final _me = ref.read(sessionProvider).me!;
  late final _firstName = TextEditingController(text: _me.firstName);
  late final _lastName = TextEditingController(text: _me.lastName);
  late final _phone = TextEditingController(text: _me.phone ?? '');
  late String _accountType = _me.student?.accountType ?? 'PARENT';
  late int? _cityId = _me.student?.cityId;
  late bool _marketing = _me.student?.marketingConsent ?? false;
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final Json changes = _me.isTeacher
        ? {'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim()}
        : {
            'firstName': _firstName.text.trim(),
            'lastName': _lastName.text.trim(),
            'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
            'accountType': _accountType,
            'cityId': _cityId,
            'marketingConsent': _marketing,
          };
    try {
      final me = await ref.read(apiProvider).updateMe(changes);
      ref.read(sessionProvider.notifier).updateMe(me);
      if (!mounted) return;
      showSnack(context, 'Bilgileriniz kaydedildi.');
      context.pop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(catalogProvider).valueOrNull;
    final teacher = _me.isTeacher;
    final city = catalog?.cityById(_cityId);
    return Scaffold(
      appBar: AppBar(title: const Text('Profil bilgileri')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (_error != null && _error!.fields.isEmpty) ...[NoticeBox(message: _error!.message, tone: Tone.rose), const SizedBox(height: 16)],
            if (teacher) ...[
              NoticeBox(
                message: 'Fotoğraf, tanıtım yazısı, dersler ve fiyatlar web panelinden düzenlenir.',
                action: TextButton.icon(
                  onPressed: () => openExternal(context, '${AppConfig.siteUrl}/ogretmen-paneli/profil'),
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: const Text('Web panelini aç'),
                ),
              ),
              const SizedBox(height: 16),
            ],
            TextFormField(
              controller: _firstName,
              enabled: !teacher,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: 'Ad', errorText: _error?.field('firstName')),
              validator: teacher ? null : (v) => requiredText(v, 'Adınızı yazın.', min: 2),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _lastName,
              enabled: !teacher,
              textCapitalization: TextCapitalization.words,
              decoration: InputDecoration(labelText: 'Soyad', errorText: _error?.field('lastName')),
              validator: teacher ? null : (v) => requiredText(v, 'Soyadınızı yazın.', min: 2),
            ),
            const SizedBox(height: 14),
            TextFormField(
              initialValue: _me.email ?? _me.username ?? '',
              enabled: false,
              decoration: InputDecoration(labelText: _me.email != null ? 'E-posta' : 'Kullanıcı adı', helperText: 'Değiştirmek için destek ekibine yazın.'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(labelText: 'Cep telefonu', hintText: '05XX XXX XX XX', errorText: _error?.field('phone')),
              validator: phoneProblem,
            ),
            if (!teacher) ...[
              const SizedBox(height: 20),
              Text('Hesap tipi', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'PARENT', label: Text('Veli')),
                  ButtonSegment(value: 'STUDENT', label: Text('Öğrenci (18+)')),
                ],
                selected: {_accountType},
                onSelectionChanged: (s) => setState(() => _accountType = s.first),
              ),
              const SizedBox(height: 20),
              PickerField(
                label: 'İl seçin',
                value: city?.name,
                icon: Icons.location_city_rounded,
                onTap: catalog == null
                    ? null
                    : () async {
                        final picked = await pickOption<City>(context, title: 'İl', options: catalog.cities, labelOf: (c) => c.name, allowClear: true, searchable: true, clearLabel: 'Belirtmek istemiyorum');
                        if (picked != null) setState(() => _cityId = picked.value?.id);
                      },
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _marketing,
                onChanged: (v) => setState(() => _marketing = v),
                title: const Text('Kampanya ve yenilik bildirimleri'),
                subtitle: const Text('E-posta/SMS ile haberdar olmak istiyorum.'),
              ),
            ],
            const SizedBox(height: 24),
            BusyButton(busy: _busy, onPressed: _save, label: 'Kaydet'),
          ],
        ),
      ),
    );
  }
}
