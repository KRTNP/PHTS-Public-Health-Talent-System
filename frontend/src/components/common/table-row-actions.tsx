'use client';

import { forwardRef, type MouseEventHandler } from 'react';
import Link from 'next/link';
import { Eye, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type VisibilityMode = 'always' | 'hover';

type TableRowViewActionProps = {
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  label?: string;
  visibility?: VisibilityMode;
  className?: string;
};

export function TableRowViewAction({
  href,
  onClick,
  label = 'ดูรายละเอียด',
  visibility = 'always',
  className,
}: TableRowViewActionProps) {
  if (href) {
    return (
      <Button
        variant="ghost"
        size="icon"
        asChild
        className={cn(
          'h-8 w-8 text-muted-foreground transition-colors hover:text-primary',
          visibility === 'hover' ? 'opacity-0 group-hover:opacity-100 transition-opacity' : null,
          className,
        )}
      >
        <Link href={href} title={label} aria-label={label}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'h-8 w-8 text-muted-foreground transition-colors hover:text-primary',
        visibility === 'hover' ? 'opacity-0 group-hover:opacity-100 transition-opacity' : null,
        className,
      )}
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}

type TableRowMoreActionsTriggerProps = {
  label?: string;
  className?: string;
};

export const TableRowMoreActionsTrigger = forwardRef<
  HTMLButtonElement,
  TableRowMoreActionsTriggerProps
>(({ label = 'การดำเนินการเพิ่มเติม', className, ...props }, ref) => (
  <Button
    ref={ref}
    variant="ghost"
    size="icon"
    title={label}
    aria-label={label}
    className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
  </Button>
));
TableRowMoreActionsTrigger.displayName = 'TableRowMoreActionsTrigger';
