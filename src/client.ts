import axios, { AxiosInstance } from 'axios';

export interface MemoryMessage {
  role: string;
  content: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface PowerMemClientConfig {
  baseUrl: string;
  userId: string;
}

export class PowerMemClient {
  private client: AxiosInstance;
  private userId: string;

  constructor(config: PowerMemClientConfig) {
    this.client = axios.create({ 
      baseURL: config.baseUrl,
      timeout: 10000 
    });
    this.userId = config.userId;
  }

  /**
   * Add messages to PowerMem for indexing.
   */
  async addMemory(messages: MemoryMessage[]) {
    try {
      // The HTTP API Server uses /api/v1/memories for POST
      await this.client.post('/api/v1/memories', {
        messages: messages,
        user_id: this.userId,
        infer: true // Enable intelligent inference (fact extraction, deduplication)
      });
    } catch (err: any) {
      if (err.response) {
        console.error('Failed to add memory to PowerMem. Status:', err.response.status, 'Data:', err.response.data);
      } else {
        console.error('Failed to add memory to PowerMem:', err.message);
      }
      // We don't throw here to avoid disrupting the conversation flow
    }
  }

  /**
   * Search for relevant memories.
   */
  async searchMemory(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.trim() === '') {
        return [];
    }
    
    try {
      // The HTTP API Server uses /api/v1/memories/search for POST
      const res = await this.client.post('/api/v1/memories/search', {
        query: query,
        user_id: this.userId,
        limit: limit
      });
      
      // Expected response format from PowerMem API Server
      if (res.data && res.data.success && res.data.data) {
         // It might return an array directly or { results: [...] } depending on version
         const results = Array.isArray(res.data.data) ? res.data.data : res.data.data.results;
         if (Array.isArray(results)) {
             return results
                .map((r: any) => r.content || r.text || r.memory)
                .filter(Boolean); // remove empty/null items
         }
      } else if (res.data && Array.isArray(res.data.results)) {
        // Fallback for older versions
        return res.data.results
            .map((r: any) => r.content)
            .filter(Boolean);
      }
      return [];
    } catch (err: any) {
      if (err.response) {
        console.error('Failed to search PowerMem. Status:', err.response.status, 'Data:', err.response.data);
      } else {
        console.error('Failed to search PowerMem:', err.message);
      }
      return [];
    }
  }
}
