from datetime import datetime
from typing import Optional, Union

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
    description: Optional[str] = None


class KnowledgeBaseRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    document_count: int
    created_at: datetime
    updated_at: datetime


class ChunkRead(BaseModel):
    id: int
    content: str
    section: Optional[str] = None
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
    chat_id: Optional[int] = None
    model: Optional[str] = None


class CitationRead(BaseModel):
    document_id: int
    document_name: str
    similarity: float
    section: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    chat_id: int
    citations: list[CitationRead]


class AudioTranscriptionResponse(BaseModel):
    transcript: str


class FeedbackTicketRead(BaseModel):
    id: int
    question: str
    system_answer: str
    user_comment: Optional[str]
    feedback_type: str
    status: str
    priority: str
    category: str
    source: str
    knowledge_base_name: str
    contact_email: Optional[str]
    assigned_to: Optional[str]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    username: Optional[str] = None


class FeedbackTicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None


class DashboardMetric(BaseModel):
    label: str
    value: Union[int, float]
    delta: float
    trend: str


class DashboardSeriesPoint(BaseModel):
    label: str
    value: int


class DashboardBreakdownItem(BaseModel):
    label: str
    value: int
    color: Optional[str] = None


class FeedbackDashboardResponse(BaseModel):
    overview: list[DashboardMetric]
    ticket_status: list[DashboardBreakdownItem]
    category_breakdown: list[DashboardBreakdownItem]
    source_breakdown: list[DashboardBreakdownItem]
    weekly_volume: list[DashboardSeriesPoint]
    response_efficiency: list[DashboardMetric]


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
