import 'dart:io';
import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Formulário de pedido do cliente (B2C).
///
/// O cliente descreve a encomenda (tipo, tamanho, peso, foto), o alcance
/// (mesma cidade ou outro município) e os pontos de retirada/entrega.
/// Novos pedidos usam campos próprios na API; `notes` contém apenas a
/// observação livre. O core mantém leitura compatível com pedidos antigos.
class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({
    super.key,
    required this.onSubmit,
    required this.geocode,
    required this.uploadPhoto,
  });

  final Future<void> Function(Map<String, dynamic> form) onSubmit;
  final Future<GeocodeResult> Function(String address) geocode;
  final Future<String> Function(XFile photo) uploadPhoto;

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final formKey = GlobalKey<FormState>();
  final pickup = TextEditingController();
  final delivery = TextEditingController();
  final recipient = TextEditingController();
  final phone = TextEditingController();
  final weight = TextEditingController();
  final obs = TextEditingController();

  final ImagePicker _picker = ImagePicker();
  XFile? photo;

  String productType = OrderMeta.productTypes.first;
  String size = OrderMeta.sizes[1];
  String scope = OrderMeta.scopes.first;

  bool loading = false;
  bool photoMissing = false;
  String? error;

  @override
  void dispose() {
    pickup.dispose();
    delivery.dispose();
    recipient.dispose();
    phone.dispose();
    weight.dispose();
    obs.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 82,
      );
      if (file != null && mounted) {
        setState(() {
          photo = file;
          photoMissing = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => error = 'Falha ao abrir $source: $e');
      }
    }
  }

  void _showPhotoSource() {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Tirar foto'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Escolher da galeria'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final formOk = formKey.currentState!.validate();
    // B2C-05 / DEC-01: a foto não é um campo de formulário, então o
    // `validate()` não a alcança. Sem esta checagem o app mandaria um pedido
    // que a API rejeita com 400.
    setState(() => photoMissing = photo == null);
    if (!formOk || photo == null) {
      if (photo == null) {
        setState(() => error = 'Anexe uma foto da encomenda para continuar.');
      }
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final pickupGeo = await widget.geocode(pickup.text.trim());
      final deliveryGeo = await widget.geocode(delivery.text.trim());

      final photoUrl = await widget.uploadPhoto(photo!);

      final meta = OrderMeta(
        productType: productType,
        size: size,
        weightKg: double.tryParse(weight.text.trim().replaceAll(',', '.')),
        scope: scope,
        photoUrls: [photoUrl],
        notes: obs.text.trim().isEmpty ? null : obs.text.trim(),
      );

      await widget.onSubmit({
        'pickupAddress': pickupGeo.formattedAddress.isNotEmpty
            ? pickupGeo.formattedAddress
            : pickup.text.trim(),
        'pickupLatitude': pickupGeo.latitude,
        'pickupLongitude': pickupGeo.longitude,
        'deliveryAddress': deliveryGeo.formattedAddress.isNotEmpty
            ? deliveryGeo.formattedAddress
            : delivery.text.trim(),
        'deliveryLatitude': deliveryGeo.latitude,
        'deliveryLongitude': deliveryGeo.longitude,
        'recipientName': recipient.text.trim(),
        'recipientPhone': phone.text.trim(),
        ...meta.toApiJson(),
      });
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => error = 'Não foi possível publicar o pedido: $e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Novo pedido')),
      body: Form(
        key: formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            _sectionTitle('A encomenda'),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: productType,
              decoration: const InputDecoration(
                labelText: 'Tipo de encomenda',
                prefixIcon: Icon(Icons.inventory_2_outlined),
              ),
              items: OrderMeta.productTypes
                  .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                  .toList(),
              onChanged: (v) => setState(() => productType = v ?? productType),
            ),
            const SizedBox(height: 14),
            const Text(
              'Tamanho',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'Pequeno',
                  label: Text('P'),
                  tooltip: 'Até 30 cm',
                ),
                ButtonSegment(
                  value: 'Médio',
                  label: Text('M'),
                  tooltip: 'Até 60 cm',
                ),
                ButtonSegment(
                  value: 'Grande',
                  label: Text('G'),
                  tooltip: 'Mais de 60 cm',
                ),
              ],
              selected: {size},
              onSelectionChanged: (s) => setState(() => size = s.first),
            ),
            const SizedBox(height: 4),
            const Text(
              'P: até 30 cm · M: até 60 cm · G: mais de 60 cm',
              style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: weight,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Peso aproximado (kg)',
                prefixIcon: Icon(Icons.monitor_weight_outlined),
                suffixText: 'kg',
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Informe o peso';
                final parsed = double.tryParse(v.trim().replaceAll(',', '.'));
                if (parsed == null || parsed <= 0) {
                  return 'Peso inválido';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            const Text(
              'Alcance',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'Mesma cidade',
                  label: Text('Mesma cidade'),
                  icon: Icon(Icons.location_city_outlined),
                ),
                ButtonSegment(
                  value: 'Outra cidade ou município',
                  label: Text('Outra cidade'),
                  icon: Icon(Icons.map_outlined),
                ),
              ],
              selected: {scope},
              onSelectionChanged: (s) => setState(() => scope = s.first),
            ),
            const SizedBox(height: 16),
            _photoSection(),
            const SizedBox(height: 22),
            _sectionTitle('De onde sai'),
            const SizedBox(height: 10),
            TextFormField(
              controller: pickup,
              decoration: const InputDecoration(
                labelText: 'Endereço de retirada',
                prefixIcon: Icon(Icons.trip_origin),
              ),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatório' : null,
            ),
            const SizedBox(height: 14),
            _sectionTitle('Para onde vai'),
            const SizedBox(height: 10),
            TextFormField(
              controller: delivery,
              decoration: const InputDecoration(
                labelText: 'Endereço de entrega',
                prefixIcon: Icon(Icons.flag_outlined),
              ),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatório' : null,
            ),
            const SizedBox(height: 22),
            _sectionTitle('Destinatário'),
            const SizedBox(height: 10),
            TextFormField(
              controller: recipient,
              decoration: const InputDecoration(
                labelText: 'Nome de quem recebe',
                prefixIcon: Icon(Icons.person_outline),
              ),
              validator: (v) => v == null || v.isEmpty ? 'Obrigatório' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Telefone do destinatário',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Obrigatório';
                final digits = v.replaceAll(RegExp(r'\D'), '');
                if (digits.length < 10) return 'Telefone incompleto';
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: obs,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Observações (opcional)',
                alignLabelWithHint: true,
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: loading ? null : _submit,
              icon: loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.rocket_launch_outlined),
              label: Text(loading ? 'Publicando...' : 'Publicar pedido'),
            ),
            const SizedBox(height: 8),
            const Text(
              'O pedido fica visível para os motoboys, que aceitam ou recusam.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
    text,
    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
  );

  Widget _photoSection() {
    if (photo == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          OutlinedButton.icon(
            onPressed: _showPhotoSource,
            icon: const Icon(Icons.add_a_photo_outlined),
            label: const Text('Foto da encomenda (obrigatória)'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
              foregroundColor: photoMissing ? Colors.red : null,
              side: photoMissing
                  ? const BorderSide(color: Colors.red)
                  : null,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            photoMissing
                ? 'Anexe uma foto da encomenda para continuar.'
                : 'A foto ajuda o motoboy a decidir e protege os dois lados.',
            style: TextStyle(
              color: photoMissing ? Colors.red : AquiLogColors.muted,
              fontSize: 12,
            ),
          ),
        ],
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.file(
                File(photo!.path),
                width: 64,
                height: 64,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Foto do produto anexada. Ela ajuda o motoboy a decidir.',
                style: TextStyle(color: AquiLogColors.muted, fontSize: 13),
              ),
            ),
            IconButton(
              onPressed: () => setState(() => photo = null),
              icon: const Icon(Icons.delete_outline),
              tooltip: 'Remover foto',
            ),
          ],
        ),
      ),
    );
  }
}
