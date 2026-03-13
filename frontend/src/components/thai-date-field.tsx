'use client';

import * as React from 'react';
import { ConfigProvider, DatePicker } from 'antd';
import antdThaiLocale from 'antd/locale/th_TH';
import datePickerThaiLocale from 'antd/es/date-picker/locale/th_TH';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import 'dayjs/locale/th';

dayjs.extend(customParseFormat);
dayjs.extend(buddhistEra);
dayjs.locale('th');

const DISPLAY_FORMAT = 'DD-MM-BBBB';
const STORAGE_FORMAT = 'YYYY-MM-DD';

function parseDate(value?: string | null): Dayjs | null {
  if (!value) return null;
  const iso = String(value).split('T')[0].split(' ')[0];
  const parsed = dayjs(iso, STORAGE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function buildThaiLocale() {
  return {
    ...datePickerThaiLocale,
    locale: 'th',
    lang: {
      ...datePickerThaiLocale.lang,
      locale: 'th',
      fieldDateFormat: DISPLAY_FORMAT,
      fieldDateTimeFormat: DISPLAY_FORMAT,
      yearFormat: 'BBBB',
      cellYearFormat: 'BBBB',
    },
  };
}

const thaiDateLocale = buildThaiLocale();
const YEAR_STORAGE_FORMAT = 'YYYY';
const YEAR_DISPLAY_FORMAT = 'BBBB';

export function ThaiDateField({
  id,
  value,
  onChange,
  name,
  disabled = false,
  min,
  max,
  placeholder = 'เลือกวันที่',
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const minDate = React.useMemo(() => parseDate(min), [min]);
  const maxDate = React.useMemo(() => parseDate(max), [max]);
  const pickerValue = React.useMemo(() => parseDate(value), [value]);

  return (
    <ConfigProvider
      locale={antdThaiLocale}
      theme={{
        token: {
          fontFamily: 'var(--font-sarabun)',
          colorPrimary: 'hsl(var(--primary))',
          colorBorder: 'hsl(var(--border))',
          colorText: 'hsl(var(--foreground))',
          colorTextPlaceholder: 'hsl(var(--muted-foreground))',
          colorBgContainer: 'hsl(var(--background))',
          colorFillSecondary: 'hsl(var(--muted))',
          borderRadius: 10,
        },
      }}
    >
      <div className="space-y-2">
        <DatePicker
          id={id}
          value={pickerValue}
          locale={thaiDateLocale}
          disabled={disabled}
          allowClear
          inputReadOnly
          format={DISPLAY_FORMAT}
          placeholder={placeholder}
          className={className ?? 'h-10 w-full'}
          classNames={{ popup: { root: 'thai-date-field-popup' } }}
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          disabledDate={(current) => {
            if (!current) return false;
            if (minDate && current.isBefore(minDate, 'day')) return true;
            if (maxDate && current.isAfter(maxDate, 'day')) return true;
            return false;
          }}
          onChange={(nextDate) => onChange(nextDate ? nextDate.format(STORAGE_FORMAT) : '')}
        />
        {name ? <input type="hidden" name={name} value={value} /> : null}
      </div>
    </ConfigProvider>
  );
}

export function ThaiYearPicker({
  value,
  onChange,
  disabled = false,
  minYear,
  maxYear,
  placeholder = 'เลือกปี พ.ศ.',
  className,
}: {
  value: number;
  onChange: (year: number) => void;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  className?: string;
}) {
  const pickerValue = React.useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    const adYear = value > 2400 ? value - 543 : value;
    return dayjs(`${adYear}`, YEAR_STORAGE_FORMAT, true);
  }, [value]);

  const minDate = React.useMemo(() => {
    if (!Number.isFinite(minYear ?? NaN)) return null;
    const adYear = Number(minYear) > 2400 ? Number(minYear) - 543 : Number(minYear);
    return dayjs(`${adYear}`, YEAR_STORAGE_FORMAT, true);
  }, [minYear]);

  const maxDate = React.useMemo(() => {
    if (!Number.isFinite(maxYear ?? NaN)) return null;
    const adYear = Number(maxYear) > 2400 ? Number(maxYear) - 543 : Number(maxYear);
    return dayjs(`${adYear}`, YEAR_STORAGE_FORMAT, true);
  }, [maxYear]);

  return (
    <ConfigProvider
      locale={antdThaiLocale}
      theme={{
        token: {
          fontFamily: 'var(--font-sarabun)',
          colorPrimary: 'hsl(var(--primary))',
          colorBorder: 'hsl(var(--border))',
          colorText: 'hsl(var(--foreground))',
          colorTextPlaceholder: 'hsl(var(--muted-foreground))',
          colorBgContainer: 'hsl(var(--background))',
          colorFillSecondary: 'hsl(var(--muted))',
          borderRadius: 10,
        },
      }}
    >
      <DatePicker
        value={pickerValue}
        locale={thaiDateLocale}
        picker="year"
        disabled={disabled}
        allowClear={false}
        inputReadOnly
        format={YEAR_DISPLAY_FORMAT}
        placeholder={placeholder}
        className={className ?? 'h-10 w-full'}
        classNames={{ popup: { root: 'thai-date-field-popup' } }}
        getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
        disabledDate={(current) => {
          if (!current) return false;
          if (minDate && current.isBefore(minDate, 'year')) return true;
          if (maxDate && current.isAfter(maxDate, 'year')) return true;
          return false;
        }}
        onChange={(nextDate) => {
          if (!nextDate) return;
          onChange(nextDate.year() + 543);
        }}
      />
    </ConfigProvider>
  );
}

export function ThaiMonthYearPicker({
  value,
  onChange,
  disabled = false,
  minYear,
  maxYear,
  placeholder = 'เลือกเดือน/ปี พ.ศ.',
  className,
}: {
  value: { month: string; year: number };
  onChange: (value: { month: string; year: number }) => void;
  disabled?: boolean;
  minYear?: number;
  maxYear?: number;
  placeholder?: string;
  className?: string;
}) {
  const pickerValue = React.useMemo(() => {
    const month = Number(value.month);
    if (!Number.isFinite(month) || month < 1 || month > 12) return null;
    if (!Number.isFinite(value.year) || value.year <= 0) return null;
    const adYear = value.year > 2400 ? value.year - 543 : value.year;
    return dayjs(`${adYear}-${String(month).padStart(2, '0')}-01`, STORAGE_FORMAT, true);
  }, [value.month, value.year]);

  const minDate = React.useMemo(() => {
    if (!Number.isFinite(minYear ?? NaN)) return null;
    const adYear = Number(minYear) > 2400 ? Number(minYear) - 543 : Number(minYear);
    return dayjs(`${adYear}-01-01`, STORAGE_FORMAT, true);
  }, [minYear]);

  const maxDate = React.useMemo(() => {
    if (!Number.isFinite(maxYear ?? NaN)) return null;
    const adYear = Number(maxYear) > 2400 ? Number(maxYear) - 543 : Number(maxYear);
    return dayjs(`${adYear}-12-31`, STORAGE_FORMAT, true);
  }, [maxYear]);

  return (
    <ConfigProvider
      locale={antdThaiLocale}
      theme={{
        token: {
          fontFamily: 'var(--font-sarabun)',
          colorPrimary: 'hsl(var(--primary))',
          colorBorder: 'hsl(var(--border))',
          colorText: 'hsl(var(--foreground))',
          colorTextPlaceholder: 'hsl(var(--muted-foreground))',
          colorBgContainer: 'hsl(var(--background))',
          colorFillSecondary: 'hsl(var(--muted))',
          borderRadius: 10,
        },
      }}
    >
      <DatePicker
        value={pickerValue}
        locale={thaiDateLocale}
        picker="month"
        disabled={disabled}
        allowClear={false}
        inputReadOnly
        format="MMMM BBBB"
        placeholder={placeholder}
        className={className ?? 'h-10 w-full'}
        classNames={{ popup: { root: 'thai-date-field-popup' } }}
        getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
        disabledDate={(current) => {
          if (!current) return false;
          if (minDate && current.isBefore(minDate, 'month')) return true;
          if (maxDate && current.isAfter(maxDate, 'month')) return true;
          return false;
        }}
        onChange={(nextDate) => {
          if (!nextDate) return;
          onChange({
            month: nextDate.format('MM'),
            year: nextDate.year() + 543,
          });
        }}
      />
    </ConfigProvider>
  );
}
