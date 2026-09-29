import { z } from 'zod';
import type { SolidWorksAPI } from '../solidworks/api.js';

export const macroSecurityTools = [
  {
    name: 'macro_set_security',
    description: 'Attempt to set macro security level',
    inputSchema: z.object({
      level: z.enum(['low', 'medium', 'high']).describe('Security level to set'),
    }),
    handler: (args: any, swApi: SolidWorksAPI) => {
      try {
        const swApp = (swApi as any).swApp;
        if (!swApp) {
          throw new Error('Not connected to SolidWorks');
        }

        const levels: Record<string, number> = { low: 0, medium: 1, high: 2 };
        const targetLevel = levels[args.level as string];

        // Try to set the macro security level
        // 77 = swUserPreferenceIntegerValue_e.swMacroSecurityLevel
        try {
          swApp.SetUserPreferenceIntegerValue(77, targetLevel);

          // Verify the change
          const newLevel = swApp.GetUserPreferenceIntegerValue(77);
          const levelNames = ['Low', 'Medium', 'High'];

          return `Macro security set to: ${levelNames[newLevel]}. You may need to restart SolidWorks for changes to take effect.`;
        } catch (e) {
          return `Could not change security level: ${e}. You may need to change it manually in SolidWorks.`;
        }
      } catch (error) {
        return `Failed to set security: ${error}`;
      }
    },
  },

  {
    name: 'macro_get_security_info',
    description: 'Get detailed macro security information',
    inputSchema: z.object({}),
    handler: (_args: any, swApi: SolidWorksAPI) => {
      try {
        const swApp = (swApi as any).swApp;
        if (!swApp) {
          throw new Error('Not connected to SolidWorks');
        }

        const info: string[] = [];

        // Get current security level
        try {
          const level = swApp.GetUserPreferenceIntegerValue(77);
          const levels = ['Low (All macros run)', 'Medium (Prompt for macros)', 'High (Macros disabled)'];
          info.push(`Current Security Level: ${levels[level] || 'Unknown'}`);
        } catch (e) {
          info.push(`Could not read security level: ${e}`);
        }

        // Check if VBA is enabled
        try {
          // 197 = swUserPreferenceToggle_e.swMacroEnable
          const vbaEnabled = swApp.GetUserPreferenceToggle(197);
          info.push(`VBA Macros Enabled: ${vbaEnabled ? 'Yes' : 'No'}`);
        } catch (e) {
          info.push(`Could not check VBA status: ${e}`);
        }

        // Try to enable VBA if disabled
        try {
          swApp.SetUserPreferenceToggle(197, true);
          info.push('Attempted to enable VBA macros');
        } catch (e) {
          info.push(`Could not enable VBA: ${e}`);
        }

        info.push('\nTo manually change security in SolidWorks 2023:');
        info.push('1. Tools → Add-Ins → Check "SolidWorks API SDK"');
        info.push('2. Tools → Macro → Security (if available)');
        info.push('3. Or Tools → Options → System Options');
        info.push('4. Look for "Enable VBA macros" checkbox');
        info.push('5. Set "Macro security" to Low or Medium');

        return info.join('\n');
      } catch (error) {
        return `Failed to get security info: ${error}`;
      }
    },
  },
];
