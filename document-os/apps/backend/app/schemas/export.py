from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExportRequest(BaseModel):
    format: str = Field(pattern="^(markdown|html|pdf|docx|json)$")
    include_summary: bool = False


class ExportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    format: str
    status: str
    file_path: str
    created_at: datetime
