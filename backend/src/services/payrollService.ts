import { calculateMonthly, checkLicense, savePayout, CalculationResult, RetroDetail } from './payroll/calculator.js';
import { calculateRetroactive } from './payroll/retroactive.js';
import { calculateDeductions } from './payroll/deductions.js';

// Facade to keep existing import style in controllers
export const payrollService = {
  calculateMonthly,
  calculateRetroactive,
  calculateDeductions,
  checkLicense,
  savePayout,
};

// Re-export types for consumers that imported from the old location
export type { CalculationResult, RetroDetail } from './payroll/calculator.js';
