export const buildEligibilityCsv = (rows: Array<Record<string, unknown>>): string => {
  const escapeCsv = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[\",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = [
    "eligibility_id",
    "request_no",
    "full_name",
    "profession_code",
    "position_name",
    "department",
    "sub_department",
    "group_no",
    "item_no",
    "sub_item_no",
    "rate_amount",
    "effective_date",
    "expiry_date",
  ];

  const lines: string[] = [];
  // UTF-8 BOM for Excel-friendly Thai text.
  lines.push("\uFEFF" + header.join(","));

  for (const row of rows) {
    const fullName =
      `${row.title ?? ""}${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
    lines.push(
      [
        row.eligibility_id,
        row.request_no,
        fullName,
        row.profession_code,
        row.position_name,
        row.department,
        row.sub_department,
        row.group_no,
        row.item_no,
        row.sub_item_no,
        row.rate_amount,
        row.effective_date,
        row.expiry_date,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  return lines.join("\n");
};

export const buildEligibilityCsvFileName = (now = new Date()): string =>
  `eligibility_${now.toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
