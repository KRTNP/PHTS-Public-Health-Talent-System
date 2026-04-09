import { render, screen } from "@testing-library/react";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";

describe("AttachmentPreviewDialog", () => {
  it("blocks javascript preview URLs in links", () => {
    render(
      <AttachmentPreviewDialog
        open
        onOpenChange={() => {}}
        previewUrl="javascript:alert(1)"
        previewName="malicious"
      />,
    );

    const openInNewTabLink = screen.getByRole("link", { name: /เปิดแท็บใหม่/i });
    expect(openInNewTabLink).toHaveAttribute("href", "#");

    const downloadLink = screen.getByRole("link", { name: /ดาวน์โหลดไฟล์/i });
    expect(downloadLink).toHaveAttribute("href", "#");
  });

  it("keeps safe HTTP URLs for preview actions", () => {
    const previewUrl = "https://example.com/files/test file.pdf";

    render(
      <AttachmentPreviewDialog
        open
        onOpenChange={() => {}}
        previewUrl={previewUrl}
        previewName="test file.pdf"
      />,
    );

    const openInNewTabLink = screen.getByRole("link", { name: /เปิดแท็บใหม่/i });
    expect(openInNewTabLink.getAttribute("href")).toBe(
      "https://example.com/files/test%20file.pdf",
    );
  });
});
