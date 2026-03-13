# Table Name Mapping Reference

## Migration Files

```
backend/src/scripts/db/migrations/archive/legacy-rename/
├── rename_tables.sql           # Main migration (run first)
├── rename_tables_views.sql     # Update views (run second)
├── rollback_rename_tables.sql  # Rollback if needed
└── TABLE_NAME_MAPPING.md       # This file
```

## How to Run

```bash
# 1. Backup database first!
mysqldump -h <host> -u root -p phts_system > backup_before_rename.sql

# 2. Run migration
mysql -h <host> -u root -p phts_system < rename_tables.sql
mysql -h <host> -u root -p phts_system < rename_tables_views.sql

# 3. If something goes wrong
mysql -h <host> -u root -p phts_system < rollback_rename_tables.sql
```

## Table Name Mapping

| Old Name | New Name | Prefix | Category |
|----------|----------|--------|----------|
| `pts_employees` | `emp_profiles` | emp_ | Employee |
| `pts_employee_licenses` | `emp_licenses` | emp_ | Employee |
| `pts_employee_movements` | `emp_movements` | emp_ | Employee |
| `pts_support_employees` | `emp_support_staff` | emp_ | Employee |
| `pts_leave_requests` | `leave_records` | leave_ | Leave |
| `pts_leave_quotas` | `leave_quotas` | leave_ | Leave |
| `pts_requests` | `req_submissions` | req_ | Request |
| `pts_request_actions` | `req_approvals` | req_ | Request |
| `pts_attachments` | `req_attachments` | req_ | Request |
| `pts_employee_eligibility` | `req_eligibility` | req_ | Request |
| `pts_periods` | `pay_periods` | pay_ | Payroll |
| `pts_payouts` | `pay_results` | pay_ | Payroll |
| `pts_payout_items` | `pay_result_items` | pay_ | Payroll |
| `pts_period_snapshots` | `pay_snapshots` | pay_ | Payroll |
| `pts_master_rates` | `cfg_payment_rates` | cfg_ | Config |
| `pts_holidays` | `cfg_holidays` | cfg_ | Config |
| `pts_sla_config` | `cfg_sla_rules` | cfg_ | Config |
| `pts_delegations` | `wf_delegations` | wf_ | Workflow |
| `pts_sla_reminders` | `wf_sla_reminders` | wf_ | Workflow |
| `pts_notifications` | `ntf_messages` | ntf_ | Notification |
| `pts_user_signatures` | `sig_images` | sig_ | Signature |
| `pts_audit_events` | `audit_logs` | audit_ | Audit |
| `pts_access_review_cycles` | `audit_review_cycles` | audit_ | Audit |
| `pts_access_review_items` | `audit_review_items` | audit_ | Audit |
| `pts_data_quality_issues` | `dq_issues` | dq_ | Data Quality |

## Backend Files to Update

After running the SQL migration, update these backend files:

### Services (SQL queries)
- `src/modules/payroll/payroll.service.ts`
- `src/modules/payroll/core/calculator.ts`
- `src/modules/payroll/core/deductions.ts`
- `src/modules/payroll/core/retroactive.ts`
- `src/modules/request/request.service.ts`
- `src/modules/request/scope.service.ts`
- `src/modules/request/eligibility.service.ts`
- `src/modules/request/classification.service.ts`
- `src/modules/request/reassign.service.ts`
- `src/modules/report/report.service.ts`
- `src/modules/finance/finance.service.ts`
- `src/modules/notification/notification.service.ts`
- `src/modules/signature/signature.service.ts`
- `src/modules/admin/system.controller.ts`
- `src/modules/admin/officer.controller.ts`
- `src/modules/audit/audit.service.ts`
- `src/modules/sla/sla.service.ts`
- `src/modules/delegation/delegation.service.ts`
- `src/modules/access-review/access-review.service.ts`
- `src/modules/snapshot/snapshot.service.ts`
- `src/services/syncService.ts`

### Search & Replace Commands

```bash
# Run these in backend/src directory
# Use sed or IDE find/replace

# Employee tables
sed -i 's/pts_employees/emp_profiles/g' **/*.ts
sed -i 's/pts_employee_licenses/emp_licenses/g' **/*.ts
sed -i 's/pts_employee_movements/emp_movements/g' **/*.ts
sed -i 's/pts_support_employees/emp_support_staff/g' **/*.ts

# Leave tables
sed -i 's/pts_leave_requests/leave_records/g' **/*.ts
sed -i 's/pts_leave_quotas/leave_quotas/g' **/*.ts

# Request tables
sed -i 's/pts_requests/req_submissions/g' **/*.ts
sed -i 's/pts_request_actions/req_approvals/g' **/*.ts
sed -i 's/pts_attachments/req_attachments/g' **/*.ts
sed -i 's/pts_employee_eligibility/req_eligibility/g' **/*.ts

# Payroll tables
sed -i 's/pts_periods/pay_periods/g' **/*.ts
sed -i 's/pts_payouts/pay_results/g' **/*.ts
sed -i 's/pts_payout_items/pay_result_items/g' **/*.ts
sed -i 's/pts_period_snapshots/pay_snapshots/g' **/*.ts

# Config tables
sed -i 's/pts_master_rates/cfg_payment_rates/g' **/*.ts
sed -i 's/pts_holidays/cfg_holidays/g' **/*.ts
sed -i 's/pts_sla_config/cfg_sla_rules/g' **/*.ts

# Workflow tables
sed -i 's/pts_delegations/wf_delegations/g' **/*.ts
sed -i 's/pts_sla_reminders/wf_sla_reminders/g' **/*.ts

# Other tables
sed -i 's/pts_notifications/ntf_messages/g' **/*.ts
sed -i 's/pts_user_signatures/sig_images/g' **/*.ts
sed -i 's/pts_audit_events/audit_logs/g' **/*.ts
sed -i 's/pts_access_review_cycles/audit_review_cycles/g' **/*.ts
sed -i 's/pts_access_review_items/audit_review_items/g' **/*.ts
sed -i 's/pts_data_quality_issues/dq_issues/g' **/*.ts
```

## Prefix Reference

| Prefix | Full Name | Tables |
|--------|-----------|--------|
| `emp_` | Employee | 4 |
| `leave_` | Leave | 2 |
| `req_` | Request | 5 |
| `pay_` | Payroll | 4 |
| `cfg_` | Config | 3 |
| `wf_` | Workflow | 2 |
| `ntf_` | Notification | 1 |
| `sig_` | Signature | 1 |
| `audit_` | Audit | 3 |
| `dq_` | Data Quality | 1 |
| - | users | 1 (no prefix) |

**Total: 27 tables**
