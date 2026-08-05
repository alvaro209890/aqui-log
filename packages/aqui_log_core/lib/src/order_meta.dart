/// Metadados da encomenda (modelo B2C).
///
/// O backend ainda não tem colunas próprias para tipo/tamanho/peso (Fase 1 do
/// plano B2C). Enquanto isso, o app cliente serializa esses dados num formato
/// estruturado dentro do campo `notes` da entrega — o motoboy enxerga tudo no
/// card da oferta, e a migração para campos próprios será transparente.
library;

class OrderMeta {
  const OrderMeta({
    required this.productType,
    required this.size,
    this.weightKg,
    this.scope = 'Mesma cidade',
    this.photoUrl,
    this.notes,
  });

  /// Categoria da encomenda (ex.: Eletrônico, Frágil, Documento).
  final String productType;

  /// Tamanho físico: Pequeno | Médio | Grande.
  final String size;

  /// Peso em kg (ex.: 2.5).
  final double? weightKg;

  /// Alcance: "Mesma cidade" | "Outra cidade ou município".
  final String scope;

  /// URL da foto do produto (storage local, quando enviada).
  final String? photoUrl;

  /// Observações livres do cliente.
  final String? notes;

  static const List<String> productTypes = [
    'Documento',
    'Alimento',
    'Eletrônico',
    'Frágil',
    'Roupas e calçados',
    'Medicamento',
    'Outro',
  ];

  static const List<String> sizes = ['Pequeno', 'Médio', 'Grande'];

  static const List<String> scopes = [
    'Mesma cidade',
    'Outra cidade ou município',
  ];

  /// Monta o texto estruturado que vai no campo `notes` da API.
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

  /// Lê o texto estruturado do `notes` e devolve os metadados (ou null).
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
      photoUrl: photoUrl,
      notes: obs,
    );
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
