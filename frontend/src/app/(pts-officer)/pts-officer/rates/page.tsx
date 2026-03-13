'use client';
export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Search,
  Info,
  CircleDollarSign,
  Users,
  Briefcase,
  Activity,
  Layers,
  AlertCircle,
  Settings2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useCreateMasterRate,
  useDeleteMasterRate,
  useMasterRatesConfig,
  useRateHierarchy,
  useUpdateMasterRate,
} from '@/features/master-data/hooks';
import { normalizeMasterRates } from '@/features/master-data/utils';
import { useQueryClient } from '@tanstack/react-query';
import { resolveProfessionLabel } from '@/shared/constants/profession';
import {
  formatThaiDate as formatThaiDateValue,
  formatThaiNumber,
} from '@/shared/utils/thai-locale';
import { cn } from '@/lib/utils';

interface AllowanceRate {
  id: number;
  professionCode: string;
  groupNo: number;
  itemNo?: string | null;
  subItemNo?: string | null;
  code: string;
  name: string;
  amount: number;
  description: string;
  requirements: string;
  isActive: boolean;
  effectiveDate: string;
  eligibleCount: number;
}

interface ProfessionGroup {
  id: string;
  code: string;
  name: string;
  allowedRates: string[];
  description: string;
  isActive: boolean;
}

type RatesViewMode = 'structure' | 'usage';

function formatCurrency(amount: number): string {
  return formatThaiNumber(amount);
}

function formatThaiDate(dateStr: string): string {
  return formatThaiDateValue(dateStr);
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response !== null &&
    'data' in (error as { response: { data?: unknown } }).response
  ) {
    const data = (error as { response: { data?: unknown } }).response.data;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const apiError = (data as { error?: unknown }).error;
      if (typeof apiError === 'string' && apiError.trim().length > 0) {
        return apiError;
      }
      if (
        typeof apiError === 'object' &&
        apiError !== null &&
        'message' in apiError &&
        typeof (apiError as { message?: unknown }).message === 'string'
      ) {
        return (apiError as { message: string }).message;
      }
    }
  }

  return fallback;
}

const RATE_PROFESSION_CODES = [
  'DOCTOR',
  'DENTIST',
  'PHARMACIST',
  'NURSE',
  'MED_TECH',
  'RAD_TECH',
  'PHYSIO',
  'SPEECH_THERAPIST',
  'SPECIAL_EDU',
  'OCC_THERAPY',
  'CLIN_PSY',
  'CARDIO_TECH',
] as const;

