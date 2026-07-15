import 'package:aqui_log_entregador/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('exibe a oferta de corrida', (tester) async {
    await tester.pumpWidget(const CourierApp());
    expect(find.text('Nova oferta'), findsOneWidget);
    expect(find.text('Aceitar corrida'), findsOneWidget);
  });
}
