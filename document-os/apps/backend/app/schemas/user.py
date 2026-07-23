from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    avatar_url: str | None
    is_active: bool
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = None


class UserSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    theme: str
    autosave_interval_ms: int
    default_model: str | None
    preferences: dict
    created_at: datetime
    updated_at: datetime


class UserSettingsUpdate(BaseModel):
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
    autosave_interval_ms: int | None = Field(default=None, ge=300, le=30000)
    default_model: str | None = None
    preferences: dict | None = None
