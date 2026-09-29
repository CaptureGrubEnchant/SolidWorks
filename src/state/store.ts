/**
 * State Store for SolidWorks MCP Server
 * Manages resource states and provides persistence
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ResourceState, ResourceStatus } from '../resources/base.js';
import { logger } from '../utils/logger.js';

export interface StateSnapshot {
  version: string;
  timestamp: string;
  resources: Map<string, ResourceState>;
  metadata: {
    totalResources: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export class ResourceStateStore {
  private resources: Map<string, ResourceState> = new Map();
  private stateFilePath: string;
  private autoSave: boolean;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor(stateFilePath?: string, autoSave: boolean = true) {
    this.stateFilePath = stateFilePath || path.join(process.cwd(), '.solidworks-mcp-state.json');
    this.autoSave = autoSave;

    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Add or update a resource state
   */
  async setState(resourceId: string, state: ResourceState): Promise<void> {
    this.resources.set(resourceId, state);
    logger.debug(`State updated for resource: ${resourceId}`, { type: state.type, status: state.status });

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Get a resource state by ID
   */
  getState(resourceId: string): ResourceState | undefined {
    return this.resources.get(resourceId);
  }

  /**
   * Get all resource states
   */
  getAllStates(): ResourceState[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get states by type
   */
  getStatesByType(type: string): ResourceState[] {
    return this.getAllStates().filter((state) => state.type === type);
  }

  /**
   * Get states by status
   */
  getStatesByStatus(status: ResourceStatus): ResourceState[] {
    return this.getAllStates().filter((state) => state.status === status);
  }

  /**
   * Remove a resource state
   */
  async removeState(resourceId: string): Promise<boolean> {
    const deleted = this.resources.delete(resourceId);

    if (deleted) {
      logger.debug(`State removed for resource: ${resourceId}`);
      if (this.autoSave) {
        await this.save();
      }
    }

    return deleted;
  }

  /**
   * Clear all states
   */
  async clear(): Promise<void> {
    this.resources.clear();
    logger.info('All resource states cleared');

    if (this.autoSave) {
      await this.save();
    }
  }

  /**
   * Save state to file
   */
  async save(): Promise<void> {
    try {
      const snapshot = this.createSnapshot();
      const json = JSON.stringify(snapshot, null, 2);

      await fs.writeFile(this.stateFilePath, json, 'utf-8');
      logger.debug(`State saved to ${this.stateFilePath}`);
    } catch (error) {
      logger.error('Failed to save state', error);
      throw error;
    }
  }

  /**
   * Load state from file
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFilePath, 'utf-8');
      const snapshot = JSON.parse(data);

      this.resources.clear();

      // Convert array back to Map
      if (Array.isArray(snapshot.resources)) {
        for (const state of snapshot.resources) {
          this.resources.set(state.id, state);
        }
      } else if (snapshot.resources) {
        // Handle Map serialized as object
        for (const [id, state] of Object.entries(snapshot.resources)) {
          this.resources.set(id, state as ResourceState);
        }
      }

      logger.info(`State loaded from ${this.stateFilePath}`, {
        totalResources: this.resources.size,
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logger.debug('No state file found, starting with empty state');
      } else {
        logger.error('Failed to load state', error);
        throw error;
      }
    }
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(): StateSnapshot {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const state of this.resources.values()) {
      byType[state.type] = (byType[state.type] || 0) + 1;
      byStatus[state.status] = (byStatus[state.status] || 0) + 1;
    }

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      resources: this.resources,
      metadata: {
        totalResources: this.resources.size,
        byType,
        byStatus,
      },
    };
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    // Save every 30 seconds
    this.saveInterval = setInterval(async () => {
      if (this.resources.size > 0) {
        await this.save();
      }
    }, 30000);
  }

  /**
   * Stop auto-save interval
   */
  stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  /**
   * Get statistics about stored states
   */
  getStatistics(): Record<string, any> {
    const snapshot = this.createSnapshot();
    return {
      totalResources: snapshot.metadata.totalResources,
      byType: snapshot.metadata.byType,
      byStatus: snapshot.metadata.byStatus,
      oldestResource: this.getOldestResource(),
      newestResource: this.getNewestResource(),
    };
  }

  /**
   * Get the oldest resource
   */
  private getOldestResource(): ResourceState | undefined {
    let oldest: ResourceState | undefined;

    for (const state of this.resources.values()) {
      if (!oldest || state.metadata.createdAt < oldest.metadata.createdAt) {
        oldest = state;
      }
    }

    return oldest;
  }

  /**
   * Get the newest resource
   */
  private getNewestResource(): ResourceState | undefined {
    let newest: ResourceState | undefined;

    for (const state of this.resources.values()) {
      if (!newest || state.metadata.createdAt > newest.metadata.createdAt) {
        newest = state;
      }
    }

    return newest;
  }

  /**
   * Query states with filters
   */
  queryStates(filters: {
    type?: string;
    status?: ResourceStatus;
    tags?: Record<string, string>;
    createdAfter?: string;
    createdBefore?: string;
  }): ResourceState[] {
    let results = this.getAllStates();

    if (filters.type) {
      results = results.filter((s) => s.type === filters.type);
    }

    if (filters.status) {
      results = results.filter((s) => s.status === filters.status);
    }

    if (filters.tags) {
      results = results.filter((s) => {
        for (const [key, value] of Object.entries(filters.tags!)) {
          if (s.metadata.tags[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    if (filters.createdAfter) {
      results = results.filter((s) => s.metadata.createdAt >= filters.createdAfter!);
    }

    if (filters.createdBefore) {
      results = results.filter((s) => s.metadata.createdAt <= filters.createdBefore!);
    }

    return results;
  }

  /**
   * Export states to JSON
   */
  async exportToJSON(filePath: string): Promise<void> {
    const snapshot = this.createSnapshot();
    const json = JSON.stringify(snapshot, null, 2);
    await fs.writeFile(filePath, json, 'utf-8');
    logger.info(`States exported to ${filePath}`);
  }

  /**
   * Import states from JSON
   */
  async importFromJSON(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8');
    const snapshot = JSON.parse(data);

    // Merge with existing states
    if (Array.isArray(snapshot.resources)) {
      for (const state of snapshot.resources) {
        this.resources.set(state.id, state);
      }
    }

    logger.info(`States imported from ${filePath}`, {
      imported: snapshot.resources.length || 0,
    });

    if (this.autoSave) {
      await this.save();
    }
  }
}
