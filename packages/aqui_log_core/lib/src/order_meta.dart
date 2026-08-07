/// Metadados da encomenda do fluxo B2C.
///
/// Novos pedidos usam campos próprios na API. [fromDeliveryJson] mantém a
/// leitura do bloco histórico em `notes`, permitindo atualizar os apps sem
/// invalidar entregas criadas antes da migration B2C-01.
library;

class OrderMeta {
  const OrderMeta({
    required this.productType,
    required this.size,
    this.weightKg,
    this.scope = 'Mesma cidade',
    this.photoUrls = const [],
    this.notes,
  });

  /// Rótulo pt-BR exibido na interface.
  final String productType;

  /// Rótulo pt-BR: Pequeno | Médio | Grande.
  final String size;

  final double? weightKg;

  /// Rótulo pt-BR do alcance.
  final String scope;

  /// Fotos da encomenda. A UI atual envia uma; a API aceita até três.
  final List<String> photoUrls;

  /// Observação livre — não contém mais o bloco estruturado nos novos pedidos.
  final String? notes;

  String? get photoUrl => photoUrls.isEmpty ? null : photoUrls.first;

  static const Map<String, String> productTypeLabels = {
    'DOCUMENT': 'Documento',
    'FOOD': 'Alimento',
    'ELECTRONICS': 'Eletrônico',
    'FRAGILE': 'Frágil',
    'CLOTHING': 'Roupas e calçados',
    'MEDICINE': 'Medicamento',
    'OTHER': 'Outro',
  };

  static const Map<String, String> sizeLabels = {
    'SMALL': 'Pequeno',
    'MEDIUM': 'Médio',
    'LARGE': 'Grande',
  };

  static const Map<String, String> scopeLabels = {
    'SAME_CITY': 'Mesma cidade',
    'OTHER_CITY': 'Outra cidade ou município',
  };

  static List<String> get productTypes => productTypeLabels.values.toList();
  static List<String> get sizes => sizeLabels.values.toList();
  static List<String> get scopes => scopeLabels.values.toList();

  String get productTypeCode =>
      _codeForLabel(productTypeLabels, productType, fallback: 'OTHER');

  String get packageSizeCode =>
      _codeForLabel(sizeLabels, size, fallback: 'MEDIUM');

  String get deliveryScopeCode =>
      _codeForLabel(scopeLabels, scope, fallback: 'SAME_CITY');

  /// Payload estável enviado por apps novos.
  Map<String, dynamic> toApiJson() => {
    'productType': productTypeCode,
    'packageSize': packageSizeCode,
    if (weightKg != null) 'weightKg': weightKg,
    'deliveryScope': deliveryScopeCode,
    'productPhotoUrls': photoUrls,
    if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
  };

  /// Lê campos próprios e recorre ao formato histórico de `notes` quando
  /// necessário. Campos próprios sempre vencem quando estão presentes.
  static OrderMeta? fromDeliveryJson(Map<String, dynamic> json) {
    final rawNotes = json['notes']?.toString();
    final legacy = fromNotes(rawNotes);
    final hasStructured =
        json['productType'] != null ||
        json['packageSize'] != null ||
        json['weightKg'] != null ||
        json['deliveryScope'] != null ||
        json['productPhotoUrls'] != null;
    if (!hasStructured) return legacy;

    final photoUrls = _stringList(json['productPhotoUrls']);
    return OrderMeta(
      productType: _labelForCode(
        productTypeLabels,
        json['productType'],
        fallback: legacy?.productType ?? 'Outro',
      ),
      size: _labelForCode(
        sizeLabels,
        json['packageSize'],
        fallback: legacy?.size ?? 'Médio',
      ),
      weightKg: _toDouble(json['weightKg']) ?? legacy?.weightKg,
      scope: _labelForCode(
        scopeLabels,
        json['deliveryScope'],
        fallback: legacy?.scope ?? 'Mesma cidade',
      ),
      photoUrls: photoUrls.isNotEmpty
          ? photoUrls
          : (legacy?.photoUrls ?? const []),
      notes: legacy?.notes ?? _plainNotes(rawNotes),
    );
  }

  /// Serialização histórica. Mantida apenas para testes/fallback de pedidos
  /// antigos; novos formulários devem usar [toApiJson].
  String encodeNotes() {
    final buffer = StringBuffer()
      ..write('ENCOMENDA | Tipo: $productType | Tamanho: $size');
    if (weightKg != null) {
      buffer.write(' | Peso: ${_formatWeight(weightKg!)} kg');
    }
    buffer.write(' | Alcance: $scope');
    if (photoUrl != null && photoUrl!.isNotEmpty) {
      buffer.write('\nFOTO: $photoUrl');
    }
    if (notes != null && notes!.trim().isNotEmpty) {
      buffer.write('\nOBS: ${notes!.trim()}');
    }
    return buffer.toString();
  }

  static OrderMeta? fromNotes(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final lines = raw.split('\n');
    String? type;
    String? size;
    double? weight;
    String scope = 'Mesma cidade';
    String? photoUrl;
    String? obs;

    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.startsWith('ENCOMENDA')) {
        for (final part in trimmed.split('|')) {
          final key = part.split(':').first.trim();
          final value = part.contains(':')
              ? part.substring(part.indexOf(':') + 1).trim()
              : '';
          switch (key) {
            case 'Tipo':
              type = value;
            case 'Tamanho':
              size = value;
            case 'Peso':
              weight = _parseWeight(value);
            case 'Alcance':
              if (value.isNotEmpty) scope = value;
          }
        }
      } else if (trimmed.startsWith('FOTO:')) {
        photoUrl = trimmed.substring('FOTO:'.length).trim();
      } else if (trimmed.startsWith('OBS:')) {
        obs = trimmed.substring('OBS:'.length).trim();
      }
    }
    if (type == null && size == null) return null;
    return OrderMeta(
      productType: type ?? 'Outro',
      size: size ?? 'Médio',
      weightKg: weight,
      scope: scope,
      photoUrls: photoUrl == null || photoUrl.isEmpty ? const [] : [photoUrl],
      notes: obs,
    );
  }

  static String _codeForLabel(
    Map<String, String> labels,
    String value, {
    required String fallback,
  }) {
    if (labels.containsKey(value)) return value;
    for (final entry in labels.entries) {
      if (entry.value == value) return entry.key;
    }
    return fallback;
  }

  static String _labelForCode(
    Map<String, String> labels,
    dynamic value, {
    required String fallback,
  }) {
    if (value == null) return fallback;
    final text = value.toString();
    return labels[text] ?? (labels.containsValue(text) ? text : fallback);
  }

  static List<String> _stringList(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map((item) => item?.toString().trim() ?? '')
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  static String? _plainNotes(String? raw) {
    if (raw == null || raw.trim().isEmpty || fromNotes(raw) != null) {
      return null;
    }
    return raw.trim();
  }

  static double? _toDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString().replaceAll(',', '.'));
  }

  static String _formatWeight(double kg) {
    final text = kg.toStringAsFixed(1).replaceFirst('.0', '');
    return text.replaceAll('.', ',');
  }

  static double? _parseWeight(String value) {
    final normalized = value.replaceAll(',', '.').replaceAll('kg', '').trim();
    return double.tryParse(normalized);
  }
}
