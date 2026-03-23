from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy.orm import Session


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Document, KnowledgeBase  # noqa: E402
from app.services.document_service import DocumentService  # noqa: E402


SUPPORTED_SUFFIXES = {".md", ".txt", ".doc", ".docx"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch import local documents into a knowledge base.")
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=PROJECT_ROOT / "data_normalized",
        help="Root directory to scan recursively.",
    )
    parser.add_argument(
        "--knowledge-base",
        default="education",
        help="Target knowledge base name. Defaults to education.",
    )
    parser.add_argument(
        "--extensions",
        default="md,txt,doc,docx",
        help="Comma-separated list of file extensions to import.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only import the first N matching files.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip documents whose relative path already exists in the target knowledge base.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only list what would be imported without writing to the database.",
    )
    return parser.parse_args()


def normalize_suffixes(raw_extensions: str) -> set[str]:
    suffixes: set[str] = set()
    for item in raw_extensions.split(","):
        clean = item.strip().lower()
        if not clean:
            continue
        suffixes.add(clean if clean.startswith(".") else f".{clean}")
    return suffixes or SUPPORTED_SUFFIXES


def collect_files(input_dir: Path, suffixes: set[str], limit: int | None) -> list[Path]:
    files = [
        path
        for path in sorted(input_dir.rglob("*"))
        if path.is_file() and path.suffix.lower() in suffixes
    ]
    if limit is not None:
        return files[:limit]
    return files


def ensure_knowledge_base(db: Session, knowledge_base_name: str) -> KnowledgeBase:
    knowledge_base = db.query(KnowledgeBase).filter(KnowledgeBase.name == knowledge_base_name).first()
    if knowledge_base is not None:
        return knowledge_base

    knowledge_base = KnowledgeBase(name=knowledge_base_name, description=f"{knowledge_base_name} knowledge base")
    db.add(knowledge_base)
    db.commit()
    db.refresh(knowledge_base)
    return knowledge_base


async def import_one(
    db: Session,
    knowledge_base: KnowledgeBase,
    file_path: Path,
    input_dir: Path,
    skip_existing: bool,
) -> tuple[str, str, int | None]:
    relative_name = file_path.relative_to(input_dir).as_posix()
    existing = (
        db.query(Document)
        .filter(
            Document.knowledge_base_id == knowledge_base.id,
            Document.name == relative_name,
        )
        .first()
    )
    if existing is not None:
        if skip_existing:
            return "skipped", relative_name, None
        db.delete(existing)
        db.commit()

    document, extracted_characters = await DocumentService.ingest_local_file(
        file_path=file_path,
        knowledge_base=knowledge_base,
        document_name=relative_name,
    )
    db.add(document)
    db.commit()
    return "imported", relative_name, extracted_characters


async def main() -> int:
    args = parse_args()
    input_dir = args.input_dir.expanduser().resolve()
    suffixes = normalize_suffixes(args.extensions)

    if not input_dir.exists():
        print(f"Input directory does not exist: {input_dir}", file=sys.stderr)
        return 1

    files = collect_files(input_dir, suffixes, args.limit)
    print(f"Input root : {input_dir}")
    print(f"Knowledge  : {args.knowledge_base}")
    print(f"Extensions : {', '.join(sorted(suffixes))}")
    print(f"File count : {len(files)}")

    if not files:
        return 0

    if args.dry_run:
        for path in files:
            print(f"[DRY RUN] {path.relative_to(input_dir).as_posix()}")
        return 0

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    imported = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    try:
        knowledge_base = ensure_knowledge_base(db, args.knowledge_base)
        for index, file_path in enumerate(files, start=1):
            relative_name = file_path.relative_to(input_dir).as_posix()
            print(f"[{index}/{len(files)}] Importing: {relative_name}")
            try:
                status, _, extracted = await import_one(
                    db=db,
                    knowledge_base=knowledge_base,
                    file_path=file_path,
                    input_dir=input_dir,
                    skip_existing=args.skip_existing,
                )
                if status == "skipped":
                    skipped += 1
                    print("  -> skipped")
                else:
                    imported += 1
                    print(f"  -> imported ({extracted} chars)")
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                failed.append((relative_name, str(exc)))
                print(f"  -> failed: {exc}")
    finally:
        db.close()

    print("\nSummary")
    print(f"  Imported: {imported}")
    print(f"  Skipped : {skipped}")
    print(f"  Failed  : {len(failed)}")
    if failed:
        print("  Failure details:")
        for relative_name, reason in failed:
            print(f"    - {relative_name}: {reason}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
