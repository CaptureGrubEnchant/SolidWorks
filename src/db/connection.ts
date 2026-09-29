/**
 * Database Connection Manager for Design Tables
 * Supports SQL Server and PostgreSQL
 */

import mssql from 'mssql';
import pg from 'pg';
import { logger } from '../utils/logger.js';

export interface DBConnection {
  query(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}

export class PostgreSQLConnection implements DBConnection {
  private client: pg.Client;

  constructor(connectionString: string) {
    this.client = new pg.Client({ connectionString });
  }

  async connect(): Promise<void> {
    await this.client.connect();
    logger.info('Connected to PostgreSQL database');
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.client.end();
    logger.info('Disconnected from PostgreSQL database');
  }
}

export class SQLServerConnection implements DBConnection {
  private pool: mssql.ConnectionPool | null = null;
  private config: mssql.config;

  constructor(connectionString: string) {
    // Parse connection string for SQL Server
    const url = new URL(connectionString);
    this.config = {
      server: url.hostname,
      port: parseInt(url.port, 10) || 1433,
      database: url.pathname.substring(1),
      user: url.username,
      password: url.password,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    };
  }

  async connect(): Promise<void> {
    this.pool = await mssql.connect(this.config);
    logger.info('Connected to SQL Server database');
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.pool) {
      await this.connect();
    }

    const request = this.pool!.request();

    // Add parameters if provided
    if (params) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });
    }

    const result = await request.query(sql);
    return result.recordset;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      logger.info('Disconnected from SQL Server database');
    }
  }
}

export class DatabaseManager {
  private connections: Map<string, DBConnection> = new Map();

  /**
   * Create a database connection
   */
  async createConnection(name: string, connectionString: string): Promise<DBConnection> {
    // Close existing connection if any
    if (this.connections.has(name)) {
      await this.closeConnection(name);
    }

    let connection: DBConnection;

    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      connection = new PostgreSQLConnection(connectionString);
      await (connection as PostgreSQLConnection).connect();
    } else if (connectionString.startsWith('mssql://') || connectionString.startsWith('sqlserver://')) {
      connection = new SQLServerConnection(connectionString);
      await (connection as SQLServerConnection).connect();
    } else {
      throw new Error(`Unsupported database type in connection string: ${connectionString}`);
    }

    this.connections.set(name, connection);
    return connection;
  }

  /**
   * Get an existing connection
   */
  getConnection(name: string): DBConnection | undefined {
    return this.connections.get(name);
  }

  /**
   * Close a connection
   */
  async closeConnection(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection) {
      await connection.close();
      this.connections.delete(name);
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    for (const [, connection] of this.connections) {
      await connection.close();
    }
    this.connections.clear();
  }

  /**
   * Execute a query on a named connection
   */
  async query(connectionName: string, sql: string, params?: any[]): Promise<any[]> {
    const connection = this.connections.get(connectionName);
    if (!connection) {
      throw new Error(`No connection found with name: ${connectionName}`);
    }

    return await connection.query(sql, params);
  }
}

// Export singleton instance
export const dbManager = new DatabaseManager();
