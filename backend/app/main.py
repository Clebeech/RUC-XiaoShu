import base64
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .deps import get_admin_user, get_current_user
from .models import ChatSession, Document, FeedbackTicket, KnowledgeBase, Message, SessionToken, User
from .schemas import (
    AudioTranscriptionResponse,
    ChatRead,
    CitationRead,
    DashboardBreakdownItem,
    DashboardMetric,
    DashboardSeriesPoint,
    DocumentRead,
    DocumentUploadResponse,
    FeedbackDashboardResponse,
    FeedbackTicketRead,
    FeedbackTicketUpdate,
    HealthResponse,
    KnowledgeBaseCreate,
    KnowledgeBaseRead,
    LoginRequest,
    LoginResponse,
    MessageRead,
    QueryRequest,
    QueryResponse,
    UserInfo,
)
from .security import create_token, hash_password, verify_password
from .services.document_service import DocumentService
from .services.llm_service import LLMService
from .services.rag_service import RAGService


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    seed_default_knowledge_bases()
    seed_demo_feedback_tickets()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_default_admin() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == settings.default_admin_username).first()
        if user is None:
            db.add(
                User(
                    username=settings.default_admin_username,
                    password_hash=hash_password(settings.default_admin_password),
                    role="admin",
                )
            )
            db.commit()
    finally:
        db.close()


def seed_default_knowledge_bases() -> None:
    db = SessionLocal()
    try:
        for name, description in (
            ("general", "通用知识库"),
            ("education", "教务知识库"),
            ("course", "课程知识库"),
        ):
            existing = db.query(KnowledgeBase).filter(KnowledgeBase.name == name).first()
            if existing is None:
                db.add(KnowledgeBase(name=name, description=description))
        db.commit()
    finally:
        db.close()


def seed_demo_feedback_tickets() -> None:
    db = SessionLocal()
    try:
        existing_count = db.query(FeedbackTicket).count()
        if existing_count > 0:
            return

        admin = db.query(User).filter(User.username == settings.default_admin_username).first()
        now = datetime.utcnow()
        categories = [
            "检索未命中",
            "答案不准确",
            "多模态识别偏差",
            "引用不充分",
            "流程解释不清晰",
        ]
        statuses = ["open", "reviewing", "answered", "published", "rejected"]
        priorities = ["high", "medium", "low"]
        sources = ["thumbs_down", "inline_form", "admin_import"]
        assignments = ["张老师", "李老师", "王老师", "课程组", "教务办公室"]
        samples = [
            (
                "22级数学拔尖班的个性化选修课可以认证哪些模块？",
                "系统把问题回答成了双学位项目，没打到数学拔尖班培养方案。",
            ),
            (
                "国际暑期学校课程是否可以冲抵培养方案中的通识学分？",
                "回答只说了选修，没有明确说明适用范围和限制条件。",
            ),
            (
                "缓考办理流程需要提交哪些材料？",
                "引用了通知，但没有给出具体表单名称。",
            ),
            (
                "这张课表截图里的课程能否算专业核心课？",
                "图片识别到了课程名，但知识库没有结合 OCR 结果作答。",
            ),
            (
                "本科生课程认定流程是否需要学院盖章？",
                "系统回答和流程文件有出入，希望老师确认。",
            ),
        ]

        tickets: list[FeedbackTicket] = []
        for index in range(36):
            question, answer = samples[index % len(samples)]
            created_at = now - timedelta(days=index // 2, hours=index * 3)
            status_value = statuses[index % len(statuses)]
            resolved_at = created_at + timedelta(hours=16 + index) if status_value in {"answered", "published"} else None
            tickets.append(
                FeedbackTicket(
                    user=admin,
                    question=question,
                    system_answer=answer,
                    user_comment=f"示例工单 {index + 1}：请结合培养方案与制度文件重新核验。",
                    feedback_type="answer_quality" if index % 3 else "citation_gap",
                    status=status_value,
                    priority=priorities[index % len(priorities)],
                    category=categories[index % len(categories)],
                    source=sources[index % len(sources)],
                    knowledge_base_name="education" if index % 4 else "course",
                    contact_email="jiaowu-demo@ruc.edu.cn" if index % 5 == 0 else None,
                    assigned_to=assignments[index % len(assignments)],
                    created_at=created_at,
                    updated_at=resolved_at or created_at + timedelta(hours=6),
                    resolved_at=resolved_at,
                )
            )

        db.add_all(tickets)
        db.commit()
    finally:
        db.close()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", app=settings.app_name)


def serialize_feedback_ticket(ticket: FeedbackTicket) -> FeedbackTicketRead:
    return FeedbackTicketRead(
        id=ticket.id,
        question=ticket.question,
        system_answer=ticket.system_answer,
        user_comment=ticket.user_comment,
        feedback_type=ticket.feedback_type,
        status=ticket.status,
        priority=ticket.priority,
        category=ticket.category,
        source=ticket.source,
        knowledge_base_name=ticket.knowledge_base_name,
        contact_email=ticket.contact_email,
        assigned_to=ticket.assigned_to,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
        username=ticket.user.username if ticket.user else None,
    )


@app.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.username == payload.username).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_token()
    db.add(SessionToken(token=token, user=user))
    db.commit()
    return LoginResponse(
        token=token,
        user=UserInfo(id=user.id, username=user.username, role=user.role),
    )


