from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import ChatSession, Document, DocumentChunk, KnowledgeBase, Message, User
from .embedding_service import EmbeddingService
from .llm_service import LLMService
from .vectorizer import VectorMath


class RAGService:
    @classmethod
    async def query(
        cls,
        db: Session,
        user: User,
        question: str,
        knowledge_base_name: str,
        model_name: str | None = None,
        chat_id: int | None = None,
    ) -> tuple[str, ChatSession, list[dict[str, str | float | None]]]:
        knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.name == knowledge_base_name).first()
        if knowledge_base is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

        chunks = (
            db.query(DocumentChunk)
            .join(DocumentChunk.document)
            .filter(Document.knowledge_base_id == knowledge_base.id)
            .all()
        )

        ranked_results = (await cls._search(question, chunks))[:3]
        context = cls._build_context(ranked_results)
        prompt = cls._build_prompt(question, context)
        answer = await LLMService.answer(prompt, cls._system_prompt(knowledge_base_name), model_name=model_name)

        chat = cls._resolve_chat(db, user, knowledge_base_name, question, chat_id)
        db.add(Message(chat_session=chat, role="user", content=question))
        citations = [
            {
                "document_id": result["chunk"].document.id,
                "document_name": result["chunk"].document.name,
                "similarity": round(result["similarity"], 4),
                "section": result["chunk"].section,
            }
            for result in ranked_results
        ]
        answer_with_citations = cls._append_citations(answer, citations)
        db.add(Message(chat_session=chat, role="assistant", content=answer_with_citations))
        db.flush()
        return answer_with_citations, chat, citations

    @staticmethod
    async def _search(question: str, chunks: list[DocumentChunk]) -> list[dict[str, object]]:
        query_embedding = await EmbeddingService.embed_text(question, text_type="query")
        results: list[dict[str, object]] = []
        for chunk in chunks:
            chunk_embedding = json.loads(chunk.embedding_json)
            similarity = VectorMath.cosine_similarity(query_embedding, chunk_embedding)
            results.append({"chunk": chunk, "similarity": similarity})
        results.sort(key=lambda item: item["similarity"], reverse=True)
        return results

    @staticmethod
    def _build_context(results: list[dict[str, object]], max_length: int = 12000) -> str:
        if not results:
            return "当前知识库没有可用文档。"

        blocks: list[str] = []
        total_length = 0
        for index, result in enumerate(results, start=1):
            chunk = result["chunk"]
            similarity = float(result["similarity"]) * 100
            block = (
                f"[文档{index}: {chunk.document.name} (相似度: {similarity:.1f}%)]\n"
                f"{chunk.content.strip()}\n"
            )
            if total_length + len(block) > max_length:
                break
            blocks.append(block)
            total_length += len(block)
        return "\n---\n\n".join(blocks)

    @staticmethod
    def _build_prompt(question: str, context: str) -> str:
        return (
            "基于以下知识库内容回答用户问题。若文档未覆盖答案，请明确说明。\n\n"
            f"相关文档内容：\n{context}\n\n"
            f"用户问题：{question}\n\n"
            "请给出准确、简洁、可执行的回答，并尽量引用文档信息。"
        )

    @staticmethod
    def _system_prompt(knowledge_base_name: str) -> str:
        base = "你是一个专业的 RAG 助手，优先依据提供的文档回答。"
        if knowledge_base_name == "education":
            return base + " 当前知识库偏向教务场景。"
        if knowledge_base_name == "course":
            return base + " 当前知识库偏向课程场景。"
        return base

    @staticmethod
    def _resolve_chat(
        db: Session,
        user: User,
        knowledge_base_name: str,
        question: str,
        chat_id: int | None,
    ) -> ChatSession:
        if chat_id is not None:
            chat = db.query(ChatSession).filter(ChatSession.id == chat_id, ChatSession.user_id == user.id).first()
            if chat is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
            return chat

        title = question[:30] if question else "新对话"
        chat = ChatSession(user=user, title=title, knowledge_base_name=knowledge_base_name)
        db.add(chat)
        db.flush()
        return chat

    @staticmethod
    def _append_citations(answer: str, citations: list[dict[str, str | float | None]]) -> str:
        if not citations:
            return answer

        lines = [
            (
                f"[{index}] [[doc:{int(citation['document_id'])}|{citation['document_name']}]] "
                f"({float(citation['similarity']) * 100:.1f}%)"
            )
            for index, citation in enumerate(citations, start=1)
        ]
        return f"{answer}\n\n📚 参考文档：\n" + "\n".join(lines)
