export const baseRules = {
  sick: { limit: 60, unit: 'business_days', rule_type: 'cumulative' },
  personal: { limit: 45, unit: 'business_days', rule_type: 'cumulative' },
  vacation: { limit: null, unit: 'business_days', rule_type: 'cumulative' },
  wife_help: { limit: 15, unit: 'business_days', rule_type: 'per_event' },
  maternity: { limit: 90, unit: 'calendar_days', rule_type: 'per_event' },
  ordain: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  military: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  education: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  rehab: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
} as const;

export const baseQuota = { quota_vacation: 10, quota_personal: 45, quota_sick: 60 };
