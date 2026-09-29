/**
 * Macro Types for SolidWorks MCP
 */

export interface MacroAction {
  id: string;
  type: string;
  name: string;
  timestamp: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
}

export interface MacroRecording {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime?: string;
  actions: MacroAction[];
  metadata: {
    createdBy: string;
    version: string;
    solidworksVersion?: string;
    tags: string[];
  };
}

export interface MacroTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: MacroParameter[];
  code: string;
  language: 'VBA' | 'VSTA' | 'C#' | 'VB.NET';
  examples?: MacroExample[];
}

export interface MacroParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export interface MacroExample {
  name: string;
  description: string;
  parameters: Record<string, any>;
  expectedResult?: any;
}

export interface MacroExecution {
  id: string;
  macroId: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  logs: MacroLog[];
}

export interface MacroLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  data?: any;
}

export interface MacroStorageOptions {
  type: 'file' | 'database' | 'memory';
  path?: string;
  connectionString?: string;
}
