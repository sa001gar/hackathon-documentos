from pydantic import BaseModel


class ProjectHit(BaseModel):
    id: str
    name: str


class DocumentHit(BaseModel):
    id: str
    title: str
    project_id: str
    snippet: str


class SectionHit(BaseModel):
    id: str
    document_id: str
    title: str
    snippet: str


class SearchResults(BaseModel):
    query: str
    projects: list[ProjectHit]
    documents: list[DocumentHit]
    sections: list[SectionHit]
