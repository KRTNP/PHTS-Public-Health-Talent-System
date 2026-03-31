export type ApproverRequestsPageTheme = {
  requestLinkClassName: string;
};

export type ApproverActionType = 'approve' | 'reject' | 'return';

export type ApproverRequestsPageConfig = {
  basePath: string;
  subtitle: string;
  pageTitle: string;
  labels: {
    pendingTitle: string;
    summaryCards: {
      total: string;
      normal: string;
      warning: string;
      danger: string;
    };
    searchPlaceholder: string;
    slaFilterPlaceholder: string;
    slaFilterOptions: {
      all: string;
      normal: string;
      warning: string;
      danger: string;
    };
    tableHeaders: {
      requestNo: string;
      nameAndPosition: string;
      department: string;
      mapping: string;
      amount: string;
      sla: string;
      actions: string;
    };
    tableStates: {
      loading: string;
      empty: string;
      errorFallback: string;
      rowCountPrefix: string;
      rowCountSuffix: string;
    };
    dialog: {
      titleByAction: Record<ApproverActionType, string>;
      descriptionPrefix: string;
      descriptionConnector: string;
      requestNoLabel: string;
      requesterLabel: string;
      amountLabel: string;
      optionalCommentLabel: string;
      requiredCommentLabel: string;
      optionalCommentPlaceholder: string;
      rejectCommentPlaceholder: string;
      returnCommentPlaceholder: string;
      validationCommentRequired: string;
      successMessage: string;
      genericErrorMessage: string;
      cancelButton: string;
      confirmButton: string;
      savingButton: string;
    };
  };
  theme: ApproverRequestsPageTheme;
};

export const headHrRequestsPageConfig: ApproverRequestsPageConfig = {
  basePath: '/head-hr',
  pageTitle: 'รายการคำขอที่รออนุมัติ',
  subtitle: 'ตรวจสอบและอนุมัติคำขอ พ.ต.ส. ที่รอการพิจารณาในขั้นทรัพยากรบุคคล',
  labels: {
    pendingTitle: 'รายการรอดำเนินการ',
    summaryCards: {
      total: 'ทั้งหมด',
      normal: 'ปกติ (ตามกำหนดเวลา)',
      warning: 'ใกล้ครบกำหนด',
      danger: 'เกินกำหนด',
    },
    searchPlaceholder: 'ค้นหาชื่อ, เลขที่คำขอ...',
    slaFilterPlaceholder: 'สถานะกำหนดเวลา',
    slaFilterOptions: {
      all: 'ทุกสถานะกำหนดเวลา',
      normal: 'ปกติ',
      warning: 'ใกล้ครบกำหนด',
      danger: 'เกินกำหนด',
    },
    tableHeaders: {
      requestNo: 'เลขที่คำขอ',
      nameAndPosition: 'ชื่อ-สกุล / ตำแหน่ง',
      department: 'หน่วยงาน',
      mapping: 'กลุ่ม/ข้อ',
      amount: 'อัตรา (บาท)',
      sla: 'กำหนดเวลา',
      actions: 'จัดการ',
    },
    tableStates: {
      loading: 'กำลังโหลดข้อมูล...',
      empty: 'ไม่พบรายการคำขอ',
      errorFallback: 'ไม่สามารถโหลดรายการคำขอได้',
      rowCountPrefix: 'แสดง',
      rowCountSuffix: 'รายการ',
    },
    dialog: {
      titleByAction: {
        approve: 'ยืนยันการอนุมัติ',
        reject: 'ยืนยันการไม่อนุมัติ',
        return: 'ยืนยันการส่งกลับแก้ไข',
      },
      descriptionPrefix: 'คำขอ',
      descriptionConnector: 'ของ',
      requestNoLabel: 'คำขอเลขที่:',
      requesterLabel: 'ผู้ยื่น:',
      amountLabel: 'จำนวนเงิน:',
      optionalCommentLabel: 'หมายเหตุ (ไม่บังคับ)',
      requiredCommentLabel: 'เหตุผลการดำเนินการ',
      optionalCommentPlaceholder: 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)',
      rejectCommentPlaceholder: 'โปรดระบุเหตุผลที่ไม่อนุมัติ...',
      returnCommentPlaceholder: 'โปรดระบุสิ่งที่ต้องแก้ไข...',
      validationCommentRequired: 'กรุณาระบุเหตุผลก่อนดำเนินการ',
      successMessage: 'บันทึกผลการพิจารณาเรียบร้อยแล้ว',
      genericErrorMessage: 'ไม่สามารถดำเนินการได้',
      cancelButton: 'ยกเลิก',
      confirmButton: 'ยืนยัน',
      savingButton: 'กำลังบันทึก...',
    },
  },
  theme: {
    requestLinkClassName: 'text-primary hover:underline',
  },
};

