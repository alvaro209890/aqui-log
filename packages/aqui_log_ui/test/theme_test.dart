import 'package:aqui_log_ui/aqui_log_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('tema usa a identidade laranja como cor primaria', () {
    final theme = AquiLogTheme.light();

    expect(theme.colorScheme.primary, AquiLogColors.primary);
    expect(theme.scaffoldBackgroundColor, AquiLogColors.surface);
    expect(theme.filledButtonTheme.style?.backgroundColor?.resolve({}),
        AquiLogColors.primary);
  });

  testWidgets('status preservam cores semanticas e rotulos em portugues',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AquiLogTheme.light(),
        home: const Scaffold(
          body: Column(
            children: [
              StatusPill('DELIVERED'),
              StatusPill('CANCELED'),
              StatusPill('IN_TRANSIT'),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Entregue'), findsOneWidget);
    expect(find.text('Cancelada'), findsOneWidget);
    expect(find.text('Em trânsito'), findsOneWidget);

    final delivered = tester.widget<Text>(find.text('Entregue'));
    final canceled = tester.widget<Text>(find.text('Cancelada'));
    final inTransit = tester.widget<Text>(find.text('Em trânsito'));
    expect(delivered.style?.color, AquiLogColors.successText);
    expect(canceled.style?.color, AquiLogColors.errorText);
    expect(inTransit.style?.color, AquiLogColors.infoText);
  });
}
