import 'package:aqui_log_core/aqui_log_core.dart';
import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class DeliveryDetailScreen extends StatefulWidget {
  const DeliveryDetailScreen({
    super.key,
    required this.delivery,
    required this.loadHistory,
    required this.onRate,
    this.onRetry,
    this.onUpdate,
    this.onConsentBoost,
    this.onCancel,
  });

  final DeliverySummary delivery;
  final Future<List<dynamic>> Function() loadHistory;
  final Future<void> Function(int score, String? comment) onRate;

  /// DISP-02 — "tentar de novo": reabre a busca esgotada (`MAX_ROUNDS`,
  /// `TIMEBOX` ou `NO_CANDIDATE`). Retorna o pedido atualizado.
  final Future<DeliverySummary> Function()? onRetry;

  /// DISP-02 — "editar": salva os campos restritos (endereços, destinatário,
  /// telefone, observação, janelas do agendado). Retorna o pedido atualizado.
  final Future<DeliverySummary> Function(Map<String, dynamic> form)? onUpdate;

  /// DISP-02 / DEC-03 §3.3 — consentimento explícito do aumento de valor.
  final Future<DeliverySummary> Function()? onConsentBoost;

  /// DISP-02 — "cancelar": encerra o pedido em `CANCELED`.
  final Future<void> Function(String? reason)? onCancel;

  @override
  State<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends State<DeliveryDetailScreen> {
  List<dynamic> history = [];
  bool loading = true;
  int score = 5;
  final comment = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      history = await widget.loadHistory();
    } catch (_) {}
    if (mounted) setState(() => loading = false);
  }

  Future<DeliverySummary?> _runAction(
    Future<DeliverySummary> Function() action,
    String doneMessage,
  ) async {
    try {
      final updated = await action();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(doneMessage)),
        );
      }
      return updated;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
      return null;
    }
  }

  void _onConsent() async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Aumento de valor'),
        content: const Text(
          'Você concorda em pagar o novo valor para destravar a busca do '
          'motoboy? O aumento só é aplicado com o seu aceite.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Não aceitar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Aceitar aumento'),
          ),
        ],
      ),
    );
    if (consent != true || widget.onConsentBoost == null) return;
    final updated = await _runAction(
      widget.onConsentBoost!,
      'Aumento aceito: a busca foi reaberta com o novo valor',
    );
    if (updated != null && mounted) {
      Navigator.of(context).pop(updated);
    }
  }

  void _onRetry() async {
    if (widget.onRetry == null) return;
    final updated = await _runAction(
      widget.onRetry!,
      'Busca reaberta: vamos continuar procurando um motoboy',
    );
    if (updated != null && mounted) {
      Navigator.of(context).pop(updated);
    }
  }

  void _openEdit() async {
    if (widget.onUpdate == null) return;
    final updated = await showDialog<DeliverySummary>(
      context: context,
      builder: (_) => _EditDeliveryDialog(
        delivery: widget.delivery,
        onSubmit: widget.onUpdate!,
      ),
    );
    if (updated != null && mounted) {
      Navigator.of(context).pop(updated);
    }
  }

  void _onCancel() async {
    if (widget.onCancel == null) return;
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => _CancelDeliveryDialog(),
    );
    if (reason == null) return;
    final ok = await _runAction(
      () async {
        await widget.onCancel!(reason.isEmpty ? null : reason);
        return widget.delivery;
      },
      'Pedido cancelado',
    );
    if (ok != null && mounted) {
      Navigator.of(context).pop(ok);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.delivery;
    final hasCoords =
        d.pickupLatitude != null &&
        d.pickupLongitude != null &&
        d.deliveryLatitude != null &&
        d.deliveryLongitude != null;

    return Scaffold(
      appBar: AppBar(title: Text(d.code)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (d.status == 'REQUESTED') ...[
            ..._dispatchStatusSection(d),
            const SizedBox(height: 16),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Status',
                    style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
                  ),
                  const SizedBox(height: 8),
                  StatusPill(d.status),
                  const SizedBox(height: 16),
                  Text(
                    d.code,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  if (d.recipientName != null) ...[
                    const SizedBox(height: 8),
                    Text('Destinatario: ${d.recipientName}'),
                  ],
                  ..._encomendaSection(d),
                  if (d.pickupAddress != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Coleta',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    Text(d.pickupAddress!),
                  ],
                  if (d.deliveryAddress != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Entrega',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    Text(d.deliveryAddress!),
                  ],
                ],
              ),
            ),
          ),
          // PICK-01 / DEC-24: o cliente é quem mostra o código na coleta, então
          // ele precisa estar visível assim que o entregador aceita.
          if (d.pickupCode != null) ...[
            const SizedBox(height: 16),
            Card(
              color: AquiLogColors.primarySoft,
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Código de recolhimento',
                      style: TextStyle(
                        color: AquiLogColors.muted,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      d.pickupCode!,
                      style: const TextStyle(
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 8,
                        color: AquiLogColors.primaryDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Mostre estes 4 dígitos ao entregador na hora da coleta.',
                      style: TextStyle(color: AquiLogColors.muted),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (hasCoords) ...[
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(
                      d.pickupLatitude!,
                      d.pickupLongitude!,
                    ),
                    initialZoom: 12,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'br.com.aquilog.cliente',
                    ),
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: LatLng(d.pickupLatitude!, d.pickupLongitude!),
                          width: 40,
                          height: 40,
                          child: const Icon(
                            Icons.storefront,
                            color: AquiLogColors.primary,
                          ),
                        ),
                        Marker(
                          point: LatLng(
                            d.deliveryLatitude!,
                            d.deliveryLongitude!,
                          ),
                          width: 40,
                          height: 40,
                          child: const Icon(
                            Icons.flag,
                            color: Color(0xFFE29149),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Text(
            'Historico',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 8),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else if (history.isEmpty)
            const Text(
              'Sem eventos ainda.',
              style: TextStyle(color: AquiLogColors.muted),
            )
          else
            ...history.map((raw) {
              final e = raw is Map<String, dynamic>
                  ? raw
                  : Map<String, dynamic>.from(raw as Map);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${e['status'] ?? ''}'),
                subtitle: Text('${e['note'] ?? e['createdAt'] ?? ''}'),
              );
            }),
          if (d.status == 'DELIVERED') ...[
            const Divider(height: 32),
            const Text(
              'Avaliar entrega',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            Slider(
              value: score.toDouble(),
              min: 1,
              max: 5,
              divisions: 4,
              label: '$score',
              onChanged: (v) => setState(() => score = v.round()),
            ),
            TextField(
              controller: comment,
              decoration: const InputDecoration(labelText: 'Comentario'),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                await widget.onRate(
                  score,
                  comment.text.trim().isEmpty ? null : comment.text.trim(),
                );
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Avaliacao enviada')),
                  );
                }
              },
              child: const Text('Enviar avaliacao'),
            ),
          ],
        ],
      ),
    );
  }

  /// DISP-02 / plano §6.1.4 e §6.1.5 — o status da busca de motoboy:
  /// aviso do primeiro atraso significativo e, quando a busca esgota, as
  /// ações explícitas "tentar novamente", "editar" e "cancelar", além da
  /// proposta de aumento (DEC-03 §3.3) que exige o consentimento do cliente.
  List<Widget> _dispatchStatusSection(DeliverySummary d) {
    final exhausted = d.dispatchExhausted;
    final proposal = d.priceBoostProposal;
    if (!exhausted && !d.dispatchSlowWarned && proposal == null) {
      return [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                const SizedBox(
                  width: 36,
                  height: 36,
                  child: CircularProgressIndicator(strokeWidth: 3),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Text(
                    'Procurando um motoboy para o seu pedido...',
                  ),
                ),
              ],
            ),
          ),
        ),
      ];
    }
    return [
      if (d.dispatchSlowWarned && !exhausted)
        Card(
          color: AquiLogColors.warningSoft,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.schedule, color: AquiLogColors.warning),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'A busca está demorando mais que o normal',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Ainda estamos procurando um motoboy. Você pode acompanhar '
                  'por aqui ou editar o pedido para tentar facilitar.',
                  style: TextStyle(color: AquiLogColors.muted),
                ),
                if (widget.onUpdate != null) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton(
                      onPressed: _openEdit,
                      child: const Text('Editar pedido'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      if (exhausted) ...[
        Card(
          color: AquiLogColors.errorSoft,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.error_outline, color: AquiLogColors.error),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Não encontramos um motoboy desta vez',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'A busca foi encerrada. Você pode tentar novamente, editar '
                  'os dados do pedido ou cancelar.',
                  style: TextStyle(color: AquiLogColors.muted),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    if (widget.onRetry != null)
                      FilledButton.icon(
                        onPressed: _onRetry,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Tentar novamente'),
                      ),
                    if (widget.onUpdate != null)
                      OutlinedButton.icon(
                        onPressed: _openEdit,
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Editar'),
                      ),
                    if (widget.onCancel != null)
                      TextButton.icon(
                        onPressed: _onCancel,
                        icon: const Icon(Icons.close),
                        label: const Text('Cancelar'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (proposal != null && widget.onConsentBoost != null) ...[
          const SizedBox(height: 16),
          Card(
            color: AquiLogColors.primarySoft,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Destravar a busca com um aumento',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'De ${_brl(proposal.previousPriceCents)} para '
                    '${_brl(proposal.newPriceCents)} '
                    '(+${proposal.boostPercent}%).',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'O novo valor só é aplicado se você aceitar aqui, e a '
                    'busca é reaberta com ele.',
                    style: TextStyle(color: AquiLogColors.muted),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _onConsent,
                      icon: const Icon(Icons.trending_up),
                      label: Text('Aceitar ${_brl(proposal.newPriceCents)}'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    ];
  }

  static String _brl(int cents) =>
      'R\$ ${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')}';

  /// Seção "Encomenda" (B2C): tipo, tamanho, peso, alcance e foto do produto.
  List<Widget> _encomendaSection(DeliverySummary d) {
    final meta = d.orderMeta ?? OrderMeta.fromNotes(d.notes);
    if (meta == null) return const [];
    return [
      const SizedBox(height: 14),
      const Text(
        'Encomenda',
        style: TextStyle(color: AquiLogColors.muted, fontSize: 12),
      ),
      const SizedBox(height: 4),
      Text(
        '${meta.productType} · ${meta.size}'
        '${_weightLabel(meta)}',
        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
      const SizedBox(height: 4),
      Text(
        'Alcance: ${meta.scope}',
        style: const TextStyle(color: AquiLogColors.muted, fontSize: 13),
      ),
      if (meta.photoUrl != null && meta.photoUrl!.isNotEmpty) ...[
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            meta.photoUrl!,
            height: 160,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              height: 160,
              color: AquiLogColors.line,
              child: const Icon(
                Icons.broken_image_outlined,
                color: AquiLogColors.muted,
              ),
            ),
          ),
        ),
      ],
      if (meta.notes != null && meta.notes!.isNotEmpty) ...[
        const SizedBox(height: 6),
        Text(
          meta.notes!,
          style: const TextStyle(color: AquiLogColors.muted, fontSize: 13),
        ),
      ],
    ];
  }

  static String _weightLabel(OrderMeta meta) {
    final weight = meta.weightKg;
    if (weight == null) return '';
    return ' · ${weight.toStringAsFixed(1).replaceAll('.', ',')} kg';
  }
}

/// DISP-02 / plano §6.1.5 — formulário de "editar" do pedido com busca
/// esgotada. Só os campos que não mudam o valor combinado: endereços,
/// destinatário, telefone, observação e janelas do agendado (`DEC-19`).
class _EditDeliveryDialog extends StatefulWidget {
  const _EditDeliveryDialog({required this.delivery, required this.onSubmit});

  final DeliverySummary delivery;
  final Future<DeliverySummary> Function(Map<String, dynamic> form) onSubmit;

  @override
  State<_EditDeliveryDialog> createState() => _EditDeliveryDialogState();
}

class _EditDeliveryDialogState extends State<_EditDeliveryDialog> {
  late final _pickup = TextEditingController(
    text: widget.delivery.pickupAddress ?? '',
  );
  late final _delivery = TextEditingController(
    text: widget.delivery.deliveryAddress ?? '',
  );
  late final _recipient = TextEditingController(
    text: widget.delivery.recipientName ?? '',
  );
  late final _phone = TextEditingController(
    text: widget.delivery.recipientPhone ?? '',
  );
  late final _notes = TextEditingController(
    text: widget.delivery.notes ?? '',
  );
  bool saving = false;

  @override
  void dispose() {
    _pickup.dispose();
    _delivery.dispose();
    _recipient.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (saving) return;
    final form = <String, dynamic>{};
    if (_pickup.text.trim() != (widget.delivery.pickupAddress ?? '')) {
      form['pickupAddress'] = _pickup.text.trim();
    }
    if (_delivery.text.trim() != (widget.delivery.deliveryAddress ?? '')) {
      form['deliveryAddress'] = _delivery.text.trim();
    }
    if (_recipient.text.trim() != (widget.delivery.recipientName ?? '')) {
      form['recipientName'] = _recipient.text.trim();
    }
    if (_phone.text.trim() != (widget.delivery.recipientPhone ?? '')) {
      form['recipientPhone'] = _phone.text.trim();
    }
    if (_notes.text.trim() != (widget.delivery.notes ?? '')) {
      form['notes'] = _notes.text.trim();
    }
    if (form.isEmpty) {
      Navigator.of(context).pop(widget.delivery);
      return;
    }
    setState(() => saving = true);
    try {
      final updated = await widget.onSubmit(form);
      if (mounted) Navigator.of(context).pop(updated);
    } catch (e) {
      if (mounted) {
        setState(() => saving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Editar pedido'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _pickup,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Coleta'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _delivery,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Entrega'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _recipient,
              decoration: const InputDecoration(labelText: 'Destinatário'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Telefone'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _notes,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Observação'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Voltar'),
        ),
        FilledButton(
          onPressed: saving ? null : _save,
          child: saving
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Salvar'),
        ),
      ],
    );
  }
}

/// DISP-02 / plano §6.1.5 — confirmação explícita de cancelamento.
class _CancelDeliveryDialog extends StatefulWidget {
  @override
  State<_CancelDeliveryDialog> createState() => _CancelDeliveryDialogState();
}

class _CancelDeliveryDialogState extends State<_CancelDeliveryDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancelar pedido?'),
      content: TextField(
        controller: _reason,
        maxLines: 2,
        decoration: const InputDecoration(
          labelText: 'Motivo (opcional)',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(null),
          child: const Text('Voltar'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_reason.text.trim()),
          child: const Text('Cancelar pedido'),
        ),
      ],
    );
  }
}
