export interface FinnMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface FinnConversation {
  id: string;
  messages: FinnMessage[];
  conversationId: string | null; // ID retornado pelo Dify
}

export interface FinnToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface FinnToolFn {
  (name: string, params: Record<string, unknown>): Promise<FinnToolResult>;
}
