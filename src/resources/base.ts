/**
 * Base Resource Class for SolidWorks MCP Implementation
 * Provides foundation for all SolidWorks resources with state management
 */

import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  warnings?: Array<{
    path: string;
    message: string;
  }>;
}

export interface ResourceState {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  outputs: Record<string, any>;
  metadata: ResourceMetadata;
  status: ResourceStatus;
}

export interface ResourceMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: Record<string, string>;
  annotations: Record<string, string>;
  solidworksVersion?: string;
  fileReference?: string;
}

export enum ResourceStatus {
  PENDING = 'pending',
  CREATING = 'creating',
  CREATED = 'created',
  UPDATING = 'updating',
  DELETING = 'deleting',
  DELETED = 'deleted',
  FAILED = 'failed',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  UNKNOWN = 'unknown',
}

export interface ResourceDependency {
  resourceId: string;
  type: 'hard' | 'soft';
  outputRef?: string;
}

export abstract class SolidWorksResource {
  public readonly id: string;
  public readonly name: string;
  protected _properties: Record<string, any>;
  protected _outputs: Record<string, any> = {};
  protected _dependencies: ResourceDependency[] = [];
  protected _status: ResourceStatus = ResourceStatus.PENDING;
  protected _metadata: ResourceMetadata;

  abstract readonly type: string;
  abstract readonly schema: z.ZodSchema<any>;

  constructor(id: string, name: string, properties: Record<string, any>) {
    this.id = id;
    this.name = name;
    this._properties = properties;
    this._metadata = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'solidworks-mcp',
      version: 1,
      tags: {},
      annotations: {},
    };
  }

  /**
   * Validate the resource properties against schema
   */
  validate(): ValidationResult {
    try {
      this.schema.parse(this._properties);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return {
        valid: false,
        errors: [{ path: '', message: 'Unknown validation error' }],
      };
    }
  }

  /**
   * Convert resource to state representation
   */
  toState(): ResourceState {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      properties: this._properties,
      outputs: this._outputs,
      metadata: this._metadata,
      status: this._status,
    };
  }

  /**
   * Restore resource from state
   */
  fromState(state: ResourceState): void {
    this._properties = state.properties;
    this._outputs = state.outputs;
    this._metadata = state.metadata;
    this._status = state.status;
  }

  /**
   * Get resource dependencies
   */
  getDependencies(): ResourceDependency[] {
    return this._dependencies;
  }

  /**
   * Add a dependency to this resource
   */
  addDependency(dependency: ResourceDependency): void {
    this._dependencies.push(dependency);
  }

  /**
   * Get resource outputs
   */
  getOutputs(): Record<string, any> {
    return this._outputs;
  }

  /**
   * Set resource outputs
   */
  setOutputs(outputs: Record<string, any>): void {
    this._outputs = outputs;
    this._metadata.updatedAt = new Date().toISOString();
  }

  /**
   * Get resource status
   */
  getStatus(): ResourceStatus {
    return this._status;
  }

  /**
   * Update resource status
   */
  setStatus(status: ResourceStatus): void {
    this._status = status;
    this._metadata.updatedAt = new Date().toISOString();
  }

  /**
   * Get resource properties
   */
  getProperties(): Record<string, any> {
    return this._properties;
  }

  /**
   * Update resource properties
   */
  updateProperties(properties: Partial<Record<string, any>>): ValidationResult {
    const newProperties = { ...this._properties, ...properties };

    // Validate before updating
    try {
      this.schema.parse(newProperties);
      this._properties = newProperties;
      this._metadata.updatedAt = new Date().toISOString();
      this._metadata.version++;
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        };
      }
      return {
        valid: false,
        errors: [{ path: '', message: 'Unknown validation error' }],
      };
    }
  }

  /**
   * Abstract methods that must be implemented by concrete resources
   */
  abstract execute(api: any): Promise<any>;
  abstract toVBACode(): string;
  abstract toMacroCode(): string;
  abstract getRequiredCapabilities(): string[];
}
