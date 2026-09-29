/**
 * Cache Manager for SolidWorks MCP Server
 * Provides caching capabilities for resource operations
 */

import { logger } from '../utils/logger.js';

export interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000) {
    // 1 hour default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // Start cleanup interval
    const cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
    // Store interval for cleanup (if needed in the future)
    (this as any)._cleanupInterval = cleanupInterval;
  }

  /**
   * Get value from cache
   */
  get(key: string): any | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update hit count
    entry.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: any, ttl?: number): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0,
    });

    logger.debug(`Cache set: ${key}`);
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      averageHits: entries.length > 0 ? totalHits / entries.length : 0,
      oldestEntry: entries.reduce((oldest, e) => (!oldest || e.timestamp < oldest.timestamp ? e : oldest), null as any),
      mostUsed: entries.reduce((most, e) => (!most || e.hits > most.hits ? e : most), null as any),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lru: CacheEntry | null = null;

    for (const entry of this.cache.values()) {
      if (!lru || entry.timestamp < lru.timestamp) {
        lru = entry;
      }
    }

    if (lru) {
      this.cache.delete(lru.key);
      logger.debug(`Cache evicted LRU: ${lru.key}`);
    }
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}
