/**
 * Core Abstractions and Interfaces
 * These form the foundation of our clean architecture
 */

// ============================================
// 1. RESULT PATTERN FOR ERROR HANDLING
// ============================================

export type Success<T> = {
  success: true;
  data: T;
};

export type Failure<E = Error> = {
  success: false;
  error: E;
};

export type Result<T, E = Error> = Success<T> | Failure<E>;

export class ResultUtil {
  static ok<T>(data: T): Success<T> {
    return { success: true, data };
  }

  static fail<E = Error>(error: E): Failure<E> {
    return { success: false, error };
  }

  static isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
    return result.success === true;
  }

  static isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
    return result.success === false;
  }

  static map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (ResultUtil.isSuccess(result)) {
      return ResultUtil.ok(fn(result.data));
    }
    return result;
  }

  static flatMap<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> {
    if (ResultUtil.isSuccess(result)) {
      return fn(result.data);
    }
    return result;
  }

  static async fromPromise<T>(promise: Promise<T>, errorHandler?: (error: unknown) => Error): Promise<Result<T>> {
    try {
      const data = await promise;
      return ResultUtil.ok(data);
    } catch (error) {
      const processedError = errorHandler
        ? errorHandler(error)
        : error instanceof Error
          ? error
          : new Error(String(error));
      return ResultUtil.fail(processedError);
    }
  }
}

// ============================================
// 2. DOMAIN ERRORS
// ============================================

export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

export class ConnectionError extends DomainError {
  readonly code = 'CONNECTION_ERROR';
  readonly statusCode = 503;
}

export class ModelNotFoundError extends DomainError {
  readonly code = 'MODEL_NOT_FOUND';
  readonly statusCode = 404;
}

export class InvalidOperationError extends DomainError {
  readonly code = 'INVALID_OPERATION';
  readonly statusCode = 400;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 422;
}

export class COMError extends DomainError {
  readonly code = 'COM_ERROR';
  readonly statusCode = 500;
}

// ============================================
// 3. CORE INTERFACES
// ============================================

/**
 * Connection management interface
 */
export interface IConnection<T = unknown> {
  connect(): Promise<Result<T>>;
  disconnect(): Promise<Result<void>>;
  isConnected(): boolean;
  getConnection(): T | null;
  healthCheck(): Promise<Result<boolean>>;
}

/**
 * Repository pattern interface
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<Result<T | null>>;
  findAll(): Promise<Result<T[]>>;
  save(entity: T): Promise<Result<T>>;
  update(id: ID, entity: Partial<T>): Promise<Result<T>>;
  delete(id: ID): Promise<Result<void>>;
  exists(id: ID): Promise<Result<boolean>>;
}

/**
 * Unit of Work pattern for transactions
 */
export interface IUnitOfWork {
  begin(): Promise<Result<void>>;
  commit(): Promise<Result<void>>;
  rollback(): Promise<Result<void>>;
  inTransaction(): boolean;
}

/**
 * Command pattern interface
 */
export interface ICommand<TParams = unknown, TResult = unknown> {
  execute(params: TParams): Promise<Result<TResult>>;
  canExecute(params: TParams): Promise<Result<boolean>>;
  validate(params: TParams): Result<void>;
}

/**
 * Query pattern interface
 */
export interface IQuery<TParams = unknown, TResult = unknown> {
  execute(params: TParams): Promise<Result<TResult>>;
  validate(params: TParams): Result<void>;
}

/**
 * Event interface for Observer pattern
 */
export interface IEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: string;
  readonly payload?: unknown;
}

/**
 * Event handler interface
 */
export interface IEventHandler<T extends IEvent = IEvent> {
  handle(event: T): Promise<Result<void>>;
  canHandle(event: IEvent): boolean;
}

/**
 * Event bus interface
 */
export interface IEventBus {
  publish(event: IEvent): Promise<Result<void>>;
  subscribe(eventType: string, handler: IEventHandler): void;
  unsubscribe(eventType: string, handler: IEventHandler): void;
}

// ============================================
// 4. SOLIDWORKS SPECIFIC INTERFACES
// ============================================

/**
 * SolidWorks model types
 */
export enum ModelType {
  Part = 'Part',
  Assembly = 'Assembly',
  Drawing = 'Drawing',
}

/**
 * SolidWorks model interface
 */
