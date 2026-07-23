from datetime import datetime

from pydantic import BaseModel, ConfigDict


class VersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    section_id: str
    version: int
    content: str
    source: str
    agent: str | None
    change_summary: str | None
    created_at: datetime
