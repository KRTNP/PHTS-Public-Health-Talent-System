import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AttachmentPreviewDialog } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  Edit,
  Trash2,
  PlusCircle,
  PenLine,
  FileText,
  ClipboardCheck,
} from 'lucide-react';
import type {
  LeaveQuotaStatusResponse,
  LeaveReturnReportEvent,
} from '@/features/leave-management/core/api';
import { LeaveDetailContent } from '@/features/leave-management/components/detail/LeaveDetailContent';
import {
  AddLeaveForm,
  EditLeaveForm,
  RecordReportForm,
} from '@/features/leave-management/components/forms/LeaveForms';
import type {
  LeaveRecord,
  LeaveRecordDocument,
} from '@/features/leave-management/core/types';

export function LeaveManagementDialogs({
  showAddDialog,
  onShowAddDialogChange,
  showEditDialog,
  onShowEditDialogChange,
  showDetailDialog,
  onShowDetailDialogChange,
  showReportDialog,
  onShowReportDialogChange,
  showDeleteAlert,
  onShowDeleteAlertChange,
  showSuccessDialog,
  onShowSuccessDialogChange,
  successMessage,
  selectedLeave,
  editingReturnEventId,
  personnel,
  documents,
  returnReportEvents,
  quotaStatus,
  previewOpen,
  previewUrl,
  previewName,
  onPreviewOpenChange,
  onAddLeave,
  onEditLeave,
  onRecordReport,
  onDeleteLeave,
  onEditReturnEvent,
  onDeleteReturnEvent,
  onDeleteDocument,
  onOpenPreview,
  onOpenEditFromDetail,
  onCloseReportDialog,
  getLeaveTypeColor,
  formatDateDisplay,
}: {
  // ... (Props definition remains the same)
  showAddDialog: boolean;
  onShowAddDialogChange: (open: boolean) => void;
  showEditDialog: boolean;
  onShowEditDialogChange: (open: boolean) => void;
  showDetailDialog: boolean;
  onShowDetailDialogChange: (open: boolean) => void;
  showReportDialog: boolean;
  onShowReportDialogChange: (open: boolean) => void;
  showDeleteAlert: boolean;
  onShowDeleteAlertChange: (open: boolean) => void;
  showSuccessDialog: boolean;
  onShowSuccessDialogChange: (open: boolean) => void;
  successMessage: string;
  selectedLeave: LeaveRecord | null;
  editingReturnEventId: number | null;
  personnel: Array<{ id: string; name: string; position: string; department: string }>;
  documents: LeaveRecordDocument[];
  returnReportEvents: LeaveReturnReportEvent[];
  quotaStatus?: LeaveQuotaStatusResponse | null;
  previewOpen: boolean;
  previewUrl: string;
  previewName: string;
  onPreviewOpenChange: (open: boolean) => void;
  onAddLeave: (
    payload: Partial<LeaveRecord> & { leaveRecordId?: number; files?: File[] },
  ) => Promise<void>;
  onEditLeave: (payload: LeaveRecord & { files?: File[] }) => Promise<void>;
  onRecordReport: (payload: {
    reportDate: string;
    resumeDate?: string;
    note: string;
    resumeStudyProgram?: string;
  }) => Promise<void>;
  onDeleteLeave: () => Promise<void>;
  onEditReturnEvent: (eventId: number) => void;
  onDeleteReturnEvent: (eventId?: number) => void;
  onDeleteDocument: (documentId: number) => Promise<void>;
  onOpenPreview: (url: string, name: string) => void;
  onOpenEditFromDetail: () => void;
  onCloseReportDialog: () => void;
  getLeaveTypeColor: (type: string) => string;
  formatDateDisplay: (date: string) => string;
}) {
  return (
    <>
      {/* 1. Add Leave Dialog */}
      <Dialog open={showAddDialog} onOpenChange={onShowAddDialogChange}>
        <DialogContent className="sm:max-w-2xl bg-card border-border p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <PlusCircle className="h-5 w-5 text-primary" />
              เพิ่มรายการวันลา
            </DialogTitle>
            <DialogDescription>
              บันทึกประวัติการลาของบุคลากรตามเอกสารอนุมัติทางราชการ
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 overflow-y-auto flex-1">
            <AddLeaveForm
              onClose={() => onShowAddDialogChange(false)}
              onSave={onAddLeave}
              personnel={personnel}
              onPreview={onOpenPreview}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Leave Dialog */}
      <Dialog open={showEditDialog} onOpenChange={onShowEditDialogChange}>
        <DialogContent className="sm:max-w-2xl bg-card border-border p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <PenLine className="h-5 w-5 text-primary" />
              แก้ไขรายการวันลา
            </DialogTitle>
            <DialogDescription>
              ปรับปรุงข้อมูลการลาของ{' '}
              <span className="font-semibold text-foreground">{selectedLeave?.personName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 overflow-y-auto flex-1">
            {selectedLeave && (
              <EditLeaveForm
                leave={selectedLeave}
                onClose={() => onShowEditDialogChange(false)}
                onSave={onEditLeave}
                onPreview={onOpenPreview}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={onShowDetailDialogChange}>
        <DialogContent className="sm:max-w-3xl bg-card border-border p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <FileText className="h-5 w-5 text-primary" />
                  รายละเอียดการลา
                </DialogTitle>
                <DialogDescription>
                  ตรวจสอบข้อมูลและประวัติการรายงานตัวของ{' '}
                  <span className="font-semibold text-foreground">{selectedLeave?.personName}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto flex-1 bg-muted/5">
            {selectedLeave && (
              <LeaveDetailContent
                leave={selectedLeave}
                getLeaveTypeColor={getLeaveTypeColor}
                formatDateDisplay={formatDateDisplay}
                documents={documents}
                returnReportEvents={returnReportEvents}
                quotaStatus={quotaStatus}
                onEditReturnReportEvent={(event) => onEditReturnEvent(Number(event.event_id ?? 0))}
                onDeleteReturnReportEvent={(event) => onDeleteReturnEvent(event.event_id)}
                onPreview={onOpenPreview}
                onDeleteDocument={onDeleteDocument}
              />
            )}
          </div>

          {/* UX Fix: Responsive Footer that doesn't hide the delete button on mobile */}
          <DialogFooter className="p-4 border-t bg-background shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3 sm:gap-0">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto gap-2"
              onClick={() => onShowDeleteAlertChange(true)}
            >
              <Trash2 className="h-4 w-4" /> ลบรายการ
            </Button>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onShowDetailDialogChange(false)}
              >
                ปิดหน้าต่าง
              </Button>
              <Button onClick={onOpenEditFromDetail} className="w-full sm:w-auto gap-2 shadow-sm">
                <Edit className="h-4 w-4" /> แก้ไขข้อมูล
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Return Report Dialog */}
      <Dialog
        open={showReportDialog}
        onOpenChange={(open) => {
          onShowReportDialogChange(open);
          if (!open) onCloseReportDialog();
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {editingReturnEventId !== null ? 'แก้ไขการรายงานตัว' : 'บันทึกการรายงานตัวกลับ'}
            </DialogTitle>
            <DialogDescription>
              บันทึกประวัติ{' '}
              <span className="font-semibold text-foreground">{selectedLeave?.personName}</span>{' '}
              กลับเข้าปฏิบัติงานตามปกติ
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 overflow-y-auto">
            <RecordReportForm
              key={`${selectedLeave?.id ?? 'none'}:${editingReturnEventId ?? 'new'}`}
              leave={selectedLeave}
              initialEvent={
                returnReportEvents.find(
                  (event) => Number(event.event_id ?? -1) === Number(editingReturnEventId ?? -2),
                ) ?? null
              }
              onClose={onCloseReportDialog}
              onSave={onRecordReport}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Delete Alert Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={onShowDeleteAlertChange}>
        <AlertDialogContent className="bg-card border-border sm:max-w-[400px]">
          <AlertDialogHeader>
            <div className="mx-auto bg-destructive/10 p-3.5 rounded-full mb-3 w-fit ring-8 ring-destructive/5">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">ยืนยันการลบรายการ</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              คุณต้องการลบรายการวันลาของ
              <br />
              <strong className="text-foreground text-base mt-1 block">
                {selectedLeave?.personName}
              </strong>
              <span className="mt-3 block p-2 bg-destructive/5 rounded-md border border-destructive/20 text-xs text-destructive font-medium">
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
                และเอกสารแนบที่เกี่ยวข้องจะถูกลบออกจากระบบอย่างถาวร
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center mt-2 flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto sm:mr-2">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDeleteLeave()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto shadow-sm"
            >
              ยืนยันการลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 6. Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={onShowSuccessDialogChange}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
          <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in-95 duration-300">
            <div className="p-3.5 rounded-full bg-emerald-500/10 mb-5 ring-8 ring-emerald-500/5">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <DialogTitle className="text-center text-2xl font-bold tracking-tight mb-2">
              ทำรายการสำเร็จ
            </DialogTitle>
            <p className="text-sm text-muted-foreground text-center px-4">{successMessage}</p>
          </div>
          <DialogFooter className="sm:justify-center pb-2">
            <Button
              onClick={() => onShowSuccessDialogChange(false)}
              variant="success"
              className="w-full sm:w-32 shadow-sm"
            >
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Attachment Preview */}
      <AttachmentPreviewDialog
        open={previewOpen}
        onOpenChange={onPreviewOpenChange}
        previewUrl={previewUrl}
        previewName={previewName}
      />
    </>
  );
}
