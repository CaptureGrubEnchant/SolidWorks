/**
 * Macro Recorder for SolidWorks MCP
 * Records and manages macro operations
 */

import { v4 as uuidv4 } from 'uuid';
import type { MacroAction, MacroExecution, MacroLog, MacroRecording } from './types.js';

export class MacroRecorder {
  private currentRecording: MacroRecording | null = null;
  private recordings: Map<string, MacroRecording> = new Map();
  private executions: Map<string, MacroExecution> = new Map();
  private actionHandlers: Map<string, (action: MacroAction) => Promise<any>> = new Map();

  /**
   * Start a new macro recording
   */
  startRecording(name: string, description: string = ''): string {
    if (this.currentRecording) {
      throw new Error('A recording is already in progress');
    }

    const id = uuidv4();
    this.currentRecording = {
      id,
      name,
      description,
      startTime: new Date().toISOString(),
      actions: [],
      metadata: {
        createdBy: 'solidworks-mcp',
        version: '1.0.0',
        tags: [],
      },
    };

    return id;
  }

  /**
   * Stop the current recording
   */
  stopRecording(): MacroRecording | null {
    if (!this.currentRecording) {
      return null;
    }

    this.currentRecording.endTime = new Date().toISOString();
    const recording = this.currentRecording;
    this.recordings.set(recording.id, recording);
    this.currentRecording = null;

    return recording;
  }

  /**
   * Record an action
   */
  recordAction(type: string, name: string, parameters: Record<string, any>): void {
    if (!this.currentRecording) {
      throw new Error('No recording in progress');
    }

    const action: MacroAction = {
      id: uuidv4(),
      type,
      name,
      timestamp: new Date().toISOString(),
      parameters,
    };

    this.currentRecording.actions.push(action);
  }

  /**
   * Get a recording by ID
   */
  getRecording(id: string): MacroRecording | undefined {
    return this.recordings.get(id);
  }

  /**
   * Get all recordings
   */
  getAllRecordings(): MacroRecording[] {
    return Array.from(this.recordings.values());
  }

  /**
   * Delete a recording
   */
  deleteRecording(id: string): boolean {
    return this.recordings.delete(id);
  }

  /**
   * Register an action handler
   */
  registerActionHandler(type: string, handler: (action: MacroAction) => Promise<any>): void {
    this.actionHandlers.set(type, handler);
  }

  /**
   * Execute a macro recording
   */
  async executeMacro(macroId: string, parameters?: Record<string, any>): Promise<MacroExecution> {
    const recording = this.recordings.get(macroId);
    if (!recording) {
      throw new Error(`Macro '${macroId}' not found`);
    }

    const executionId = uuidv4();
    const execution: MacroExecution = {
      id: executionId,
      macroId,
      startTime: new Date().toISOString(),
      status: 'running',
      logs: [],
    };

    this.executions.set(executionId, execution);

    try {
      const results = [];
      for (const action of recording.actions) {
        const handler = this.actionHandlers.get(action.type);
        if (!handler) {
          throw new Error(`No handler registered for action type '${action.type}'`);
        }

        this.addLog(execution, 'info', `Executing action: ${action.name}`);

        try {
          const result = await handler({
            ...action,
            parameters: { ...action.parameters, ...parameters },
          });
          results.push(result);
          this.addLog(execution, 'debug', `Action completed: ${action.name}`, result);
        } catch (error) {
          this.addLog(execution, 'error', `Action failed: ${action.name}`, error);
          throw error;
        }
      }

      execution.status = 'completed';
      execution.endTime = new Date().toISOString();
      execution.result = results;
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date().toISOString();
      execution.error = error instanceof Error ? error.message : String(error);
      this.addLog(execution, 'error', 'Macro execution failed', error);
    }

    return execution;
  }

  /**
   * Get execution by ID
   */
  getExecution(id: string): MacroExecution | undefined {
    return this.executions.get(id);
  }

  /**
   * Get all executions for a macro
   */
  getMacroExecutions(macroId: string): MacroExecution[] {
    return Array.from(this.executions.values()).filter((e) => e.macroId === macroId);
  }

  /**
   * Add a log entry to an execution
   */
  private addLog(execution: MacroExecution, level: MacroLog['level'], message: string, data?: any): void {
    execution.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  /**
   * Export recording to VBA code
   */
  exportToVBA(macroId: string): string {
    const recording = this.recordings.get(macroId);
    if (!recording) {
      throw new Error(`Macro '${macroId}' not found`);
    }

    const vbaLines: string[] = [
      `' Macro: ${recording.name}`,
      `' Description: ${recording.description}`,
      `' Generated: ${new Date().toISOString()}`,
      `' By: SolidWorks MCP Server`,
      '',
      `Sub ${this.sanitizeName(recording.name)}()`,
      '    Dim swApp As SldWorks.SldWorks',
      '    Dim swModel As SldWorks.ModelDoc2',
      '    ',
      '    Set swApp = Application.SldWorks',
      '    Set swModel = swApp.ActiveDoc',
      '    ',
      '    If swModel Is Nothing Then',
      '        MsgBox "No active document found"',
      '        Exit Sub',
      '    End If',
      '    ',
    ];

    // Convert actions to VBA code
    for (const action of recording.actions) {
      const vbaCode = this.actionToVBA(action);
      if (vbaCode) {
        vbaLines.push(`    ' ${action.name}`);
        vbaLines.push(...vbaCode.split('\n').map((line) => `    ${line}`));
        vbaLines.push('');
      }
    }

    vbaLines.push('End Sub');

    return vbaLines.join('\n');
  }

  /**
   * Convert action to VBA code
   */
  private actionToVBA(action: MacroAction): string {
    // This would be expanded with specific action type conversions
    const vbaGenerators: Record<string, (params: any) => string> = {
      'create-sketch': (params) => `swModel.CreateSketch "${params.plane}"`,
      'add-line': (params) =>
        `swModel.CreateLine2 ${params.x1}, ${params.y1}, ${params.z1}, ${params.x2}, ${params.y2}, ${params.z2}`,
      'add-circle': (params) =>
        `swModel.CreateCircle2 ${params.centerX}, ${params.centerY}, ${params.centerZ}, ${params.radius}`,
      extrude: (params) =>
        `swModel.FeatureManager.FeatureExtrusion3 True, False, False, 0, 0, ${params.depth}, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False`,
      // Add more action types as needed
    };

    const generator = vbaGenerators[action.type];
    return generator ? generator(action.parameters) : `' Unsupported action: ${action.type}`;
  }

  /**
   * Sanitize name for VBA
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Clear all recordings and executions
   */
  clear(): void {
    this.currentRecording = null;
    this.recordings.clear();
    this.executions.clear();
  }
}