export interface ISolidWorksModel {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly type: ModelType;
  readonly isActive: boolean;
  readonly isDirty: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * SolidWorks feature interface
 */
export interface ISolidWorksFeature {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly suppressed: boolean;
  readonly parameters?: Record<string, unknown>;
}

/**
 * SolidWorks dimension interface
 */
export interface ISolidWorksDimension {
  readonly name: string;
  readonly value: number;
  readonly feature: string;
  readonly tolerance?: {
    upper: number;
    lower: number;
  };
}

/**
 * SolidWorks API adapter interface
 */
export interface ISolidWorksAdapter {
  // Connection management
  connect(): Promise<Result<void>>;
  disconnect(): Promise<Result<void>>;
  isConnected(): boolean;

  // Model operations
  openModel(path: string): Promise<Result<ISolidWorksModel>>;
  closeModel(save: boolean): Promise<Result<void>>;
  createPart(): Promise<Result<ISolidWorksModel>>;
  getCurrentModel(): Result<ISolidWorksModel | null>;
  saveModel(path?: string): Promise<Result<void>>;

  // Feature operations
  createFeature(params: unknown): Promise<Result<ISolidWorksFeature>>;
  getFeatures(): Promise<Result<ISolidWorksFeature[]>>;
  suppressFeature(name: string): Promise<Result<void>>;

  // Dimension operations
  getDimension(name: string): Promise<Result<ISolidWorksDimension>>;
  setDimension(name: string, value: number): Promise<Result<void>>;
  listDimensions(): Promise<Result<ISolidWorksDimension[]>>;

  // Export operations
  exportModel(path: string, format: string): Promise<Result<void>>;
}

// ============================================
// 5. CONFIGURATION INTERFACES
// ============================================

/**
 * Configuration provider interface
 */
export interface IConfigurationProvider {
  get<T = unknown>(key: string): T | undefined;
  getRequired<T = unknown>(key: string): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  validate(): Result<void>;
  reload(): Promise<Result<void>>;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  fatal(message: string, error?: Error, context?: Record<string, unknown>): void;
}

// ============================================
// 6. FACTORY INTERFACES
// ============================================

/**
 * Abstract factory interface
 */
export interface IFactory<T, TParams = unknown> {
  create(params: TParams): Result<T>;
  canCreate(params: TParams): boolean;
}

/**
 * Service locator interface (for dependency injection)
 */
export interface IServiceLocator {
  register<T>(token: symbol | string, instance: T): void;
  resolve<T>(token: symbol | string): T;
  has(token: symbol | string): boolean;
  reset(): void;
}

// ============================================
// 7. VALIDATION INTERFACES
// ============================================

/**
 * Validator interface
 */
export interface IValidator<T = unknown> {
  validate(input: unknown): Result<T>;
  isValid(input: unknown): boolean;
}

/**
 * Validation rule interface
 */
export interface IValidationRule<T = unknown> {
  validate(value: T): Result<void>;
  message: string;
}

// ============================================
// 8. MIDDLEWARE INTERFACES
// ============================================

/**
 * Middleware interface for request processing pipeline
 */
export interface IMiddleware<TContext = unknown> {
  execute(context: TContext, next: () => Promise<Result<void>>): Promise<Result<void>>;
}

/**
 * Pipeline interface
 */
export interface IPipeline<TContext = unknown> {
  use(middleware: IMiddleware<TContext>): void;
  execute(context: TContext): Promise<Result<void>>;
}

// ============================================
// 9. CACHING INTERFACES
// ============================================

/**
 * Cache interface
 */
export interface ICache<T = unknown> {
  get(key: string): Promise<Result<T | null>>;
  set(key: string, value: T, ttl?: number): Promise<Result<void>>;
  has(key: string): Promise<Result<boolean>>;
  delete(key: string): Promise<Result<void>>;
  clear(): Promise<Result<void>>;
  size(): Promise<Result<number>>;
}

// ============================================
// 10. MONITORING INTERFACES
// ============================================

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  increment(metric: string, value?: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
  histogram(metric: string, value: number, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
}

/**
 * Health check interface
 */
export interface IHealthCheck {
  name: string;
  check(): Promise<Result<HealthStatus>>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: Record<string, unknown>;
}

// ============================================
// TYPE GUARDS
// ============================================

export const TypeGuards = {
  isModelType(value: unknown): value is ModelType {
    return Object.values(ModelType).includes(value as ModelType);
  },

  isSolidWorksModel(value: unknown): value is ISolidWorksModel {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'path' in value &&
      'name' in value &&
      'type' in value &&
      TypeGuards.isModelType((value as any).type)
    );
  },

  isError(value: unknown): value is Error {
    return value instanceof Error;
  },

  isDomainError(value: unknown): value is DomainError {
    return value instanceof DomainError;
  },
};
