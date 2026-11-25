// Pure domain model (0 external dependencies)
class AppEntity {
  const AppEntity({required this.id, required this.active});

  final String id;
  final bool active;
}
