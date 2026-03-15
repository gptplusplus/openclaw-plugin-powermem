declare module 'openclaw/plugin-sdk' {
  export interface OpenClawPluginApi {
    paths: {
      data: string;
      cache: string;
      config: string;
    };
    fs: {
      ensureDir(path: string): Promise<void>;
    };
  }

  export interface OpenClawPlugin {
    name: string;
    version: string;
    description?: string;
    registerContextEngine?: (api: OpenClawPluginApi) => {
      create: (config: any) => Promise<ContextEngine>;
    };
  }

  export interface ContextEngine {
    bootstrap?(): Promise<BootstrapResult>;
    ingest(params: { message: any }): Promise<IngestResult>;
    ingestBatch?(params: { messages: any[] }): Promise<IngestBatchResult>;
    assemble(params: { system: string }): Promise<AssembleResult>;
    compact?(): Promise<CompactResult>;
  }

  export interface BootstrapResult {
    [key: string]: any;
  }

  export interface IngestResult {
    status: 'success' | 'failure';
    error?: any;
  }

  export interface IngestBatchResult {
    status: 'success' | 'failure';
    error?: any;
  }

  export interface AssembleResult {
    system: string;
    messages: any[];
    contextSize?: number;
  }

  export interface CompactResult {
    [key: string]: any;
  }
}
