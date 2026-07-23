"""Export repository (base CRUD only)."""
from app.models import Export
from app.repositories.base import BaseRepository


class ExportRepository(BaseRepository[Export]):
    pass
