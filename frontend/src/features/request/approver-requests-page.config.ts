export type ApproverRequestsPageTheme = {
  requestLinkClassName: string;
};

export type ApproverRequestsPageConfig = {
  basePath: string;
  subtitle: string;
  labels: {
    pendingTitle: string;
  };
  theme: ApproverRequestsPageTheme;
};

export const headHrRequestsPageConfig: ApproverRequestsPageConfig = {
  basePath: '/head-hr',
  subtitle: 'ตรวจสอบและอนุมัติคำขอ พ.ต.ส. ที่รอการพิจารณาในขั้นทรัพยากรบุคคล',
  labels: {
    pendingTitle: 'รายการรอดำเนินการ',
  },
  theme: {
    requestLinkClassName: 'text-primary hover:underline',
  },
};

export const headFinanceRequestsPageConfig: ApproverRequestsPageConfig = {
  basePath: '/head-finance',
  subtitle: 'ตรวจสอบและอนุมัติคำขอ พ.ต.ส. ที่รอการพิจารณาในขั้นการเงิน',
  labels: {
    pendingTitle: 'รายการรอดำเนินการ',
  },
  theme: {
    requestLinkClassName: 'text-primary hover:underline',
  },
};
