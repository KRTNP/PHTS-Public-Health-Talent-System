import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import { CheckCircle, Cancel, Reply } from '@mui/icons-material';

type ApprovalDialogProps = Readonly<{
  open: boolean;
  type: 'APPROVE' | 'REJECT' | 'RETURN';
  onClose: () => void;
  onConfirm: (comment: string) => void;
}>;

export default function ApprovalDialog({ open, type, onClose, onConfirm }: ApprovalDialogProps) {
  const [comment, setComment] = useState('');

  const getConfig = () => {
    switch (type) {
      case 'APPROVE': return { title: 'ยืนยันการอนุมัติ', color: 'success.main', icon: <CheckCircle sx={{ fontSize: 40 }} />, text: 'คุณต้องการอนุมัติคำขอนี้ใช่หรือไม่?' };
      case 'REJECT': return { title: 'ปฏิเสธคำขอ', color: 'error.main', icon: <Cancel sx={{ fontSize: 40 }} />, text: 'กรุณาระบุเหตุผลในการปฏิเสธ' };
      case 'RETURN': return { title: 'ส่งคืนแก้ไข', color: 'warning.main', icon: <Reply sx={{ fontSize: 40 }} />, text: 'กรุณาระบุสิ่งที่ต้องการให้แก้ไข' };
    }
  };

  const config = getConfig();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4, px: 3 }}>
        <Avatar sx={{ bgcolor: config.color + '20', color: config.color, width: 72, height: 72, mb: 2 }}>
          {config.icon}
        </Avatar>
        <Typography variant="h6" fontWeight={700} gutterBottom>{config.title}</Typography>
        <Typography variant="body2" color="text.secondary" align="center" mb={3}>
          {config.text}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 0 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="ความเห็นเพิ่มเติม (ถ้ามี)"
          variant="outlined"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required={type !== 'APPROVE'}
          error={type !== 'APPROVE' && comment.trim() === ''}
          helperText={type !== 'APPROVE' && comment.trim() === '' ? 'กรุณาระบุเหตุผล' : ''}
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} color="inherit" variant="text" sx={{ borderRadius: 2 }}>ยกเลิก</Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(comment)}
          disabled={type !== 'APPROVE' && comment.trim() === ''}
          sx={{
            bgcolor: config.color,
            '&:hover': { bgcolor: config.color },
            borderRadius: 2,
            px: 3
          }}
        >
          ยืนยัน
        </Button>
      </DialogActions>
    </Dialog>
  );
}
