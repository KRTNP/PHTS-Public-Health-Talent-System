/**
 * Classification Constants
 * กฎเกณฑ์การจำแนกประเภทบุคลากรทางการแพทย์เพื่อกำหนดอัตราเงิน พ.ต.ส.
 */

export const DOCTOR_KEYWORDS = ['แพทย์', 'นายแพทย์'];
export const DOCTOR_GROUP3_KEYWORDS = ['อายุรกรรม', 'ออร์โธ', 'กุมาร', 'ศัลยกรรม', 'อายุรแพทย์'];
export const DOCTOR_GROUP2_EXPERT = ['เฉพาะทาง', 'เวชปฏิบัติทั่วไป'];

export const DENTIST_KEYWORDS = ['ทันตแพทย์'];
export const DENTIST_GROUP3_EXPERT = ['เฉพาะทาง'];
export const DENTIST_GROUP2_EXPERT = ['ทั่วไป'];

export const PHARMACIST_KEYWORDS = ['เภสัชกร'];
export const PHARMACIST_SUBDEPT = ['งานเภสัชกรรม', 'คลังยา', 'จ่ายยา'];
export const PHARMACIST_EXPERT = ['เภสัชคลินิก', 'เภสัชกรรมคลินิก'];

export const NURSE_TITLES = ['พยาบาลวิชาชีพ', 'พยาบาลเทคนิค', 'วิสัญญีพยาบาล'];
export const NURSE_KEYWORDS = ['พยาบาล'];

// กลุ่ม 3 (งานวิกฤต/เชี่ยวชาญสูง)
export const NURSE_GROUP3_SUB = ['ICU', 'CCU', 'วิกฤต', 'วิสัญญี'];
export const NURSE_GROUP3_EXPERT = ['APN', 'วิสัญญี', 'ICU', 'CCU'];

// กลุ่ม 2 (งานเฉพาะทาง/ความเสี่ยงสูง)
export const NURSE_GROUP2_SUB = [
  'OR',
  'ER',
  'LR',
  'ห้องผ่าตัด',
  'อุบัติเหตุ',
  'ห้องคลอด',
  'Ward',
  'OPD',
  'ผู้ป่วยใน',
  'ผู้ป่วยนอก',
];
export const NURSE_GROUP2_EXPERT = ['ER', 'OR', 'LR', 'NICU', 'PICU', 'ไตเทียม'];

export const ALLIED_POS = [
  'นักกายภาพบำบัด',
  'นักรังสีการแพทย์',
  'นักโภชนาการ',
  'นักเทคนิคการแพทย์',
  'นักจิตวิทยาคลินิก',
  'นักกิจกรรมบำบัด',
  'นักเทคโนโลยีหัวใจ',
];

export const ASSISTANT_NURSE_POS = ['ผู้ช่วยพยาบาล', 'พนักงานช่วยการพยาบาล'];