export const headFinanceRequestsPageConfig: ApproverRequestsPageConfig = {
  basePath: '/head-finance',
  pageTitle: 'รายการคำขอที่รออนุมัติ',
  subtitle: 'ตรวจสอบและอนุมัติคำขอ พ.ต.ส. ที่รอการพิจารณาในขั้นการเงิน',
  labels: {
    pendingTitle: 'รายการรอดำเนินการ',
    summaryCards: {
      total: 'ทั้งหมด',
      normal: 'ปกติ (ตามกำหนดเวลา)',
      warning: 'ใกล้ครบกำหนด',
      danger: 'เกินกำหนด',
    },
    searchPlaceholder: 'ค้นหาชื่อ, เลขที่คำขอ...',
    slaFilterPlaceholder: 'สถานะกำหนดเวลา',
    slaFilterOptions: {
      all: 'ทุกสถานะกำหนดเวลา',
      normal: 'ปกติ',
      warning: 'ใกล้ครบกำหนด',
      danger: 'เกินกำหนด',
    },
    tableHeaders: {
      requestNo: 'เลขที่คำขอ',
      nameAndPosition: 'ชื่อ-สกุล / ตำแหน่ง',
      department: 'หน่วยงาน',
      mapping: 'กลุ่ม/ข้อ',
      amount: 'อัตรา (บาท)',
      sla: 'กำหนดเวลา',
      actions: 'จัดการ',
    },
    tableStates: {
      loading: 'กำลังโหลดข้อมูล...',
      empty: 'ไม่พบรายการคำขอ',
      errorFallback: 'ไม่สามารถโหลดรายการคำขอได้',
      rowCountPrefix: 'แสดง',
      rowCountSuffix: 'รายการ',
    },
    dialog: {
      titleByAction: {
        approve: 'ยืนยันการอนุมัติ',
        reject: 'ยืนยันการไม่อนุมัติ',
        return: 'ยืนยันการส่งกลับแก้ไข',
      },
      descriptionPrefix: 'คำขอ',
      descriptionConnector: 'ของ',
      requestNoLabel: 'คำขอเลขที่:',
      requesterLabel: 'ผู้ยื่น:',
      amountLabel: 'จำนวนเงิน:',
      optionalCommentLabel: 'หมายเหตุ (ไม่บังคับ)',
      requiredCommentLabel: 'เหตุผลการดำเนินการ',
      optionalCommentPlaceholder: 'ระบุหมายเหตุเพิ่มเติม (ถ้ามี)',
      rejectCommentPlaceholder: 'โปรดระบุเหตุผลที่ไม่อนุมัติ...',
      returnCommentPlaceholder: 'โปรดระบุสิ่งที่ต้องแก้ไข...',
      validationCommentRequired: 'กรุณาระบุเหตุผลก่อนดำเนินการ',
      successMessage: 'บันทึกผลการพิจารณาเรียบร้อยแล้ว',
      genericErrorMessage: 'ไม่สามารถดำเนินการได้',
      cancelButton: 'ยกเลิก',
      confirmButton: 'ยืนยัน',
      savingButton: 'กำลังบันทึก...',
    },
  },
  theme: {
    requestLinkClassName: 'text-primary hover:underline',
  },
};
