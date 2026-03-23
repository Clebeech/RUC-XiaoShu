import { getAuthToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

export interface KnowledgeBaseSummary {
  id: number;
  name: string;
  description?: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface BackendDocument {
  id: number;
  name: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
  chunk_count: number;
}

export interface UploadDocumentResponse {
  document: BackendDocument;
  extracted_characters: number;
}

export interface BackendMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  feedback?: 'like' | 'dislike' | null;
}

export interface BackendChat {
  id: number;
  title: string;
  knowledge_base_name: string;
  created_at: string;
  messages: BackendMessage[];
}

export interface QueryResponse {
  answer: string;
  chat_id: number;
  citations: Array<{
    document_id: number;
    document_name: string;
    similarity: number;
    section?: string | null;
  }>;
}

export interface AudioTranscriptionResponse {
  transcript: string;
}

export interface FeedbackTicket {
  id: number;
  question: string;
  system_answer: string;
  user_comment?: string | null;
  feedback_type: string;
  status: string;
  priority: string;
  category: string;
  source: string;
  knowledge_base_name: string;
  contact_email?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  username?: string | null;
}

export interface DashboardMetric {
  label: string;
  value: number;
  delta: number;
  trend: string;
}

export interface DashboardSeriesPoint {
  label: string;
  value: number;
}

export interface DashboardBreakdownItem {
  label: string;
  value: number;
  color?: string | null;
}

export interface FeedbackDashboard {
  overview: DashboardMetric[];
  ticket_status: DashboardBreakdownItem[];
  category_breakdown: DashboardBreakdownItem[];
  source_breakdown: DashboardBreakdownItem[];
  weekly_volume: DashboardSeriesPoint[];
  response_efficiency: DashboardMetric[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const maybeJson = await response.text();
    let message = maybeJson;
    try {
      const parsed = JSON.parse(maybeJson);
      message = parsed.detail || maybeJson;
    } catch {
      message = maybeJson || `Request failed with status ${response.status}`;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  login(username: string, password: string) {
    return request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  listKnowledgeBases() {
    return request<KnowledgeBaseSummary[]>('/api/knowledge-bases');
  },

  listDocuments(knowledgeBaseName: string) {
    return request<BackendDocument[]>(`/api/knowledge-bases/${knowledgeBaseName}/documents`);
  },

  uploadDocument(knowledgeBaseName: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return request<UploadDocumentResponse>(`/api/knowledge-bases/${knowledgeBaseName}/documents`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteDocument(documentId: number) {
    return request<{ status: string }>(`/api/documents/${documentId}`, {
      method: 'DELETE',
    });
  },

  listChats() {
    return request<BackendChat[]>('/api/chats');
  },

  deleteChat(chatId: number) {
    return request<{ status: string }>(`/api/chats/${chatId}`, {
      method: 'DELETE',
    });
  },

  query(question: string, knowledgeBase: string, model: string, chatId?: number) {
    return request<QueryResponse>('/api/chat/query', {
      method: 'POST',
      body: JSON.stringify({
        question,
        knowledge_base: knowledgeBase,
        model,
        chat_id: chatId,
      }),
    });
  },

  imageQuery(question: string, image: File, knowledgeBase: string, model: string, chatId?: number) {
    const formData = new FormData();
    formData.append('question', question);
    formData.append('image', image);
    formData.append('knowledge_base', knowledgeBase);
    formData.append('model', model);
    if (typeof chatId === 'number') {
      formData.append('chat_id', String(chatId));
    }

    return request<QueryResponse>('/api/chat/image-query', {
      method: 'POST',
      body: formData,
    });
  },

  transcribeAudio(audio: File, prompt?: string) {
    const formData = new FormData();
    formData.append('audio', audio);
    if (prompt) {
      formData.append('prompt', prompt);
    }

    return request<AudioTranscriptionResponse>('/api/audio/transcribe', {
      method: 'POST',
      body: formData,
    });
  },

  getFeedbackDashboard() {
    return request<FeedbackDashboard>('/api/admin/feedback/dashboard');
  },

  listFeedbackTickets() {
    return request<FeedbackTicket[]>('/api/admin/feedback/tickets');
  },

  updateFeedbackTicket(ticketId: number, payload: Partial<Pick<FeedbackTicket, 'status' | 'priority' | 'assigned_to'>>) {
    return request<FeedbackTicket>(`/api/admin/feedback/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
