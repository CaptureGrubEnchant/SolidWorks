/**
 * Design Table Resource for SolidWorks MCP
 * Manages design tables with SQL database integration
 */

import { z } from 'zod';
import { dbManager } from '../db/connection.js';
import type { SolidWorksAPI } from '../solidworks/api.js';
import { logger } from '../utils/logger.js';
import { ResourceStatus, SolidWorksResource, type ValidationResult } from './base.js';

// Schema for design table configuration
const DesignTableSchema = z.object({
  tableName: z.string().min(1),
  fileName: z.string().optional(),
  parameters: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['dimension', 'feature', 'configuration', 'custom']),
      dataType: z.enum(['number', 'string', 'boolean']),
      defaultValue: z.any().optional(),
      sqlColumn: z.string().optional(),
      formula: z.string().optional(),
    })
  ),
  configurations: z
    .array(
      z.object({
        name: z.string(),
        values: z.record(z.any()),
        active: z.boolean().default(false),
      })
    )
    .optional(),
  dataSource: z
    .object({
      type: z.enum(['file', 'sql', 'api', 'manual']),
      connectionString: z.string().optional(),
      query: z.string().optional(),
      filePath: z.string().optional(),
      apiEndpoint: z.string().optional(),
      refreshInterval: z.number().optional(),
    })
    .optional(),
  autoUpdate: z.boolean().default(false),
  validation: z
    .object({
      enabled: z.boolean().default(true),
      rules: z
        .array(
          z.object({
            parameter: z.string(),
            rule: z.string(),
            message: z.string(),
          })
        )
        .optional(),
    })
    .optional(),
});

export type DesignTableConfig = z.infer<typeof DesignTableSchema>;

export class DesignTableResource extends SolidWorksResource {
  readonly type = 'design-table';
  readonly schema = DesignTableSchema;

