# Approval Return Routing Design

**Status:** Approved business direction; implementation pending

## Goal

ทำให้การส่งคำขอกลับแก้ไขมีปลายทางที่ถูกต้องตาม workflow: คำขอที่ผ่าน `PTS_OFFICER` แล้วและถูก role ถัดไปส่งกลับ ต้องกลับไปให้ PTS ตรวจซ้ำก่อน ส่วน PTS จะส่งต่อผู้ยื่นเฉพาะเมื่อปัญหาอยู่ที่ข้อมูลหรือเอกสารของผู้ยื่นจริง

## Current behavior and problem

`RequestApprovalService.returnRequest()` ใช้ transition เดียวกับทุก role: บันทึก `RETURN`, ตั้ง `status = RETURNED`, ตั้ง `current_step = 1` และแจ้งผู้ยื่นโดยตรง ทำให้ระบบไม่รู้ว่าการส่งกลับมาจาก step ใดหรือควรส่งไปยัง role ใด

ปัจจุบัน `req_submissions` และ `req_approvals` ไม่มีข้อมูล return target/from/to และ PTS pending queue ไม่รองรับงานที่ถูกส่งกลับมาเพื่อให้ PTS ตรวจซ้ำ

## Approved workflow

```text
USER → WARD_SCOPE → DEPT_SCOPE → PTS_OFFICER → HEAD_HR
     → HEAD_FINANCE → DIRECTOR → APPROVED
```

1. `WARD_SCOPE`/`DEPT_SCOPE` return ไปผู้ยื่น เพราะเป็นข้อมูลต้นทางหรือเอกสารของ scope
2. `HEAD_HR`/`HEAD_FINANCE`/`DIRECTOR` return ไป `PTS_OFFICER` ก่อน
3. PTS approve งาน internal return แล้วกลับไปยัง downstream step เดิม
4. PTS return ไปผู้ยื่นเฉพาะเมื่อผู้ยื่นต้องแก้ข้อมูล/เอกสาร
5. ผู้ยื่นแก้แล้วกลับเข้า PTS โดยตรง ไม่ย้อน WARD/DEPT
6. `REJECT` ยังคงเป็นสถานะจบ

Examples:

```text
HEAD_HR(step 4) RETURN → PTS(step 3) APPROVE → HEAD_HR(step 4)
HEAD_FINANCE(step 5) RETURN → PTS(step 3) APPROVE → HEAD_FINANCE(step 5)
PTS(step 3) RETURN → USER → PTS(step 3) APPROVE → HEAD_HR(step 4)
```

## State model

คง status `RETURNED` เพื่อ compatibility และเพิ่ม metadata ใน request:

- `return_target`: `APPLICANT`, `PTS_OFFICER`, หรือ `NULL`
- `return_from_step`: step ที่เริ่มการ return
- `return_to_step`: step ปลายทาง (`1` สำหรับ applicant, `3` สำหรับ PTS)

Legacy `RETURNED` ที่ metadata เป็น null ให้ตีความเป็น applicant-targeted เพื่อไม่ทำลายข้อมูลเก่า

Approval history ต้องเก็บ effective actor role และ routing metadata เพื่อรองรับหลายรอบการ return โดยไม่อนุมานจาก current row

## Invariants

- ตรวจ role และ exact scope ตาม step ปัจจุบัน
- downstream role เลือก target เองไม่ได้; server derive เป็น PTS
- PTS approve ได้เฉพาะงานที่ target เป็น PTS
- applicant แก้/submit ได้เฉพาะ applicant-targeted return (legacy null นับเป็น applicant)
- owner ห้าม approve งานตัวเอง
- return comment ต้องไม่ว่างและไม่เกิน 1000 ตัวอักษร
- approve ใช้ signature rule เดิม; return ไม่สร้าง approval signature
- ทุก transition ต้องบันทึก history, audit และแจ้ง target จริง

## UI and verification

PTS queue ต้องรวม normal step 3 และ `RETURNED` ที่ target PTS; applicant edit page ต้องเปิดเฉพาะ applicant-targeted return; timeline ต้องแสดงเส้นทางเช่น `HEAD_HR → PTS_OFFICER` และ `PTS_OFFICER → USER`

ต้องทดสอบ normal approval, downstream-to-PTS return, PTS resume, PTS-to-applicant return, applicant resubmit, legacy return, authorization, required comment, notification, queue, repeated cycles, rejection terminality และ timeline
