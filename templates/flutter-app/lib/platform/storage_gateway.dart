// Platform layer: OS, file system, DB, and API wrappers
import '../core/app_model.dart';

class StorageGateway {
  AppEntity loadDefault() => const AppEntity(id: '{{PROJECT_ID}}', active: true);
}
