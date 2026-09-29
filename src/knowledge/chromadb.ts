import { ChromaClient } from 'chromadb';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export class SolidWorksKnowledgeBase {
  private client: ChromaClient;
  private collection: any;

  constructor() {
    this.client = new ChromaClient({
      path: `http://${config.chromadb.host}:${config.chromadb.port}`,
    });
  }

  async initialize(): Promise<void> {
    try {
      // Create or get collection for SolidWorks operations
      this.collection = await this.client.getOrCreateCollection({
        name: 'solidworks_operations',
        metadata: { description: 'SolidWorks operation history and patterns' },
      });
    } catch {
      logger.warn('ChromaDB not available, running without knowledge base');
    }
  }

  async recordOperation(operation: {
    tool: string;
    input: any;
    output: any;
    success: boolean;
    timestamp: Date;
  }): Promise<void> {
    if (!this.collection) return;

    try {
      await this.collection.add({
        ids: [`op_${Date.now()}`],
        documents: [JSON.stringify(operation)],
        metadatas: [
          {
            tool: operation.tool,
            success: operation.success.toString(),
            timestamp: operation.timestamp.toISOString(),
          },
        ],
      });
    } catch (error) {
      logger.error('Failed to record operation', error);
    }
  }

  async findSimilarOperations(query: string, limit: number = 5): Promise<any[]> {
    if (!this.collection) return [];

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
      });

      return results.documents[0].map((doc: string, i: number) => ({
        document: JSON.parse(doc),
        metadata: results.metadatas[0][i],
        distance: results.distances[0][i],
      }));
    } catch (error) {
      logger.error('Failed to query operations', error);
      return [];
    }
  }

  async getSuccessRate(tool: string): Promise<number> {
    if (!this.collection) return 0;

    try {
      const results = await this.collection.query({
        queryTexts: [''],
        where: { tool },
        nResults: 1000,
      });

      const total = results.metadatas[0].length;
      const successful = results.metadatas[0].filter((m: any) => m.success === 'true').length;

      return total > 0 ? (successful / total) * 100 : 0;
    } catch (error) {
      logger.error('Failed to calculate success rate', error);
      return 0;
    }
  }
}
