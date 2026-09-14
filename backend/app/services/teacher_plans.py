"""Regras de capacidade dos planos docentes, incluindo migração legada."""


def normalize_teacher_capacity(stored_slots: int) -> int:
    """Converte valores antigos sem reduzir a capacidade já concedida."""
    if stored_slots <= 0:
        return 3
    if stored_slots <= 30:
        return 30
    if stored_slots <= 60:
        return 60
    if stored_slots <= 100:
        return 100
    # Capacidades acima de 100 representam contratos Escola configurados manualmente.
    return stored_slots


def public_teacher_slots(stored_slots: int) -> int:
    """Mantém zero como marcador do Free; planos pagos usam capacidade normalizada."""
    return 0 if stored_slots <= 0 else normalize_teacher_capacity(stored_slots)
