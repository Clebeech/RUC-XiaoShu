from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .deps import get_current_user
from .models import ChatSession, Document, KnowledgeBase, SessionToken, User
from .schemas import (
    ChatRead,
    CitationRead,
    DocumentRead,
    DocumentUploadResponse,
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
from .services.rag_service import RAGService


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    seed_default_knowledge_bases()
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


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", app=settings.app_name)


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
