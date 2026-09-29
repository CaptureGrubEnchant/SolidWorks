import { homedir } from 'node:os';
import { join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  solidworks: {
    path: process.env.SOLIDWORKS_PATH || 'C:/Program Files/SOLIDWORKS Corp/SOLIDWORKS',
    version: process.env.SOLIDWORKS_VERSION || '2024',
    modelsPath: process.env.SOLIDWORKS_MODELS_PATH || join(homedir(), 'Documents', 'SolidWorks'),
    macrosPath: process.env.SOLIDWORKS_MACROS_PATH || join(homedir(), 'Documents', 'SolidWorks', 'Macros'),
  },
  chromadb: {
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000', 10),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export function getSolidWorksExecutable(): string {
  return join(config.solidworks.path, 'SLDWORKS.exe');
}

export function getTemplatesPath(): string {
  return join(config.solidworks.path, 'data', 'templates');
}
