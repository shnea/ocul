// Feature layer: main agent workspace
import '../../core/app_model.dart';
import '../../ui-kit/app_button.dart';

String renderHomeSummary(AppEntity entity) {
  return formatStatusLabel(entity.id, entity.active);
}
