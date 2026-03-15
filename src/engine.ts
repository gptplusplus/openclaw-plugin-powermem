import type {
  ContextEngine,
  AssembleResult,
  IngestResult,
  BootstrapResult,
  CompactResult,
  IngestBatchResult
} from 'openclaw/plugin-sdk';
import { PowerMemClient } from './client.js';
import { LocalStore, StoredMessage } from './store.js';

export interface PowerMemConfig {
  powerMemUrl?: string;
  userId?: string; // Fallback or global user ID
  instanceId?: string; // OpenClaw instance ID
  agentId?: string;    // Specific agent ID
  freshTailCount?: number; // Number of recent messages to keep in context
}

export class PowerMemContextEngine implements ContextEngine {
  private client: PowerMemClient;
  private store: LocalStore;
  private config: PowerMemConfig;
  private agentId: string;

  constructor(config: PowerMemConfig, dataDir: string) {
    this.config = config;
    const powerMemUrl = config.powerMemUrl || 'http://localhost:8000';
    
    // Construct a unique user ID for PowerMem based on instance and agent
    // Format: {instanceId}_{agentId} or just {agentId} or fallback to config.userId
    this.agentId = config.agentId || 'default_agent';
    const instancePrefix = config.instanceId ? `${config.instanceId}_` : '';
    const uniqueUserId = `${instancePrefix}${this.agentId}`;
    
    // Use the constructed ID as the "user_id" in PowerMem to isolate memories
    this.client = new PowerMemClient({
      baseUrl: powerMemUrl,
      userId: uniqueUserId
    });
    
    // Pass agentId to LocalStore to isolate local DB files
    this.store = new LocalStore(dataDir, this.agentId);
  }

  async bootstrap(): Promise<BootstrapResult> {
    // No specific bootstrap needed for this demo
    return {};
  }

  async ingest(params: { message: any }): Promise<IngestResult> {
    const { message } = params;
    const role = message.role;
    let content = message.content;

    // Normalize content to string for storage
    if (typeof content !== 'string') {
      content = JSON.stringify(content);
    }

    // 1. Store locally for short-term context
    this.store.addMessage(role, content);

    // 2. Send to PowerMem for long-term indexing (only user/assistant)
    if (role === 'user' || role === 'assistant') {
      // Fire and forget to avoid blocking, or await if consistency is critical
      // Here we await to ensure it's sent, but catch errors in client
      await this.client.addMemory([{ role, content }]);
    }

    return { status: 'success' };
  }

  async ingestBatch(params: { messages: any[] }): Promise<IngestBatchResult> {
    for (const message of params.messages) {
      await this.ingest({ message });
    }
    return { status: 'success' };
  }

  async assemble(params: { system: string }): Promise<AssembleResult> {
    const { system } = params;
    
    // 1. Retrieve recent messages (Fresh Tail / Short-term memory)
    // Lossless-Claw concept: Protect a "fresh tail" of recent messages
    const freshTailCount = this.config.freshTailCount || 32;
    const recentMessages = this.store.getRecentMessages(freshTailCount);
    
    // 2. Retrieve relevant long-term memories
    let memoryContext = "";
    
    // Use the last user message as query
    const lastUserMsg = recentMessages.slice().reverse().find(m => m.role === 'user');
    
    if (lastUserMsg) {
      const memories = await this.client.searchMemory(lastUserMsg.content);
      if (memories.length > 0) {
        // Lossless-Claw concept: Format as XML-like blocks for better LLM parsing
        memoryContext = `\n\n<relevant_memories>\n<context>\nThe following are highly relevant summarized memories from past conversations. Use them to maintain context and continuity.\n</context>\n`;
        memories.forEach((m, idx) => {
           memoryContext += `<memory id="mem_${idx}">\n${m}\n</memory>\n`;
        });
        memoryContext += `</relevant_memories>\n`;
      }
    }

    // 3. Construct the final system prompt
    // We append the memories to the system prompt
    const finalSystem = system + memoryContext;

    // Convert stored messages back to the format expected by OpenClaw
    // Note: In a real implementation, we should preserve the original structured content (message_parts)
    const messages = recentMessages.map(m => {
      try {
        // Try to parse back to structured content if it was stored as JSON
        const parsedContent = JSON.parse(m.content);
        return { role: m.role, content: parsedContent };
      } catch {
        return { role: m.role, content: m.content };
      }
    });

    return {
      system: finalSystem,
      messages: messages,
      // Calculate approximate context size (4 chars ~= 1 token)
      contextSize: Math.ceil(JSON.stringify(messages).length / 4) + Math.ceil(finalSystem.length / 4)
    };
  }

  async compact(): Promise<CompactResult> {
    // PowerMem handles compaction/forgetting internally via Ebbinghaus curve
    // We can just clean up local DB if it gets too large, but for now we keep it simple
    return {};
  }
}