// 🎨 ยกระดับ StatCard ให้ดู Modern และมี Accent สีด้านซ้าย
function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  colorClass,
  bgClass,
  accentClass,
}: {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  accentClass: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border shadow-sm hover:shadow-md transition-all bg-white">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentClass}`} />
      <CardContent className="p-5 pl-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-black text-slate-800 tracking-tight tabular-nums">
              {value}
            </span>
            <span className="text-xs font-semibold text-slate-400">{unit}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${bgClass} ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [ratesViewMode, setRatesViewMode] = useState<RatesViewMode>('structure');
  const [showOnlyEligible, setShowOnlyEligible] = useState(false);
  const [isAddRateDialogOpen, setIsAddRateDialogOpen] = useState(false);
  const [isEditRateDialogOpen, setIsEditRateDialogOpen] = useState(false);
  const [isDeleteRateDialogOpen, setIsDeleteRateDialogOpen] = useState(false);
  const [selectedRate, setSelectedRate] = useState<AllowanceRate | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [newRate, setNewRate] = useState({
    professionCode: '',
    groupNo: '',
    itemNo: '',
    subItemNo: '',
    amount: 0,
    conditionDesc: '',
    detailedDesc: '',
    isActive: true,
  });

  const { data: ratesData } = useMasterRatesConfig();
  const { data: hierarchyData } = useRateHierarchy();
  const createRate = useCreateMasterRate();
  const updateRate = useUpdateMasterRate();
  const deleteRate = useDeleteMasterRate();
  const queryClient = useQueryClient();

  const rates = useMemo<AllowanceRate[]>(() => {
    if (!Array.isArray(ratesData)) return [];
    return normalizeMasterRates(ratesData as Array<Record<string, unknown>>);
  }, [ratesData]);

  const professions = useMemo<ProfessionGroup[]>(() => {
    if (!Array.isArray(hierarchyData)) return [];
    return hierarchyData.map((prof) => {
      const baseLabel = resolveProfessionLabel(prof.id, prof.name);
      const displayName = prof.name?.startsWith('กลุ่ม')
        ? prof.name
        : /[ก-๙]/.test(String(prof.name ?? ''))
          ? String(prof.name)
          : `กลุ่ม${baseLabel}`;

      const amounts = new Set<string>();
      prof.groups.forEach((group) => {
        amounts.add(formatCurrency(group.rate));
      });
      return {
        id: prof.id,
        code: prof.id,
        name: displayName,
        allowedRates: Array.from(amounts),
        description: `รวม ${prof.groups.length} กลุ่ม`,
        isActive: true,
      };
    });
  }, [hierarchyData]);

  const filteredRates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const searched = normalizedSearch
      ? rates.filter(
          (rate) =>
            rate.name.toLowerCase().includes(normalizedSearch) ||
            rate.code.toLowerCase().includes(normalizedSearch),
        )
      : rates;

    const scopeFiltered = showOnlyEligible
      ? searched.filter((rate) => Number(rate.eligibleCount ?? 0) > 0)
      : searched;

    const sorted = [...scopeFiltered].sort((a, b) => {
      if (ratesViewMode === 'usage') {
        const eligibleDiff = Number(b.eligibleCount ?? 0) - Number(a.eligibleCount ?? 0);
        if (eligibleDiff !== 0) return eligibleDiff;
        const amountDiff = Number(b.amount ?? 0) - Number(a.amount ?? 0);
        if (amountDiff !== 0) return amountDiff;
        return a.code.localeCompare(b.code, 'en');
      }

      const professionDiff = a.professionCode.localeCompare(b.professionCode, 'en');
      if (professionDiff !== 0) return professionDiff;

      const groupDiff = Number(a.groupNo ?? 0) - Number(b.groupNo ?? 0);
      if (groupDiff !== 0) return groupDiff;

      const itemDiff = String(a.itemNo ?? '').localeCompare(String(b.itemNo ?? ''), 'en', {
        numeric: true,
      });
      if (itemDiff !== 0) return itemDiff;

      const subItemDiff = String(a.subItemNo ?? '').localeCompare(String(b.subItemNo ?? ''), 'en', {
        numeric: true,
      });
      if (subItemDiff !== 0) return subItemDiff;

      return a.code.localeCompare(b.code, 'en');
    });

    return sorted;
  }, [rates, searchQuery, showOnlyEligible, ratesViewMode]);

  const filteredProfessions = professions.filter(
    (prof) =>
      prof.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prof.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddRate = async () => {
    setDialogError(null);
    if (!newRate.professionCode || !newRate.groupNo || newRate.amount <= 0) {
      setDialogError('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      toast.error('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      return;
    }
    try {
      await createRate.mutateAsync({
        profession_code: newRate.professionCode,
        group_no: Number(newRate.groupNo),
        item_no: newRate.itemNo || null,
        sub_item_no: newRate.subItemNo || null,
        amount: newRate.amount,
        condition_desc: newRate.conditionDesc,
        detailed_desc: newRate.detailedDesc,
        is_active: newRate.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('เพิ่มอัตราเงินเรียบร้อย');
      setNewRate({
        professionCode: '',
        groupNo: '',
        itemNo: '',
        subItemNo: '',
        amount: 0,
        conditionDesc: '',
        detailedDesc: '',
        isActive: true,
      });
      setIsAddRateDialogOpen(false);
    } catch {
      setDialogError('ไม่สามารถเพิ่มอัตราเงินได้');
      toast.error('ไม่สามารถเพิ่มอัตราเงินได้');
    }
  };

  const handleEditRate = async () => {
    if (!selectedRate) return;
    setDialogError(null);
    if (!selectedRate.professionCode || !selectedRate.groupNo || selectedRate.amount <= 0) {
      setDialogError('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      toast.error('กรุณากรอกข้อมูลอัตราให้ครบถ้วน');
      return;
    }
    try {
      await updateRate.mutateAsync({
        rateId: selectedRate.id,
        payload: {
          profession_code: selectedRate.professionCode,
          group_no: Number(selectedRate.groupNo),
          item_no: selectedRate.itemNo || null,
          sub_item_no: selectedRate.subItemNo || null,
          amount: selectedRate.amount,
          condition_desc: selectedRate.description,
          detailed_desc: selectedRate.requirements,
          is_active: selectedRate.isActive,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('อัปเดตอัตราเงินเรียบร้อย');
      setIsEditRateDialogOpen(false);
      setSelectedRate(null);
    } catch {
      setDialogError('ไม่สามารถอัปเดตอัตราเงินได้');
      toast.error('ไม่สามารถอัปเดตอัตราเงินได้');
    }
  };

  const handleDeleteRate = async () => {
    if (!selectedRate) return;
    setDialogError(null);
    try {
      await deleteRate.mutateAsync(selectedRate.id);
      await queryClient.invalidateQueries({ queryKey: ['master-rates-config'] });
      await queryClient.invalidateQueries({ queryKey: ['rate-hierarchy'] });
      toast.success('ลบอัตราเงินเรียบร้อย');
    } catch (error) {
      const message = extractApiErrorMessage(error, 'ไม่สามารถลบอัตราเงินได้');
      setDialogError(message);
      toast.error(message);
    } finally {
      setIsDeleteRateDialogOpen(false);
      setSelectedRate(null);
    }
  };

  const totalEligible = rates.reduce((sum, rate) => sum + rate.eligibleCount, 0);
  const totalMonthlyAmount = rates.reduce((sum, rate) => sum + rate.amount * rate.eligibleCount, 0);
  const isMutating = createRate.isPending || updateRate.isPending || deleteRate.isPending;

  return (
    <TooltipProvider>
      <div className="p-6 md:p-8 space-y-8 bg-slate-50/30 min-h-screen">
        {/* Header */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            จัดการอัตราเงิน พ.ต.ส.
          </h1>
          <p className="text-sm font-medium text-slate-500">
            กำหนดอัตราเงินเพิ่มและกลุ่มวิชาชีพที่มีสิทธิ์ได้รับค่าตอบแทน
          </p>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="อัตราเงินทั้งหมด"
            value={formatThaiNumber(rates.length)}
            unit="รายการ"
            icon={FileText}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
            accentClass="bg-blue-500"
          />
          <StatCard
            title="กลุ่มวิชาชีพ"
            value={formatThaiNumber(professions.length)}
            unit="กลุ่ม"
            icon={Briefcase}
            colorClass="text-purple-600"
            bgClass="bg-purple-50"
            accentClass="bg-purple-500"
          />
          <StatCard
            title="ผู้มีสิทธิ์ทั้งหมด"
            value={formatThaiNumber(totalEligible)}
            unit="คน"
            icon={Users}
            colorClass="text-emerald-600"
            bgClass="bg-emerald-50"
            accentClass="bg-emerald-500"
          />
          <StatCard
            title="ยอดเบิกจ่าย/เดือน"
            value={formatCurrency(totalMonthlyAmount)}
            unit="บาท"
            icon={CircleDollarSign}
            colorClass="text-amber-600"
            bgClass="bg-amber-50"
            accentClass="bg-amber-500"
          />
        </div>

        {/* Main Content */}
        <Tabs defaultValue="rates" className="space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-px">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger
                value="rates"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent py-2 px-1 gap-2 font-semibold"
              >
                <Activity className="h-4 w-4" /> อัตราเงิน พ.ต.ส.
              </TabsTrigger>
              <TabsTrigger
                value="professions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent py-2 px-1 gap-2 font-semibold"
              >
                <Layers className="h-4 w-4" /> กลุ่มวิชาชีพ
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Rates Tab */}
          <TabsContent
            value="rates"
            className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            {/* Unified Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center shadow-sm">
              {/* Search */}
              <div className="relative w-full xl:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="ค้นหาชื่ออัตรา, รหัสวิชาชีพ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/50 transition-all"
                />
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                  <Button
                    type="button"
                    size="sm"
                    variant={ratesViewMode === 'structure' ? 'default' : 'ghost'}
                    className={cn(
                      'h-8 px-3 text-xs font-medium rounded-md',
                      ratesViewMode === 'structure'
                        ? 'shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                    onClick={() => setRatesViewMode('structure')}
                  >
                    เรียงตามโครงสร้าง
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={ratesViewMode === 'usage' ? 'default' : 'ghost'}
                    className={cn(
                      'h-8 px-3 text-xs font-medium rounded-md',
                      ratesViewMode === 'usage'
                        ? 'shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                    onClick={() => setRatesViewMode('usage')}
                  >
                    เรียงตามการใช้งาน
                  </Button>
                </div>

                <Button
                  type="button"
                  variant={showOnlyEligible ? 'secondary' : 'outline'}
                  className={cn(
                    'h-10 text-xs font-medium border-slate-200 gap-2',
                    showOnlyEligible &&
                      'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                  )}
                  onClick={() => setShowOnlyEligible((prev) => !prev)}
                >
                  <Settings2 className="h-4 w-4" />
                  {showOnlyEligible ? 'แสดงเฉพาะผู้มีสิทธิ์' : 'แสดงอัตราทั้งหมด'}
                </Button>

                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1"></div>

                <Button
                  onClick={() => {
                    setDialogError(null);
                    setIsAddRateDialogOpen(true);
                  }}
                  className="h-10 w-full sm:w-auto shadow-sm gap-2"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่มอัตราเงิน
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end px-1">
              <p className="text-xs font-medium text-slate-500">
                พบ{' '}
                <span className="text-slate-800 font-bold">
                  {formatThaiNumber(filteredRates.length)}
                </span>{' '}
                จากทั้งหมด {formatThaiNumber(rates.length)} รายการ
              </p>
            </div>

            {/* Data Table */}
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] text-slate-600 font-bold">
                        วิชาชีพ / กลุ่ม-ข้อ
                      </TableHead>
                      <TableHead className="text-slate-600 font-bold min-w-[200px]">
                        ชื่ออัตรา
                      </TableHead>
                      <TableHead className="text-slate-600 font-bold text-right">
                        จำนวนเงิน
                      </TableHead>
                      <TableHead className="text-slate-600 font-bold text-center">
                        ผู้มีสิทธิ์
                      </TableHead>
                      <TableHead className="text-slate-600 font-bold text-center">
                        วันที่มีผล
                      </TableHead>
                      <TableHead className="text-slate-600 font-bold text-center">สถานะ</TableHead>
                      <TableHead className="text-slate-600 font-bold text-right w-[100px]">
                        จัดการ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Search className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">ไม่พบข้อมูลอัตราเงิน</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRates.map((rate) => (
                        <TableRow
                          key={rate.id}
                          className="group border-slate-100 hover:bg-slate-50/80 transition-colors"
                        >
                          <TableCell>
                            <div className="flex flex-col gap-1.5 items-start">
                              <span className="text-xs font-semibold text-slate-700">
                                {resolveProfessionLabel(rate.professionCode, rate.professionCode)}
                              </span>
                              <Badge
                                variant="outline"
                                className="px-2 py-0 h-5 text-[10px] font-mono text-slate-500 bg-white border-slate-200"
                              >
                                {rate.groupNo}/{rate.itemNo ?? '-'}/{rate.subItemNo ?? '-'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-800 font-medium">
                                {rate.name}
                              </span>
                              {(rate.description || rate.requirements) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-blue-400 cursor-help hover:text-blue-600 transition-colors shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs p-3.5 bg-slate-800 text-slate-50 border-none shadow-xl">
                                    <p className="font-bold mb-1.5 text-sm">{rate.description}</p>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                      {rate.requirements}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-emerald-600 tabular-nums">
                              {formatCurrency(rate.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className="bg-slate-100 text-slate-700 font-semibold tabular-nums border-none"
                            >
                              {rate.eligibleCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-slate-500 text-xs font-medium">
                              {formatThaiDate(rate.effectiveDate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                rate.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-50 text-slate-500 border-slate-200'
                              }
                            >
                              {rate.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                                onClick={() => {
                                  setDialogError(null);
                                  setSelectedRate(rate);
                                  setIsEditRateDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-full"
                                disabled={Number(rate.eligibleCount ?? 0) > 0}
                                title={
                                  Number(rate.eligibleCount ?? 0) > 0
                                    ? 'ลบไม่ได้เพราะยังมีผู้มีสิทธิ์อ้างอิงอัตรานี้'
                                    : 'ลบอัตราเงิน'
                                }
                                onClick={() => {
                                  setDialogError(null);
                                  setSelectedRate(rate);
                                  setIsDeleteRateDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Professions Tab */}
          <TabsContent
            value="professions"
            className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="relative w-full md:w-[320px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="ค้นหากลุ่มวิชาชีพ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-slate-50/50 border-slate-200 focus-visible:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredProfessions.map((profession) => (
                <Card
                  key={profession.id}
                  className="bg-white border-slate-200 hover:border-primary/30 hover:shadow-md transition-all group"
                >
                  <CardHeader className="pb-3 border-b border-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Briefcase className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base font-bold text-slate-800">
                          {profession.name}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className="font-semibold text-[10px] text-slate-400 bg-slate-50 border-slate-200"
                      >
                        {profession.code}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-5">
                    <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5em] leading-relaxed">
                      {profession.description || 'ไม่มีคำอธิบาย'}
                    </p>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                        <CircleDollarSign className="h-3 w-3" /> อัตราเงินที่เกี่ยวข้อง
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {profession.allowedRates.length > 0 ? (
                          profession.allowedRates.map((rateCode) => (
                            <Badge
                              key={rateCode}
                              variant="secondary"
                              className="bg-white border border-slate-200 font-mono font-semibold text-emerald-600 text-xs shadow-sm"
                            >
                              {rateCode}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            ยังไม่มีอัตราที่เชื่อมโยง
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Rate Dialog */}
        <Dialog open={isAddRateDialogOpen} onOpenChange={setIsAddRateDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-[600px] p-0 overflow-hidden shadow-lg">
            <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <DialogTitle className="text-xl font-bold text-slate-800">
                เพิ่มอัตราเงินใหม่
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">
                กรอกข้อมูลอัตราเงิน พ.ต.ส. เข้าสู่ระบบฐานข้อมูล
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Left Accent Error Alert */}
              {dialogError && (
                <div className="relative overflow-hidden rounded-lg border border-destructive/20 bg-destructive/5 p-4 pl-5">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                  <div className="flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive font-medium leading-relaxed">
                      {dialogError}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="professionCode" className="text-sm font-semibold text-slate-700">
                    รหัสวิชาชีพ <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={newRate.professionCode}
                    onValueChange={(value) => setNewRate({ ...newRate, professionCode: value })}
                  >
                    <SelectTrigger
                      id="professionCode"
                      className="h-10 bg-white shadow-sm focus-visible:ring-primary/50"
                    >
                      <SelectValue placeholder="เลือกวิชาชีพ" />
                    </SelectTrigger>
                    <SelectContent>
                      {RATE_PROFESSION_CODES.map((code) => (
                        <SelectItem key={code} value={code}>
                          <span className="font-medium">{code}</span> -{' '}
                          {resolveProfessionLabel(code, code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupNo" className="text-sm font-semibold text-slate-700">
                    กลุ่ม (เลขกลุ่ม) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="groupNo"
                    type="number"
                    value={newRate.groupNo}
                    onChange={(e) => setNewRate({ ...newRate, groupNo: e.target.value })}
                    placeholder="เช่น 2"
                    className="h-10 shadow-sm focus-visible:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="itemNo" className="text-sm font-semibold text-slate-700">
                    ข้อ (เลขข้อ)
                  </Label>
                  <Input
                    id="itemNo"
                    value={newRate.itemNo}
                    onChange={(e) => setNewRate({ ...newRate, itemNo: e.target.value })}
                    placeholder="เช่น 2.1"
                    className="h-10 shadow-sm focus-visible:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subItemNo" className="text-sm font-semibold text-slate-700">
                    ข้อย่อย
                  </Label>
                  <Input
                    id="subItemNo"
                    value={newRate.subItemNo}
                    onChange={(e) => setNewRate({ ...newRate, subItemNo: e.target.value })}
                    placeholder="เช่น 2.1.1"
                    className="h-10 shadow-sm focus-visible:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-semibold text-slate-700">
                    จำนวนเงิน (บาท) <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                      ฿
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      value={newRate.amount || ''}
                      onChange={(e) =>
                        setNewRate({ ...newRate, amount: parseInt(e.target.value) || 0 })
                      }
                      placeholder="กรอจำนวน..."
                      className="h-10 pl-8 shadow-sm focus-visible:ring-primary/50 font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="isActive" className="text-sm font-semibold text-slate-700">
                    สถานะ
                  </Label>
                  <Select
                    value={newRate.isActive ? '1' : '0'}
                    onValueChange={(value) => setNewRate({ ...newRate, isActive: value === '1' })}
                  >
                    <SelectTrigger
                      id="isActive"
                      className="h-10 shadow-sm focus-visible:ring-primary/50"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" /> เปิดใช้งาน
                        </div>
                      </SelectItem>
                      <SelectItem value="0">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-slate-300" /> ปิดใช้งาน
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="conditionDesc" className="text-sm font-semibold text-slate-700">
                    รายละเอียดเงื่อนไข
                  </Label>
                  <Textarea
                    id="conditionDesc"
                    value={newRate.conditionDesc}
                    onChange={(e) => setNewRate({ ...newRate, conditionDesc: e.target.value })}
                    placeholder="อธิบายเงื่อนไขหรือคุณสมบัติของผู้มีสิทธิ์ได้รับอัตรานี้"
                    className="resize-none bg-white shadow-sm focus-visible:ring-primary/50"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detailedDesc" className="text-sm font-semibold text-slate-700">
                    รายละเอียดเพิ่มเติม
                  </Label>
                  <Textarea
                    id="detailedDesc"
                    value={newRate.detailedDesc}
                    onChange={(e) => setNewRate({ ...newRate, detailedDesc: e.target.value })}
                    placeholder="หมายเหตุ หรือรายละเอียดเพิ่มเติมอื่นๆ (ถ้ามี)"
                    className="resize-none bg-white shadow-sm focus-visible:ring-primary/50"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="outline"
                onClick={() => setIsAddRateDialogOpen(false)}
                className="border-slate-200"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleAddRate}
                disabled={isMutating}
                className="min-w-[120px] shadow-sm"
              >
                บันทึกอัตราเงิน
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Rate Dialog */}
        <Dialog open={isEditRateDialogOpen} onOpenChange={setIsEditRateDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-[600px] p-0 overflow-hidden shadow-lg">
            <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <DialogTitle className="text-xl font-bold text-slate-800">แก้ไขอัตราเงิน</DialogTitle>
              <DialogDescription className="text-sm font-medium text-slate-500">
                ปรับปรุงข้อมูลและเงื่อนไขของอัตราเงิน พ.ต.ส.
              </DialogDescription>
            </DialogHeader>
            {selectedRate && (
              <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {dialogError && (
                  <div className="relative overflow-hidden rounded-lg border border-destructive/20 bg-destructive/5 p-4 pl-5">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                    <div className="flex gap-2.5 items-start">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive font-medium leading-relaxed">
                        {dialogError}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-profession"
                      className="text-sm font-semibold text-slate-700"
                    >
                      วิชาชีพ <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedRate.professionCode}
                      onValueChange={(value) =>
                        setSelectedRate({ ...selectedRate, professionCode: value })
                      }
                    >
                      <SelectTrigger
                        id="edit-profession"
                        className="h-10 bg-white shadow-sm focus-visible:ring-primary/50"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RATE_PROFESSION_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            <span className="font-medium">{code}</span> -{' '}
                            {resolveProfessionLabel(code, code)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-group" className="text-sm font-semibold text-slate-700">
                      กลุ่ม (เลขกลุ่ม) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-group"
                      type="number"
                      value={selectedRate.groupNo}
                      onChange={(e) =>
                        setSelectedRate({
                          ...selectedRate,
                          groupNo: Number.parseInt(e.target.value) || 0,
                        })
                      }
                      className="h-10 shadow-sm focus-visible:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="edit-itemNo" className="text-sm font-semibold text-slate-700">
                      ข้อ (เลขข้อ)
                    </Label>
                    <Input
                      id="edit-itemNo"
                      value={selectedRate.itemNo ?? ''}
                      onChange={(e) => setSelectedRate({ ...selectedRate, itemNo: e.target.value })}
                      className="h-10 shadow-sm focus-visible:ring-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-subItemNo"
                      className="text-sm font-semibold text-slate-700"
                    >
                      ข้อย่อย
                    </Label>
                    <Input
                      id="edit-subItemNo"
                      value={selectedRate.subItemNo ?? ''}
                      onChange={(e) =>
                        setSelectedRate({ ...selectedRate, subItemNo: e.target.value })
                      }
                      className="h-10 shadow-sm focus-visible:ring-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount" className="text-sm font-semibold text-slate-700">
                      จำนวนเงิน (บาท) <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                        ฿
                      </span>
                      <Input
                        id="edit-amount"
                        type="number"
                        value={selectedRate.amount}
                        onChange={(e) =>
                          setSelectedRate({
                            ...selectedRate,
                            amount: parseInt(e.target.value) || 0,
                          })
                        }
                        className="h-10 pl-8 shadow-sm focus-visible:ring-primary/50 font-medium text-emerald-600"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-isActive" className="text-sm font-semibold text-slate-700">
                      สถานะ
                    </Label>
                    <Select
                      value={selectedRate.isActive ? '1' : '0'}
                      onValueChange={(value) =>
                        setSelectedRate({ ...selectedRate, isActive: value === '1' })
                      }
                    >
                      <SelectTrigger
                        id="edit-isActive"
                        className="h-10 shadow-sm focus-visible:ring-primary/50"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" /> ใช้งาน
                          </div>
                        </SelectItem>
                        <SelectItem value="0">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-slate-300" /> ปิดใช้งาน
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="edit-description"
                      className="text-sm font-semibold text-slate-700"
                    >
                      รายละเอียดเงื่อนไข
                    </Label>
                    <Textarea
                      id="edit-description"
                      value={selectedRate.description}
                      onChange={(e) =>
                        setSelectedRate({ ...selectedRate, description: e.target.value })
                      }
                      className="resize-none bg-white shadow-sm focus-visible:ring-primary/50"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-detailed" className="text-sm font-semibold text-slate-700">
                      รายละเอียดเพิ่มเติม
                    </Label>
                    <Textarea
                      id="edit-detailed"
                      value={selectedRate.requirements}
                      onChange={(e) =>
                        setSelectedRate({ ...selectedRate, requirements: e.target.value })
                      }
                      className="resize-none bg-white shadow-sm focus-visible:ring-primary/50"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="outline"
                onClick={() => setIsEditRateDialogOpen(false)}
                className="border-slate-200"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleEditRate}
                disabled={isMutating}
                className="min-w-[120px] shadow-sm"
              >
                บันทึกการเปลี่ยนแปลง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteRateDialogOpen} onOpenChange={setIsDeleteRateDialogOpen}>
          <DialogContent className="bg-white border-slate-200 sm:max-w-[425px] p-0 overflow-hidden shadow-lg">
            <DialogHeader className="px-6 py-5 border-b border-slate-100 bg-red-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-800">
                    ยืนยันการลบถาวร
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-slate-500 mt-1">
                    ระบบจะลบข้อมูลนี้ออกจากฐานข้อมูล
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                คุณต้องการลบอัตราเงิน{' '}
                <span className="font-bold text-slate-800">&quot;{selectedRate?.name}&quot;</span>{' '}
                แบบถาวรหรือไม่?
                <br />
                <br />
                <span className="text-destructive font-semibold text-xs bg-red-50 px-2 py-1 rounded">
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  และจะลบได้เฉพาะรายการที่ไม่มีผู้มีสิทธิ์อ้างอิงเท่านั้น
                </span>
              </p>

              {dialogError && (
                <div className="mt-4 relative overflow-hidden rounded-lg border border-destructive/20 bg-destructive/5 p-3 pl-4">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                  <div className="flex gap-2.5 items-start">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive font-medium leading-relaxed">
                      {dialogError}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="outline"
                onClick={() => setIsDeleteRateDialogOpen(false)}
                className="border-slate-200"
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRate}
                disabled={isMutating}
                className="shadow-sm"
              >
                ยืนยันการลบ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
