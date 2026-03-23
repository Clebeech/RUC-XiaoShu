from __future__ import annotations

import json
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import ChatSession, Document, DocumentChunk, KnowledgeBase, Message, User
from .embedding_service import EmbeddingService
from .llm_service import LLMService
from .vectorizer import VectorMath


class RAGService:
    top_k = 8
    max_chunks_per_document = 6

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
        return await cls.query_with_search_text(
            db=db,
            user=user,
            question=question,
            search_text=question,
            question_context=None,
            knowledge_base_name=knowledge_base_name,
            model_name=model_name,
            chat_id=chat_id,
        )

    @classmethod
    async def query_with_search_text(
        cls,
        db: Session,
        user: User,
        question: str,
        search_text: str,
        question_context: str | None,
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

        normalized_search_text = cls._normalize_search_text(search_text)
        ranked_results = await cls._search(normalized_search_text, chunks)
        selected_results = cls._select_results(ranked_results, limit=cls.top_k)
        context = cls._build_context(selected_results)
        prompt = cls._build_prompt(question, context, question_context=question_context)
        answer = await LLMService.answer(prompt, cls._system_prompt(knowledge_base_name), model_name=model_name)

        chat = cls._resolve_chat(db, user, knowledge_base_name, question, chat_id)
        db.add(Message(chat_session=chat, role="user", content=question))
        citations = cls._build_citations(selected_results)
        answer_with_citations = cls._append_citations(answer, citations)
        db.add(Message(chat_session=chat, role="assistant", content=answer_with_citations))
        db.flush()
        return answer_with_citations, chat, citations

    @staticmethod
    async def _search(question: str, chunks: list[DocumentChunk]) -> list[dict[str, object]]:
        query_embedding = await EmbeddingService.embed_text(question, text_type="query")
        keywords = RAGService._extract_query_keywords(question)
        results: list[dict[str, object]] = []
        for chunk in chunks:
            chunk_embedding = json.loads(chunk.embedding_json)
            similarity = VectorMath.cosine_similarity(query_embedding, chunk_embedding)
            bonus = RAGService._keyword_bonus(question, keywords, chunk)
            results.append(
                {
                    "chunk": chunk,
                    "similarity": similarity,
                    "score": similarity + bonus,
                    "bonus": bonus,
                }
            )
        results.sort(key=lambda item: (item["score"], item["similarity"]), reverse=True)
        return results

    @staticmethod
    def _build_context(results: list[dict[str, object]], max_length: int = 18000) -> str:
        if not results:
            return "当前知识库没有可用文档。"

        blocks: list[str] = []
        total_length = 0
        for index, result in enumerate(results, start=1):
            chunk = result["chunk"]
            similarity = float(result["similarity"]) * 100
            block = (
                f"[文档{index}: {chunk.document.name} | {chunk.section} (相似度: {similarity:.1f}%)]\n"
                f"{chunk.content.strip()}\n"
            )
            if total_length + len(block) > max_length:
                break
            blocks.append(block)
            total_length += len(block)
        return "\n---\n\n".join(blocks)

    @staticmethod
    def _build_prompt(question: str, context: str, question_context: str | None = None) -> str:
        prompt = (
            "基于以下知识库内容回答用户问题。若文档未覆盖答案，请明确说明。"
            "如果答案需要跨多个片段综合判断，请先归纳证据再作答，不要因为单个片段不完整就直接说无法判断。\n\n"
        )
        if question_context:
            prompt += f"补充上下文：\n{question_context}\n\n"
        prompt += (
            f"相关文档内容：\n{context}\n\n"
            f"用户问题：{question}\n\n"
            "请给出准确、简洁、可执行的回答，并尽量引用文档信息。"
        )
        return prompt

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

    @staticmethod
    def _build_citations(results: list[dict[str, object]]) -> list[dict[str, str | float | None]]:
        citations: list[dict[str, str | float | None]] = []
        seen_document_ids: set[int] = set()
        for result in results:
            chunk = result["chunk"]
            document_id = int(chunk.document.id)
            if document_id in seen_document_ids:
                continue
            seen_document_ids.add(document_id)
            citations.append(
                {
                    "document_id": document_id,
                    "document_name": chunk.document.name,
                    "similarity": round(result["similarity"], 4),
                    "section": chunk.section,
                }
            )
        return citations

    @classmethod
    def _select_results(cls, results: list[dict[str, object]], limit: int) -> list[dict[str, object]]:
        selected: list[dict[str, object]] = []
        per_document: dict[int, int] = {}
        for result in results:
            chunk = result["chunk"]
            document_id = chunk.document.id
            if per_document.get(document_id, 0) >= cls.max_chunks_per_document:
                continue
            selected.append(result)
            per_document[document_id] = per_document.get(document_id, 0) + 1
            if len(selected) >= limit:
                break
        return selected

    @staticmethod
    def _extract_query_keywords(question: str) -> list[str]:
        normalized = re.sub(r"[（）()，。！？、?？:：/]", " ", RAGService._normalize_search_text(question))
        parts = [
            part.strip()
            for part in re.split(r"\s+|的|是|吗|么|请问|是否|是不是|有无|有没有", normalized)
            if part.strip()
        ]
        stopwords = {
            "什么",
            "哪些",
            "哪个",
            "课程",
            "同学",
            "学生",
            "专业",
            "要求",
            "必修",
            "选修",
            "需要",
            "是否",
        }
        keywords: list[str] = []
        for part in parts:
            clean = part.strip()
            if len(clean) < 2:
                continue
            if clean not in stopwords:
                keywords.append(clean)
            for suffix in ("课程", "专业", "同学", "学生", "要求"):
                if clean.endswith(suffix):
                    stem = clean[: -len(suffix)]
                    if len(stem) >= 2 and stem not in stopwords:
                        keywords.append(stem)
        year_matches = re.findall(r"20\d{2}级", question)
        keywords.extend(year_matches)
        seen: set[str] = set()
        deduped: list[str] = []
        for keyword in keywords:
            if keyword not in seen:
                seen.add(keyword)
                deduped.append(keyword)
        return deduped

    @staticmethod
    def _normalize_search_text(value: str) -> str:
        def replace_short_year(match: re.Match[str]) -> str:
            year = int(match.group(1))
            if 0 <= year <= 99:
                return f"20{year:02d}级"
            return match.group(0)

        normalized = re.sub(r"(?<!20)(\d{2})级", replace_short_year, value)
        normalized = normalized.replace("程序设计Ⅰ", "程序设计I")
        normalized = normalized.replace("程序设计丨", "程序设计I")
        normalized = normalized.replace("程序设计1", "程序设计I")
        return normalized

    @staticmethod
    def _extract_primary_subject(question: str) -> str | None:
        prefix = question.split("的", 1)[0].strip()
        if not prefix:
            return None
        prefix = re.sub(r"20\d{2}级", "", prefix)
        prefix = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", prefix)
        prefix = prefix.strip()
        if len(prefix) < 2:
            return None
        return prefix

    @staticmethod
    def _normalize_match_text(value: str) -> str:
        return re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", value)

    @staticmethod
    def _keyword_bonus(question: str, keywords: list[str], chunk: DocumentChunk) -> float:
        bonus = 0.0
        document_name = chunk.document.name
        content = chunk.content
        normalized_name = RAGService._normalize_match_text(document_name)
        primary_subject = RAGService._extract_primary_subject(question)

        for year in re.findall(r"20\d{2}级", question):
            if year in document_name:
                bonus += 0.08

        if primary_subject:
            normalized_subject = RAGService._normalize_match_text(primary_subject)
            if normalized_subject and normalized_subject in normalized_name:
                bonus += 0.18
            else:
                bonus -= 0.06

        for keyword in keywords:
            if keyword in document_name:
                bonus += 0.06
            if keyword in content:
                bonus += 0.03

        if "必修" in question and "完成专业核心课所有课程" in content:
            bonus += 0.08
        if "必修" in question and "必修" in content:
            bonus += 0.03
        if "程序设计" in question and "程序设计" in content:
            bonus += 0.08

        return min(bonus, 0.35)
