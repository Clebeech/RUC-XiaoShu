export interface Document {
  id: string;
  name: string;
  content: string;
  chunks: DocumentChunk[];
  uploadedAt: Date;
  size: number;
  type: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: {
    page?: number;
    section?: string;
    startIndex: number;
    endIndex: number;
  };
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  documents: Document[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  chunk: DocumentChunk;
  document: Document;
  similarity: number;
}