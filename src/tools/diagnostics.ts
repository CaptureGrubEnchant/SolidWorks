import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';
import { runMacro2, SW_RUN_MACRO_UNLOAD_AFTER_RUN } from '../solidworks/run-macro2.js';

export const diagnosticTools = [
  {
    name: 'diagnose_macro_execution',
    description: 'Diagnose macro execution issues with detailed logging',
    inputSchema: z.object({
      macroPath: z.string().describe('Full path to the macro file (.swp or .swb)'),
      moduleName: z.string().default('Module1').describe('Module name containing the procedure'),
      procedureName: z.string().describe('Procedure name to execute'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      const results: string[] = [];

      try {
        // Step 1: Check SolidWorks connection
        results.push('Step 1: Checking SolidWorks connection...');
        const swApp = (swApi as any).swApp;
        if (!swApp) {
          results.push('  ❌ ERROR: Not connected to SolidWorks');
          return results.join('\n');
        }
        results.push('  ✅ Connected to SolidWorks');

        // Step 2: Check if file exists (using SolidWorks API)
        results.push(`Step 2: Checking if macro file exists: ${args.macroPath}`);
        try {
          // Try to use FileSystemObject through SolidWorks
          const fso = swApp.GetFileSystemObject();
          if (fso?.FileExists(args.macroPath)) {
            results.push('  ✅ File exists (verified via FileSystemObject)');
          } else {
            results.push('  ⚠️ File not found via FileSystemObject');
          }
        } catch (e) {
          results.push(`  ⚠️ Could not verify file existence: ${e}`);
        }

        // Step 3: Check macro security settings
        results.push('Step 3: Checking macro security settings...');
        try {
          const secLevel = swApp.GetUserPreferenceIntegerValue(77);
          const secLevels = ['Low (Macros enabled)', 'Medium (Prompt for macros)', 'High (Macros disabled)'];
          results.push(`  Security Level: ${secLevels[secLevel] || 'Unknown'}`);
          if (secLevel === 2) {
            results.push('  ⚠️ WARNING: High security may block macro execution!');
          }
        } catch (e) {
          results.push(`  ⚠️ Could not check security level: ${e}`);
        }

        // Step 4: Try different RunMacro methods
        results.push('Step 4: Testing macro execution methods...');

        // Method 1: RunMacro2 with a byref OUT error param. This is the only
        // shape that works on SolidWorks 2024+ (see run-macro2.ts); the two
        // methods below are kept because they are what older guides suggest,
        // and seeing them fail is itself the diagnosis.
        try {
          results.push('  Testing RunMacro2 (byref error param — expected to work)...');
          const { success, errorCode } = runMacro2(
            swApp,
            args.macroPath,
            args.moduleName,
            args.procedureName,
            SW_RUN_MACRO_UNLOAD_AFTER_RUN
          );
          results.push(`    Result: ${success} (swRunMacroError_e ${errorCode})`);
          if (success) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }

        // Method 2: RunMacro2 with the error param passed by value. Raises a
        // type mismatch on SW 2024+ — COM wants Long*, not a Long.
        try {
          results.push('  Testing RunMacro2 (error param by value)...');
          const result = swApp.RunMacro2(
            args.macroPath,
            args.moduleName,
            args.procedureName,
            0, // swRunMacroDefault
            0 // error parameter, passed by value
          );
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }

        // Method 3: RunMacro2 with the error param omitted. Raises
        // "non-optional parameter" on SW 2024+.
        try {
          results.push('  Testing RunMacro2 (no error param)...');
          const result = swApp.RunMacro2(
            args.macroPath,
            args.moduleName,
            args.procedureName,
            2 // swRunMacroOption_Synchronously
          );
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }

        // Method 4: Legacy RunMacro
        try {
          results.push('  Testing RunMacro (legacy)...');
          const result = swApp.RunMacro(args.macroPath, args.moduleName, args.procedureName);
          results.push(`    Result: ${result}`);
          if (result) {
            results.push('    ✅ SUCCESS: Macro executed!');
            return results.join('\n');
          }
        } catch (e) {
          results.push(`    ❌ Failed: ${e}`);
        }

        // Step 5: Alternative approach - try to open VBA editor
        results.push('Step 5: Attempting to open VBA editor...');
        try {
          swApp.RunCommand(52); // swCommands_VbaEditMacro
          results.push('  ✅ VBA Editor command sent');
        } catch (e) {
          results.push(`  ❌ Could not open VBA editor: ${e}`);
        }

        results.push('\n📊 DIAGNOSIS COMPLETE');
        results.push('All macro execution methods failed.');
        results.push('Possible causes:');
        results.push('  1. Macro file format issue (.swp vs .swb)');
        results.push("  2. Module/Procedure names don't match");
        results.push('  3. Macro security blocking execution');
        results.push('  4. VBA subsystem not initialized');
        results.push('  5. Macro contains errors');

        return results.join('\n');
      } catch (error) {
        results.push(`\n❌ CRITICAL ERROR: ${error}`);
        return results.join('\n');
      }
    },
  },
];
