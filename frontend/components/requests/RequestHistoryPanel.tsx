import React from 'react';
import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { RequestActionWithActor } from '@/types/request.types';

type RequestHistoryPanelProps = Readonly<{
  actions?: RequestActionWithActor[];
  formatDate: (date?: string | Date | null, withTime?: boolean) => string;
  emptyLabel?: string;
  actorVariant?: 'user' | 'officer';
  paperSx?: SxProps<Theme>;
}>;

const renderUserActor = (action: RequestActionWithActor) => {
  if (action.actor?.first_name) {
    return (
      <>
        {action.actor.first_name} {action.actor.last_name || ''}
        {action.actor.role ? (
          <Typography component="span" variant="caption" color="text.secondary">
            {' '}({action.actor.role})
          </Typography>
        ) : null}
      </>
    );
  }
  return <span style={{ color: '#666' }}>{action.actor?.role}</span>;
};

const renderOfficerActor = (action: RequestActionWithActor) => (
  <>
    โดย: {action.actor?.role || '-'}
    {action.actor?.citizen_id ? ` (${action.actor.citizen_id})` : ''}
  </>
);

export default function RequestHistoryPanel({
  actions,
  formatDate,
  emptyLabel = 'ยังไม่มีประวัติการดำเนินงาน',
  actorVariant = 'user',
  paperSx,
}: RequestHistoryPanelProps) {
  const renderActionTitle = (action: RequestActionWithActor) =>
    actorVariant === 'officer' ? action.action || action.action_type : action.action;

  const renderComment = (action: RequestActionWithActor) => {
    if (!action.comment) return null;
    if (actorVariant === 'officer') {
      return (
        <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
          &quot;{action.comment}&quot;
        </Typography>
      );
    }
    return (
      <Box mt={1} p={1.5} bgcolor="#fff" border="1px solid #eee" borderRadius={2}>
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          &quot;{action.comment}&quot;
        </Typography>
      </Box>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#fafafa', ...paperSx }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        ประวัติการดำเนินงาน
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Stack spacing={3}>
        {actions && actions.length > 0 ? (
          actions.map((action) => (
            <Box
              key={action.action_id}
              position="relative"
              pl={2}
              sx={{ borderLeft: '2px solid #e0e0e0' }}
            >
              <Box
                position="absolute"
                left="-5px"
                top="0"
                width="8px"
                height="8px"
                borderRadius="50%"
                bgcolor="primary.main"
              />
              <Typography variant="body2" fontWeight={actorVariant === 'officer' ? 600 : 700}>
                {renderActionTitle(action)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={actorVariant === 'user' ? 0.5 : 0}>
                {formatDate(action.action_date || action.created_at, true)}
              </Typography>
              {actorVariant === 'user' ? (
                <Typography variant="body2" fontSize="0.85rem" fontWeight={500}>
                  โดย: {renderUserActor(action)}
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {renderOfficerActor(action)}
                </Typography>
              )}
              {renderComment(action)}
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