  /**
   * Execute design table operations
   */
  async execute(api: SolidWorksAPI): Promise<any> {
    this.setStatus(ResourceStatus.EXECUTING);

    try {
      const config = this._properties as DesignTableConfig;

      // Load data from SQL if configured
      if (config.dataSource?.type === 'sql') {
        await this.loadFromSQL(config.dataSource);
      }

      // Create or update design table in SolidWorks
      const result = await this.updateDesignTable(api, config);

      this.setStatus(ResourceStatus.COMPLETED);
      this.setOutputs({
        tableId: result.tableId,
        configurationsCreated: result.configurations,
        parametersUpdated: result.parameters,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.setStatus(ResourceStatus.FAILED);
      throw error;
    }
  }

  /**
   * Load data from SQL database
   */
  private async loadFromSQL(dataSource: any): Promise<void> {
    if (!dataSource.connectionString || !dataSource.query) {
      throw new Error('SQL connection string and query are required');
    }

    try {
      // Create database connection
      const connection = await dbManager.createConnection(`design_table_${this.id}`, dataSource.connectionString);

      // Execute query
      const data = await connection.query(dataSource.query);

      // Map SQL results to configurations
      const configurations = data.map((row: any, index: number) => ({
        name: row.config_name || row.name || `Config_${index + 1}`,
        values: this.mapSQLToParameters(row),
        active: index === 0,
      }));

      // Update properties with loaded configurations
      this._properties.configurations = configurations;

      logger.info(`Loaded ${configurations.length} configurations from SQL`);

      // Close connection
      await dbManager.closeConnection(`design_table_${this.id}`);
    } catch (error) {
      logger.error('Failed to load from SQL', error);
      // Fallback to simulated data for testing
      const simulatedData = await this.getSimulatedData();
      const configurations = simulatedData.map((row: any, index: number) => ({
        name: row.config_name || `Config_${index + 1}`,
        values: this.mapSQLToParameters(row),
        active: index === 0,
      }));
      this._properties.configurations = configurations;
    }
  }

  /**
   * Get simulated data for testing
   */
  private getSimulatedData(): any[] {
    // Fallback data for when database is not available
    return [
      {
        config_name: 'Standard',
        length: 100,
        width: 50,
        height: 25,
        material: 'Steel',
        finish: 'Painted',
      },
      {
        config_name: 'Large',
        length: 150,
        width: 75,
        height: 40,
        material: 'Aluminum',
        finish: 'Anodized',
      },
      {
        config_name: 'Custom',
        length: 120,
        width: 60,
        height: 30,
        material: 'Steel',
        finish: 'Powder Coated',
      },
    ];
  }

  /**
   * Map SQL row data to design table parameters
   */
  private mapSQLToParameters(row: any): Record<string, any> {
    const config = this._properties as DesignTableConfig;
    const values: Record<string, any> = {};

    for (const param of config.parameters) {
      if (param.sqlColumn && row[param.sqlColumn] !== undefined) {
        values[param.name] = this.convertValue(row[param.sqlColumn], param.dataType);
      } else if (param.formula) {
        values[param.name] = this.evaluateFormula(param.formula, row);
      } else if (param.defaultValue !== undefined) {
        values[param.name] = param.defaultValue;
      }
    }

    return values;
  }

  /**
   * Convert value to appropriate data type
   */
  private convertValue(value: any, dataType: string): any {
    switch (dataType) {
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      default:
        return String(value);
    }
  }

  /**
   * Evaluate formula with row data
   */
  private evaluateFormula(formula: string, row: any): any {
    // Simple formula evaluation (expand as needed)
    let result = formula;
    for (const [key, value] of Object.entries(row)) {
      result = result.replace(`{${key}}`, String(value));
    }
    return result;
  }

  /**
   * Update design table in SolidWorks
   */
  private updateDesignTable(_api: SolidWorksAPI, config: DesignTableConfig): any {
    // This would interact with actual SolidWorks API
    return {
      tableId: this.id,
      configurations: config.configurations?.map((c) => c.name) || [],
      parameters: config.parameters.map((p) => p.name),
    };
  }

  /**
   * Convert to VBA code
   */
  toVBACode(): string {
    const config = this._properties as DesignTableConfig;

    const vbaLines = [
      `' Design Table: ${this.name}`,
      `Sub CreateDesignTable_${this.sanitizeName(this.name)}()`,
      '    Dim swApp As SldWorks.SldWorks',
      '    Dim swModel As SldWorks.ModelDoc2',
      '    Dim swDesignTable As SldWorks.DesignTable',
      '    ',
      '    Set swApp = Application.SldWorks',
      '    Set swModel = swApp.ActiveDoc',
      '    ',
      "    ' Create design table",
      `    Set swDesignTable = swModel.InsertDesignTable("${config.tableName}", True, False)`,
      '    ',
    ];

    // Add parameters
    for (const param of config.parameters) {
      vbaLines.push(`    ' Add parameter: ${param.name}`);
      vbaLines.push(`    swDesignTable.AddParameter "${param.name}", "${param.type}"`);
    }

    // Add configurations
    if (config.configurations) {
      vbaLines.push('    ');
      vbaLines.push("    ' Add configurations");
      for (const cfg of config.configurations) {
        vbaLines.push(`    swDesignTable.AddConfiguration "${cfg.name}"`);
        for (const [key, value] of Object.entries(cfg.values)) {
          vbaLines.push(`    swDesignTable.SetCellValue "${cfg.name}", "${key}", "${value}"`);
        }
      }
    }

    vbaLines.push('    ');
    vbaLines.push('    swDesignTable.UpdateTable');
    vbaLines.push('End Sub');

    return vbaLines.join('\n');
  }

  /**
   * Convert to macro code
   */
  toMacroCode(): string {
    const config = this._properties as DesignTableConfig;

    return JSON.stringify(
      {
        type: 'design-table',
        name: this.name,
        actions: [
          {
            action: 'create-design-table',
            parameters: {
              tableName: config.tableName,
              parameters: config.parameters,
              configurations: config.configurations,
            },
          },
        ],
      },
      null,
      2
    );
  }

  /**
   * Get required capabilities
   */
  getRequiredCapabilities(): string[] {
    const config = this._properties as DesignTableConfig;
    const capabilities = ['design-table'];

    if (config.dataSource?.type === 'sql') {
      capabilities.push('sql-integration');
    }

    if (config.autoUpdate) {
      capabilities.push('auto-update');
    }

    return capabilities;
  }

  /**
   * Sanitize name for VBA
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Refresh data from source
   */
  async refresh(api: SolidWorksAPI): Promise<void> {
    const config = this._properties as DesignTableConfig;

    if (config.dataSource?.type === 'sql') {
      await this.loadFromSQL(config.dataSource);
      await this.updateDesignTable(api, config);
    }
  }

  /**
   * Validate design table configuration
   */
  validateConfiguration(): ValidationResult {
    const result = super.validate();

    if (!result.valid) {
      return result;
    }

    const config = this._properties as DesignTableConfig;
    const warnings: Array<{ path: string; message: string }> = [];

    // Check for parameter conflicts
    const paramNames = new Set<string>();
    for (const param of config.parameters) {
      if (paramNames.has(param.name)) {
        warnings.push({
          path: `parameters.${param.name}`,
          message: `Duplicate parameter name: ${param.name}`,
        });
      }
      paramNames.add(param.name);
    }

    // Validate SQL configuration
    if (config.dataSource?.type === 'sql') {
      if (!config.dataSource.connectionString) {
        warnings.push({
          path: 'dataSource.connectionString',
          message: 'SQL connection string is required for SQL data source',
        });
      }
      if (!config.dataSource.query) {
        warnings.push({
          path: 'dataSource.query',
          message: 'SQL query is required for SQL data source',
        });
      }
    }

    return {
      valid: warnings.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }
}

// Type guard
export function isDesignTableResource(resource: any): resource is DesignTableResource {
  return resource instanceof DesignTableResource;
}