@app.get("/api/knowledge-bases", response_model=list[KnowledgeBaseRead])
def list_knowledge_bases(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[KnowledgeBaseRead]:
    knowledge_bases = db.query(KnowledgeBase).all()
    return [
        KnowledgeBaseRead(
            id=item.id,
            name=item.name,
            description=item.description,
            document_count=len(item.documents),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in knowledge_bases
    ]


@app.post("/api/knowledge-bases", response_model=KnowledgeBaseRead)
def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KnowledgeBaseRead:
    knowledge_base = KnowledgeBase(name=payload.name, description=payload.description)
    db.add(knowledge_base)
    db.commit()
    db.refresh(knowledge_base)
    return KnowledgeBaseRead(
        id=knowledge_base.id,
        name=knowledge_base.name,
        description=knowledge_base.description,
        document_count=0,
        created_at=knowledge_base.created_at,
        updated_at=knowledge_base.updated_at,
    )


@app.get("/api/knowledge-bases/{knowledge_base_name}/documents", response_model=list[DocumentRead])
def list_documents(
    knowledge_base_name: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.name == knowledge_base_name).first()
    if knowledge_base is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    return [
        DocumentRead(
            id=document.id,
            name=document.name,
            size=document.size,
            mime_type=document.mime_type,
            uploaded_at=document.uploaded_at,
            chunk_count=len(document.chunks),
        )
        for document in knowledge_base.documents
    ]


@app.post("/api/knowledge-bases/{knowledge_base_name}/documents", response_model=DocumentUploadResponse)
async def upload_document(
    knowledge_base_name: str,
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentUploadResponse:
    knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.name == knowledge_base_name).first()
    if knowledge_base is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    document, extracted_characters = await DocumentService.ingest_upload(file, knowledge_base)
    db.add(document)
    db.commit()
    db.refresh(document)
    return DocumentUploadResponse(
        document=DocumentRead(
            id=document.id,
            name=document.name,
            size=document.size,
            mime_type=document.mime_type,
            uploaded_at=document.uploaded_at,
            chunk_count=len(document.chunks),
        ),
        extracted_characters=extracted_characters,
    )


@app.post("/api/knowledge-bases/{knowledge_base_name}/reindex")
async def reindex_knowledge_base(
    knowledge_base_name: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int | str]:
    knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.name == knowledge_base_name).first()
    if knowledge_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    reindexed_documents = await DocumentService.reindex_knowledge_base(db, knowledge_base)
    db.commit()
    return {
        "status": "ok",
        "reindexed_documents": reindexed_documents,
    }


@app.delete("/api/documents/{document_id}")
def delete_document(
    document_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    from fastapi import HTTPException, status

    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    db.delete(document)
    db.commit()
    return {"status": "deleted"}


@app.get("/api/documents/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None or not document.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return FileResponse(path=document.file_path, filename=document.name, media_type=document.mime_type)


@app.post("/api/chat/query", response_model=QueryResponse)
async def query(
    payload: QueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueryResponse:
    answer, chat, citations = await RAGService.query(
        db=db,
        user=user,
        question=payload.question,
        knowledge_base_name=payload.knowledge_base,
        model_name=payload.model,
        chat_id=payload.chat_id,
    )
    db.commit()
    return QueryResponse(
        answer=answer,
        chat_id=chat.id,
        citations=[CitationRead(**citation) for citation in citations],
    )


@app.post("/api/chat/image-query", response_model=QueryResponse)
async def image_query(
    question: str = Form(...),
    image: UploadFile = File(...),
    knowledge_base: str = Form(default="education"),
    model: str | None = Form(default=None),
    chat_id: int | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueryResponse:
    payload = await image.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file is empty")

    mime_type = image.content_type or "image/jpeg"
    image_data_url = f"data:{mime_type};base64,{base64.b64encode(payload).decode('utf-8')}"
    image_context = await LLMService.extract_image_context(
        image_bytes=payload,
        mime_type=mime_type,
        question=question,
    )
    search_text = f"{question}\n\n图片识别结果：\n{image_context}"
    answer, chat, citations = await RAGService.query_with_search_text(
        db=db,
        user=user,
        question=question,
        search_text=search_text,
        question_context=f"图片识别结果：\n{image_context}",
        knowledge_base_name=knowledge_base,
        model_name=model,
        chat_id=chat_id,
    )
    if chat.messages:
        chat.messages[-2].content = f"[[image:{image_data_url}]]\n{question}"
    db.commit()
    return QueryResponse(
        answer=answer,
        chat_id=chat.id,
        citations=[CitationRead(**citation) for citation in citations],
    )


@app.post("/api/audio/transcribe", response_model=AudioTranscriptionResponse)
async def audio_transcribe(
    audio: UploadFile = File(...),
    prompt: str = Form(default="请将这段音频准确转写为中文文本，只输出转写结果。"),
    _: User = Depends(get_current_user),
) -> AudioTranscriptionResponse:
    payload = await audio.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio file is empty")

    suffix = Path(audio.filename or "").suffix.lower().lstrip(".")
    content_type = (audio.content_type or "").lower()
    audio_format = suffix or content_type.split("/")[-1] or "mp3"
    transcript = await LLMService.transcribe_audio(
        audio_bytes=payload,
        audio_format=audio_format,
        prompt=prompt,
    )
    return AudioTranscriptionResponse(transcript=transcript)


@app.get("/api/admin/feedback/dashboard", response_model=FeedbackDashboardResponse)
def feedback_dashboard(
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> FeedbackDashboardResponse:
    tickets = db.query(FeedbackTicket).order_by(FeedbackTicket.created_at.desc()).all()
    total = len(tickets)
    open_count = sum(1 for item in tickets if item.status == "open")
    published_count = sum(1 for item in tickets if item.status == "published")
    high_priority_count = sum(1 for item in tickets if item.priority == "high")
    with_contact_count = sum(1 for item in tickets if item.contact_email)

    status_labels = ["open", "reviewing", "answered", "published", "rejected"]
    status_colors = {
        "open": "#dc2626",
        "reviewing": "#f59e0b",
        "answered": "#3b82f6",
        "published": "#16a34a",
        "rejected": "#6b7280",
    }
    category_labels = [
        "检索未命中",
        "答案不准确",
        "多模态识别偏差",
        "引用不充分",
        "流程解释不清晰",
    ]
    source_labels = ["thumbs_down", "inline_form", "admin_import"]

    def count_by(field: str, labels: list[str]) -> list[DashboardBreakdownItem]:
        return [
            DashboardBreakdownItem(
                label=label,
                value=sum(1 for item in tickets if getattr(item, field) == label),
                color=status_colors.get(label),
            )
            for label in labels
        ]

    weekly_volume = []
    for days_ago in range(6, -1, -1):
        start = datetime.utcnow().date() - timedelta(days=days_ago)
        count = sum(1 for item in tickets if item.created_at.date() == start)
        weekly_volume.append(DashboardSeriesPoint(label=start.strftime("%m-%d"), value=count))

    resolved_tickets = [item for item in tickets if item.resolved_at]
    avg_resolution_hours = (
        round(
            sum((item.resolved_at - item.created_at).total_seconds() / 3600 for item in resolved_tickets)
            / len(resolved_tickets),
            1,
        )
        if resolved_tickets
        else 0
    )

    overview = [
        DashboardMetric(label="累计工单", value=total, delta=18.6, trend="up"),
        DashboardMetric(label="待处理工单", value=open_count, delta=-6.3, trend="down"),
        DashboardMetric(label="已发布Q&A", value=published_count, delta=12.4, trend="up"),
        DashboardMetric(label="高优先级", value=high_priority_count, delta=4.8, trend="up"),
    ]
    response_efficiency = [
        DashboardMetric(label="平均处理时长(小时)", value=avg_resolution_hours, delta=-11.2, trend="down"),
        DashboardMetric(label="可回访工单", value=with_contact_count, delta=7.5, trend="up"),
        DashboardMetric(label="本周闭环率", value=78, delta=9.4, trend="up"),
    ]

    return FeedbackDashboardResponse(
        overview=overview,
        ticket_status=count_by("status", status_labels),
        category_breakdown=count_by("category", category_labels),
        source_breakdown=count_by("source", source_labels),
        weekly_volume=weekly_volume,
        response_efficiency=response_efficiency,
    )


@app.get("/api/admin/feedback/tickets", response_model=list[FeedbackTicketRead])
def list_feedback_tickets(
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> list[FeedbackTicketRead]:
    tickets = (
        db.query(FeedbackTicket)
        .order_by(FeedbackTicket.created_at.desc())
        .all()
    )
    return [serialize_feedback_ticket(ticket) for ticket in tickets]


@app.patch("/api/admin/feedback/tickets/{ticket_id}", response_model=FeedbackTicketRead)
def update_feedback_ticket(
    ticket_id: int,
    payload: FeedbackTicketUpdate,
    _: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> FeedbackTicketRead:
    ticket = db.query(FeedbackTicket).filter(FeedbackTicket.id == ticket_id).first()
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback ticket not found")

    if payload.status is not None:
        ticket.status = payload.status
        if payload.status in {"answered", "published"}:
            ticket.resolved_at = datetime.utcnow()
    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.assigned_to is not None:
        ticket.assigned_to = payload.assigned_to

    db.commit()
    db.refresh(ticket)
    return serialize_feedback_ticket(ticket)


@app.get("/api/chats", response_model=list[ChatRead])
def list_chats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatRead]:
    chats = (
        db.query(ChatSession)
        .options(selectinload(ChatSession.messages))
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return [
        ChatRead(
            id=chat.id,
            title=chat.title,
            knowledge_base_name=chat.knowledge_base_name,
            created_at=chat.created_at,
            messages=[
                MessageRead(
                    id=message.id,
                    role=message.role,
                    content=message.content,
                    created_at=message.created_at,
                )
                for message in chat.messages
            ],
        )
        for chat in chats
    ]


@app.delete("/api/chats/{chat_id}")
def delete_chat(
    chat_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    from fastapi import HTTPException, status

    chat = db.query(ChatSession).filter(ChatSession.id == chat_id, ChatSession.user_id == user.id).first()
    if chat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")

    db.delete(chat)
    db.commit()
    return {"status": "deleted"}
