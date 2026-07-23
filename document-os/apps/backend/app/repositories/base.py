"""Generic repository — all entity repositories extend this."""
from typing import Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: type[ModelT]):
        self.model = model

    def get(self, db: Session, id: str) -> ModelT | None:
        return db.get(self.model, id)

    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[ModelT]:
        return list(db.query(self.model).offset(skip).limit(limit).all())

    def create(self, db: Session, *, obj_in: BaseModel | dict) -> ModelT:
        data = obj_in.model_dump(exclude_unset=True) if isinstance(obj_in, BaseModel) else dict(obj_in)
        obj = self.model(**data)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def update(self, db: Session, *, db_obj: ModelT, obj_in: BaseModel | dict) -> ModelT:
        data = obj_in.model_dump(exclude_unset=True) if isinstance(obj_in, BaseModel) else dict(obj_in)
        for field, value in data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: str) -> None:
        obj = db.get(self.model, id)
        if obj is not None:
            db.delete(obj)
            db.commit()
