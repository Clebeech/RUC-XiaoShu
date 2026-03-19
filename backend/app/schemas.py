from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    app: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class UserInfo(BaseModel):
    id: int
    username: str
    role: str


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None


class KnowledgeBaseRead(BaseModel):
    id: int
    name: str
    description: str | None
    document_count: int
    created_at: datetime
    updated_at: datetime


class ChunkRead(BaseModel):
    id: int
    content: str
    section: str | None = None
    start_index: int
    end_index: int


class DocumentRead(BaseModel):
    id: int
    name: str
    size: int
    mime_type: str
    uploaded_at: datetime
    chunk_count: int


class DocumentUploadResponse(BaseModel):
    document: DocumentRead
    extracted_characters: int


class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    knowledge_base: str = "general"
    chat_id: int | None = None
    model: str | None = None


class CitationRead(BaseModel):
    document_name: str
    similarity: float
    section: str | None = None


class QueryResponse(BaseModel):
    answer: str
    chat_id: int
    citations: list[CitationRead]


class MessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime


class ChatRead(BaseModel):
    id: int
    title: str
    knowledge_base_name: str
    created_at: datetime
    messages: list[MessageRead]
