import { useDeferredValue, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildSearchParam } from '@/features/leave-management/domain/search';

type LeaveTab = 'all' | 'study' | 'pending-report';

const isLeaveTab = (value: string | null): value is LeaveTab =>
  value === 'all' || value === 'study' || value === 'pending-report';

export function useLeaveManagementFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialSearchQuery = searchParams.get('search') ?? '';
  const initialTab = searchParams.get('tab');

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [typeFilter, setTypeFilter] = useState('all');
  const [fiscalYearFilter, setFiscalYearFilter] = useState<number | 'all'>('all');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [sortBy, setSortBy] = useState<'start_date' | 'name'>('start_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<LeaveTab>(isLeaveTab(initialTab) ? initialTab : 'all');

  const handleTabChange = (nextTab: string) => {
    if (!isLeaveTab(nextTab)) return;
    setActiveTab(nextTab);

    const currentTab = searchParams.get('tab') ?? 'all';
    if (currentTab === nextTab) return;

    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const fiscalYearOptions = useMemo(() => {
    const now = new Date();
    const currentFiscalYear =
      now.getMonth() >= 9 ? now.getFullYear() + 544 : now.getFullYear() + 543;
    const years = [];
    for (let y = currentFiscalYear - 5; y <= currentFiscalYear + 1; y += 1) {
      years.push(y);
    }
    return years;
  }, []);

  const offset = page * pageSize;
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearch = useMemo(
    () => buildSearchParam(deferredSearchQuery),
    [deferredSearchQuery],
  );

  const listParams = useMemo(
    () => ({
      leave_type: typeFilter === 'all' ? undefined : typeFilter,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: pageSize,
      offset,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, offset, pageSize, fiscalYearFilter, sortBy, sortDir, typeFilter],
  );

  const tabListParams = useMemo(
    () => ({
      leave_type: activeTab === 'study' ? 'education' : undefined,
      pending_report: activeTab === 'pending-report' ? true : undefined,
      fiscal_year: fiscalYearFilter === 'all' ? undefined : fiscalYearFilter,
      search: normalizedSearch,
      limit: 500,
      offset: 0,
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [normalizedSearch, fiscalYearFilter, sortBy, sortDir, activeTab],
  );

  return {
    searchQuery,
    typeFilter,
    fiscalYearFilter,
    page,
    pageSize,
    sortBy,
    sortDir,
    activeTab,
    fiscalYearOptions,
    offset,
    listParams,
    tabListParams,
    setPage,
    handleTabChange,
    onSearchChange: (value: string) => {
      setSearchQuery(value);
      setPage(0);
    },
    onTypeFilterChange: (value: string) => {
      setTypeFilter(value);
      setPage(0);
    },
    onFiscalYearFilterChange: (value: number | 'all') => {
      setFiscalYearFilter(value);
      setPage(0);
    },
    onSortChange: (nextSortBy: 'start_date' | 'name', nextSortDir: 'asc' | 'desc') => {
      setSortBy(nextSortBy);
      setSortDir(nextSortDir);
      setPage(0);
    },
    onPrevPage: () => setPage((prev) => Math.max(0, prev - 1)),
    onNextPage: () => setPage((prev) => prev + 1),
  };
}
