import 'package:aqui_log_empresa/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('exibe a tela inicial da empresa', (tester) async {
    await tester.pumpWidget(const CompanyApp());
    expect(find.text('Nova entrega'), findsOneWidget);
    expect(find.text('Resumo de hoje'), findsOneWidget);
  });
}
