import type { OpenClawPlugin } from 'openclaw/plugin-sdk';
import { PowerMemContextEngine } from './src/engine.js';
import path from 'path';
import fs from 'fs-extra';

const plugin: OpenClawPlugin = {
  name: 'powermem-claw',
  version: '0.1.0',
  description: 'PowerMem Context Engine for OpenClaw',

  registerContextEngine: (api) => {
    return {
      create: async (config: any) => {
        // Use OpenClaw's data directory for local storage
        // We create a subdirectory for this plugin
        const dataDir = path.join(api.paths.data, 'powermem-context');
        await fs.ensureDir(dataDir);
        
        // Ensure config has necessary identification
        // OpenClaw might pass runtime info in config, or we rely on user config
        // Ideally, OpenClaw should inject instanceId/agentId into the config object when creating the engine
        return new PowerMemContextEngine(config, dataDir);
      }
    };
  }
};

export default plugin;
