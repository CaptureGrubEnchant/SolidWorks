/**
 * Resource Registry for SolidWorks MCP
 * Manages all available resource types and their schemas
 */

import { z } from 'zod';
import type { SolidWorksResource } from './base.js';

export interface ResourceDefinition {
  type: string;
  name: string;
  description: string;
  schema: z.ZodSchema<any>;
  factory: (id: string, name: string, properties: any) => SolidWorksResource;
  examples?: Record<string, any>[];
}

class ResourceRegistry {
  private resources: Map<string, ResourceDefinition> = new Map();

  /**
   * Register a new resource type
   */
  register(definition: ResourceDefinition): void {
    if (this.resources.has(definition.type)) {
      throw new Error(`Resource type '${definition.type}' is already registered`);
    }
    this.resources.set(definition.type, definition);
  }

  /**
   * Get a resource definition by type
   */
  get(type: string): ResourceDefinition | undefined {
    return this.resources.get(type);
  }

  /**
   * Get all registered resource types
   */
  getAllTypes(): string[] {
    return Array.from(this.resources.keys());
  }

  /**
   * Get all resource definitions
   */
  getAllDefinitions(): ResourceDefinition[] {
    return Array.from(this.resources.values());
  }

  /**
   * Create a resource instance
   */
  createResource(type: string, id: string, name: string, properties: any): SolidWorksResource {
    const definition = this.resources.get(type);
    if (!definition) {
      throw new Error(`Unknown resource type: ${type}`);
    }
    return definition.factory(id, name, properties);
  }

  /**
   * Validate resource properties
   */
  validateProperties(type: string, properties: any): { valid: boolean; errors?: any[] } {
    const definition = this.resources.get(type);
    if (!definition) {
      return { valid: false, errors: [{ message: `Unknown resource type: ${type}` }] };
    }

    try {
      definition.schema.parse(properties);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors,
        };
      }
      return { valid: false, errors: [{ message: 'Unknown validation error' }] };
    }
  }

  /**
   * Get schema for a resource type
   */
  getSchema(type: string): z.ZodSchema<any> | undefined {
    return this.resources.get(type)?.schema;
  }

  /**
   * Get examples for a resource type
   */
  getExamples(type: string): Record<string, any>[] | undefined {
    return this.resources.get(type)?.examples;
  }

  /**
   * Clear all registered resources (useful for testing)
   */
  clear(): void {
    this.resources.clear();
  }
}

// Export singleton instance
export const resourceRegistry = new ResourceRegistry();
