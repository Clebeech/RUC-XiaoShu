from __future__ import annotations

import json
from pathlib import Path

from docx import Document as DocxDocument
from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Document, DocumentChunk, KnowledgeBase
from .embedding_service import EmbeddingService


class DocumentService:
    chunk_size = 1000
    overlap = 200

    @classmethod
    async def ingest_upload(cls, upload: UploadFile, knowledge_base: KnowledgeBase) -> tuple[Document, int]:
        content = await cls._extract_text(upload)
        if not content.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Document is empty after parsing")

        upload_dir = Path(settings.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        target_path = upload_dir / upload.filename
        payload = await upload.read()
        target_path.write_bytes(payload)

        document = Document(
            knowledge_base=knowledge_base,
            name=upload.filename,
            content=content,
            file_path=str(target_path),
            size=len(payload),
            mime_type=upload.content_type or "application/octet-stream",
        )

        chunk_payloads = await cls.build_chunk_payloads(content, upload.filename)
        for chunk in chunk_payloads:
            document.chunks.append(
                DocumentChunk(
                    content=chunk["content"],
                    embedding_json=json.dumps(chunk["embedding"]),
                    section=chunk["section"],
                    start_index=chunk["start_index"],
                    end_index=chunk["end_index"],
                )
            )

        return document, len(content)

    @classmethod
    async def reindex_knowledge_base(cls, db: Session, knowledge_base: KnowledgeBase) -> int:
        count = 0
        for document in knowledge_base.documents:
            chunk_payloads = await cls.build_chunk_payloads(document.content, document.name)
            document.chunks.clear()
            for chunk in chunk_payloads:
                document.chunks.append(
                    DocumentChunk(
                        content=chunk["content"],
                        embedding_json=json.dumps(chunk["embedding"]),
                        section=chunk["section"],
                        start_index=chunk["start_index"],
                        end_index=chunk["end_index"],
                    )
                )
            count += 1

        db.flush()
        return count

    @classmethod
    async def _extract_text(cls, upload: UploadFile) -> str:
        content_type = (upload.content_type or "").lower()
        suffix = Path(upload.filename or "").suffix.lower()
        payload = await upload.read()
        await upload.seek(0)

        if content_type.startswith("text/") or suffix in {".txt", ".md"}:
            return payload.decode("utf-8", errors="ignore")
        if suffix == ".pdf":
            return cls._read_pdf(payload)
        if suffix in {".docx", ".doc"}:
            return cls._read_docx(payload)

        return payload.decode("utf-8", errors="ignore")

    @staticmethod
    def _read_pdf(payload: bytes) -> str:
        from io import BytesIO

        reader = PdfReader(BytesIO(payload))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(page.strip() for page in pages if page.strip())

    @staticmethod
    def _read_docx(payload: bytes) -> str:
        from io import BytesIO

        document = DocxDocument(BytesIO(payload))
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())

    @classmethod
    def _split_into_chunks(cls, content: str, file_name: str) -> list[dict[str, str | int]]:
        paragraphs = [paragraph.strip() for paragraph in content.split("\n\n") if paragraph.strip()]
        chunks: list[dict[str, str | int]] = []
        current = ""
        start_index = 0

        for paragraph in paragraphs:
            candidate = f"{current}\n\n{paragraph}".strip() if current else paragraph
            if len(candidate) <= cls.chunk_size:
                current = candidate
                continue

            if current:
                chunks.append(cls._make_chunk(current, file_name, len(chunks), start_index))
                overlap_text = current[-cls.overlap :] if len(current) > cls.overlap else current
                start_index = max(0, start_index + len(current) - len(overlap_text))
                current = f"{overlap_text}\n\n{paragraph}".strip()
            else:
                chunks.append(cls._make_chunk(paragraph[: cls.chunk_size], file_name, len(chunks), start_index))
                start_index += cls.chunk_size
                current = paragraph[cls.chunk_size - cls.overlap :].strip()

        if current:
            chunks.append(cls._make_chunk(current, file_name, len(chunks), start_index))

        return chunks

    @classmethod
    async def build_chunk_payloads(cls, content: str, file_name: str) -> list[dict[str, str | int | list[float]]]:
        chunks = cls._split_into_chunks(content, file_name)
        embeddings = await EmbeddingService.embed_texts(
            [str(chunk["content"]) for chunk in chunks],
            text_type="document",
        )

        return [
            {
                **chunk,
                "embedding": embedding,
            }
            for chunk, embedding in zip(chunks, embeddings, strict=False)
        ]

    @staticmethod
    def _make_chunk(content: str, file_name: str, index: int, start_index: int) -> dict[str, str | int]:
        clean = content.strip()
        return {
            "content": clean,
            "section": f"{file_name} - 第{index + 1}部分",
            "start_index": start_index,
            "end_index": start_index + len(clean),
        }
