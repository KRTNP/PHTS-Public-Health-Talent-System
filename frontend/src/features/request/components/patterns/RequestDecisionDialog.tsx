import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type RequestDecisionAction = "approve" | "reject" | "return" | null;

type RequestDecisionDialogProps = {
  actionType: RequestDecisionAction;
  requestLabel: string;
  comment: string;
  error?: string | null;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
};

export function RequestDecisionDialog({
  actionType,
  requestLabel,
  comment,
  error,
  isPending,
  onOpenChange,
  onCommentChange,
  onConfirm,
}: RequestDecisionDialogProps) {
  return (
    <Dialog open={!!actionType} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {actionType === "approve" && "อนุมัติคำขอ"}
            {actionType === "reject" && "ไม่อนุมัติคำขอ"}
            {actionType === "return" && "ส่งกลับแก้ไข"}
          </DialogTitle>
          <DialogDescription>{requestLabel}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-foreground">
              {actionType === "approve" ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผล"}
            </label>
            <Textarea
              placeholder={
                actionType === "approve"
                  ? "ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                  : actionType === "reject"
                    ? "ระบุเหตุผลที่ไม่อนุมัติ"
                    : "ระบุสิ่งที่ต้องแก้ไข"
              }
              value={comment}
              onChange={(event) => onCommentChange(event.target.value)}
              className="mt-2"
            />
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant={
              actionType === "approve"
                ? "success"
                : actionType === "return"
                  ? "warning"
                  : "destructive"
            }
          >
            {actionType === "approve" && "อนุมัติ"}
            {actionType === "reject" && "ไม่อนุมัติ"}
            {actionType === "return" && "ส่งกลับแก้ไข"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
