import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  X
} from 'lucide-react';
import { registrationService } from '../../services/registrationService';
import { eventService, extractErrorMessage } from '../../services/eventService';
import { formatAcademicYear } from '../../utils/registrationUtils';
import {
  downloadAttendeeCsv,
  downloadAttendeeExcel,
  downloadAttendeePdf,
  fetchAllAttendeePages,
  selectAttendeesForExport
} from '../../utils/attendeeExport';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  LoadingState,
  Pagination,
  Select
} from '../../components/ui';

const PAGE_SIZE = 25;
const MAX_BULK_SIZE = 100;
const ATTENDANCE_OPTIONS = [
  { value: 'not_marked', label: 'Not marked' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' }
];

const columns = [
  { id: 'registrationId', label: 'Registration ID' },
  { id: 'name', label: 'Participant' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'organization', label: 'Department / organization' },
  { id: 'academicYear', label: 'Year' },
  { id: 'registeredAt', label: 'Registered' },
  { id: 'status', label: 'Registration status' },
  { id: 'attendanceStatus', label: 'Attendance' },
  { id: 'actions', label: 'Actions' }
];

const getRegistrationId = (registration) => String(registration.id || registration._id || '');

const formatDate = (value, includeTime = false) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {})
  }).format(date);
};

const lifecycleLabel = (event) => event?.lifecycleStatus || event?.status || 'Unknown';

const registrationStatusVariant = (status) => status === 'registered' ? 'success' : 'neutral';

const attendanceVariant = (status) => {
  if (status === 'present') return 'success';
  if (status === 'absent') return 'error';
  return 'neutral';
};

const getExportFilename = (event, format) => {
  const slug = String(event?.title || 'Event')
    .replace(/[^a-zA-Z0-9]+/g, '') || 'Event';
  return `EventFlow_${slug}_Attendees.${format}`;
};

export default function OrganizerEventAttendeesPage() {
  const { id: eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [summary, setSummary] = useState({
    totalAll: 0,
    activeCount: 0,
    cancelledCount: 0,
    presentCount: 0,
    absentCount: 0,
    notMarkedCount: 0
  });
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    attendanceStatus: '',
    department: '',
    dateFrom: '',
    dateTo: ''
  });
  const [sort, setSort] = useState({ sortBy: 'registeredAt', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.id));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAttendanceStatus, setBulkAttendanceStatus] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventLoading, setEventLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [exportingFormat, setExportingFormat] = useState('');
  const exporting = Boolean(exportingFormat);
  const [error, setError] = useState('');
  const [eventError, setEventError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const exportingRef = useRef(false);

  const queryFilters = useMemo(() => ({
    ...filters,
    ...sort
  }), [filters, sort]);

  const closeExportMenu = useCallback((restoreFocus = false) => {
    const menu = exportMenuRef.current;
    if (!menu?.open) return;
    menu.open = false;
    setExportMenuOpen(false);
    if (restoreFocus) menu.querySelector('summary')?.focus();
  }, []);

  useEffect(() => {
    if (!exportMenuOpen) return undefined;

    const handleOutsidePointerDown = (event) => {
      if (!exportMenuRef.current?.contains(event.target)) closeExportMenu();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeExportMenu(true);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeExportMenu, exportMenuOpen]);

  const fetchEvent = useCallback(async () => {
    setEventLoading(true);
    setEventError('');
    try {
      const result = await eventService.getEventById(eventId);
      setEvent(result);
    } catch (requestError) {
      setEventError(extractErrorMessage(requestError, 'Event details could not be loaded.'));
    } finally {
      setEventLoading(false);
    }
  }, [eventId]);

  const fetchAttendees = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      const result = await registrationService.getEventAttendees(eventId, {
        ...queryFilters,
        page: targetPage,
        limit: PAGE_SIZE
      });
      setAttendees(result.data || []);
      setSummary((current) => ({ ...current, ...(result.summary || {}) }));
      setPagination(result.pagination || {
        page: targetPage,
        limit: PAGE_SIZE,
        total: result.count || 0,
        pages: 1
      });
    } catch (requestError) {
      const message = extractErrorMessage(requestError, 'Attendee records could not be loaded.');
      setError(message);
      if (requestError.response?.status === 403) {
        setError('Access denied. Only this event’s organizer and administrators can manage its attendees.');
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, page, queryFilters]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAttendees(page), filters.search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [fetchAttendees, filters.search, page]);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelectedIds(new Set());
    setActionMessage('');
  };

  const toggleSort = (sortBy) => {
    setSort((current) => ({
      sortBy,
      sortOrder: current.sortBy === sortBy && current.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  const toggleRowSelection = (registrationId) => {
    setSelectedIds((current) => {
      const updated = new Set(current);
      if (updated.has(registrationId)) updated.delete(registrationId);
      else updated.add(registrationId);
      return updated;
    });
  };

  const selectCurrentPage = (checked) => {
    setSelectedIds((current) => {
      const updated = new Set(current);
      attendees.forEach((registration) => {
        const registrationId = getRegistrationId(registration);
        if (checked) updated.add(registrationId);
        else updated.delete(registrationId);
      });
      return updated;
    });
  };

  const selectAllFiltered = async () => {
    setError('');
    try {
      const result = await registrationService.getEventAttendeeIds(eventId, queryFilters);
      setSelectedIds(new Set((result.data || []).map(String)));
      setActionMessage(`Selected all ${result.data?.length || 0} matching registrations.`);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not select matching registrations.'));
    }
  };

  const fetchAllFiltered = () => fetchAllAttendeePages(
    (targetPage, limit, params) => registrationService.getEventAttendees(eventId, {
      ...params,
      page: targetPage,
      limit
    }),
    queryFilters
  );

  const exportAttendees = async (format) => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExportingFormat(format);
    setError('');
    try {
      const allAttendees = await fetchAllFiltered();
      const rows = selectAttendeesForExport(allAttendees, selectedIds);
      if (selectedIds.size > 0 && rows.length === 0) {
        throw new Error('Your selected attendees no longer match the current filters. Update your selection and retry.');
      }
      const filename = getExportFilename(event, format);
      if (format === 'pdf') await downloadAttendeePdf(event, rows, filename);
      else if (format === 'xlsx') await downloadAttendeeExcel(event, rows, filename);
      else downloadAttendeeCsv(rows, filename);
      setActionMessage(`${format.toUpperCase()} export generated for ${rows.length} attendee ${rows.length === 1 ? 'record' : 'records'}.`);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, `The ${format.toUpperCase()} export could not be prepared.`));
    } finally {
      exportingRef.current = false;
      setExportingFormat('');
    }
  };

  const updateAttendance = async (updates) => {
    setSavingAttendance(true);
    setError('');
    setActionMessage('');
    try {
      let updatedCount = 0;
      for (let index = 0; index < updates.length; index += MAX_BULK_SIZE) {
        const batch = updates.slice(index, index + MAX_BULK_SIZE);
        const response = await registrationService.updateEventAttendance(eventId, batch);
        updatedCount += response.data?.updatedCount || 0;
      }
      setSelectedIds(new Set());
      setBulkAttendanceStatus('');
      setActionMessage(`${updatedCount} attendance ${updatedCount === 1 ? 'record was' : 'records were'} updated.`);
      await fetchAttendees(page);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Attendance could not be updated.'));
      await fetchAttendees(page);
    } finally {
      setSavingAttendance(false);
    }
  };

  const updateOneAttendance = async (registration, attendanceStatus) => {
    await updateAttendance([{
      registrationId: getRegistrationId(registration),
      attendanceStatus
    }]);
  };

  const updateSelectedAttendance = async () => {
    if (!bulkAttendanceStatus || selectedIds.size === 0) return;
    try {
      const allFiltered = await fetchAllFiltered();
      const updates = allFiltered
        .filter((registration) =>
          selectedIds.has(getRegistrationId(registration)) && registration.status === 'registered')
        .map((registration) => ({
          registrationId: getRegistrationId(registration),
          attendanceStatus: bulkAttendanceStatus
        }));
      if (updates.length === 0) {
        setError('Attendance can only be updated for active registrations.');
        return;
      }
      await updateAttendance(updates);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not load selected attendees for attendance update.'));
    }
  };

  const allCurrentSelected = attendees.length > 0 &&
    attendees.every((registration) => selectedIds.has(getRegistrationId(registration)));

  const displayedColumns = columns.filter((column) => visibleColumns.includes(column.id));

  const registrationStats = [
    { label: 'Total registrations', value: summary.totalAll, icon: Users, tone: 'text-[#4C1D95] bg-purple-50' },
    { label: 'Active', value: summary.activeCount, icon: Check, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Cancelled', value: summary.cancelledCount, icon: X, tone: 'text-slate-600 bg-slate-100' },
    { label: 'Present', value: summary.presentCount, icon: Check, tone: 'text-[#7C3AED] bg-violet-50' },
    { label: 'Absent', value: summary.absentCount, icon: X, tone: 'text-rose-700 bg-rose-50' },
    { label: 'Not marked', value: summary.notMarkedCount, icon: Clock3, tone: 'text-amber-700 bg-amber-50' }
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-6 pb-8">
      <Link
        to="/organizer/events"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg text-sm font-semibold text-[#6D28D9] hover:text-[#4C1D95] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to My Events
      </Link>

      <section className="relative z-20 rounded-[1.75rem] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#EC4899] p-5 text-white shadow-lg shadow-violet-950/10 sm:p-7 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
          <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-100">Attendee manager</p>
            <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
              {eventLoading ? 'Loading event…' : event?.title || 'Event attendees'}
            </h1>
            <div className="mt-4 flex min-w-0 flex-wrap gap-x-5 gap-y-2 text-sm text-violet-100">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />
                {formatDate(event?.startDateTime, true)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {typeof event?.venue === 'object' && event.venue
                    ? event.venue.name || 'Venue'
                    : 'Venue not assigned'}
                </span>
              </span>
              <Badge className="border-white/25 bg-white/10 text-white">{lifecycleLabel(event)}</Badge>
              {event?.capacity && (
                <span className="inline-flex items-center gap-2">
                  <Users aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Capacity {event.capacity}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <details
              ref={exportMenuRef}
              className="relative"
              onToggle={(event) => setExportMenuOpen(event.currentTarget.open)}
            >
              <summary
                aria-disabled={exporting}
                aria-busy={exporting}
                onClick={(event) => { if (exporting) event.preventDefault(); }}
                className={`flex min-h-11 list-none items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  exporting ? 'cursor-wait opacity-80' : 'cursor-pointer hover:bg-white/15'
                }`}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {exporting ? `Preparing ${exportingFormat.toUpperCase()}…` : 'Export'}
                {exporting
                  ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
              </summary>
              <div className="absolute right-0 z-50 mt-2 w-60 max-w-[calc(100vw-2.5rem)] rounded-xl border border-border bg-surface p-2 text-text-primary shadow-xl">
                <button type="button" disabled={exporting} onClick={() => { closeExportMenu(true); exportAttendees('pdf'); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60">
                  {exportingFormat === 'pdf'
                    ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    : <FileText aria-hidden="true" className="h-4 w-4 text-rose-700" />}
                  Download PDF
                </button>
                <button type="button" disabled={exporting} onClick={() => { closeExportMenu(true); exportAttendees('xlsx'); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60">
                  {exportingFormat === 'xlsx'
                    ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    : <FileSpreadsheet aria-hidden="true" className="h-4 w-4 text-emerald-700" />}
                  Download Excel (.xlsx)
                </button>
                <button type="button" disabled={exporting} onClick={() => { closeExportMenu(true); exportAttendees('csv'); }} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60">
                  {exportingFormat === 'csv'
                    ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                    : <FileSpreadsheet aria-hidden="true" className="h-4 w-4 text-violet-700" />}
                  Download CSV
                </button>
              </div>
            </details>
          </div>
        </div>
      </section>

      {eventError && <Alert variant="error">{eventError}</Alert>}
      {error && (
        <Alert variant="error" title="Could not complete the request">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => fetchAttendees(page)}>
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Alert>
      )}
      {actionMessage && (
        <Alert variant="success" onDismiss={() => setActionMessage('')}>{actionMessage}</Alert>
      )}

      <section aria-label="Registration and attendance summary" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {registrationStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="min-w-0 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-text-muted">{stat.label}</span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-text-primary">{stat.value}</p>
            </Card>
          );
        })}
      </section>

      <Card className="min-w-0">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Attendee register</CardTitle>
              <p className="mt-1 text-sm text-text-muted">Search, filter, select and update attendance for this event.</p>
            </div>
            <Button variant="outline" size="sm" loading={loading || exporting} onClick={() => fetchAttendees(page)}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="sm:col-span-2 xl:col-span-2">
              <span className="sr-only">Search participants by name or email</span>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  type="search"
                  value={filters.search}
                  onChange={(eventChange) => setFilter('search', eventChange.target.value)}
                  placeholder="Search name or email"
                  className="pl-9"
                  aria-label="Search participants by name or email"
                />
              </div>
            </label>
            <label>
              <span className="sr-only">Registration status</span>
              <Select value={filters.status} onChange={(eventChange) => setFilter('status', eventChange.target.value)} aria-label="Filter registration status">
                <option value="">All registration statuses</option>
                <option value="registered">Registered</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </label>
            <label>
              <span className="sr-only">Attendance status</span>
              <Select value={filters.attendanceStatus} onChange={(eventChange) => setFilter('attendanceStatus', eventChange.target.value)} aria-label="Filter attendance status">
                <option value="">All attendance statuses</option>
                {ATTENDANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
            <label>
              <span className="sr-only">Filter by department or organization</span>
              <Input value={filters.department} onChange={(eventChange) => setFilter('department', eventChange.target.value)} placeholder="Department" aria-label="Filter by department or organization" />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-6 xl:grid-cols-[1fr_1fr_auto_auto]">
              <label>
                <span className="sr-only">Registration date from</span>
                <Input type="date" value={filters.dateFrom} onChange={(eventChange) => setFilter('dateFrom', eventChange.target.value)} aria-label="Registration date from" />
              </label>
              <label>
                <span className="sr-only">Registration date to</span>
                <Input type="date" value={filters.dateTo} onChange={(eventChange) => setFilter('dateTo', eventChange.target.value)} aria-label="Registration date to" />
              </label>
              <Button variant="ghost" size="sm" onClick={() => { setFilters({ search: '', status: '', attendanceStatus: '', department: '', dateFrom: '', dateTo: '' }); setPage(1); setSelectedIds(new Set()); }}>
                <Filter aria-hidden="true" className="h-4 w-4" /> Clear filters
              </Button>
              <details className="relative">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary hover:bg-background">
                  <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Columns
                </summary>
                <div className="absolute right-0 z-20 mt-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-border bg-surface p-3 shadow-xl">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Visible columns</p>
                  {columns.filter((column) => column.id !== 'actions').map((column) => (
                    <label key={column.id} className="flex min-h-9 items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(column.id)}
                        onChange={(eventChange) => setVisibleColumns((current) => eventChange.target.checked
                          ? [...current, column.id]
                          : current.filter((id) => id !== column.id))}
                        className="h-4 w-4 accent-violet-700"
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <Button size="sm" variant="ghost" onClick={selectAllFiltered} disabled={loading}>
                Select all {pagination.total} filtered
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                Clear selection
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={bulkAttendanceStatus}
                onChange={(eventChange) => setBulkAttendanceStatus(eventChange.target.value)}
                aria-label="Choose bulk attendance status"
                className="w-auto min-w-40"
              >
                <option value="">Set attendance…</option>
                {ATTENDANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
              <Button
                size="sm"
                disabled={!bulkAttendanceStatus || selectedIds.size === 0}
                loading={savingAttendance}
                onClick={updateSelectedAttendance}
              >
                Apply
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingState label="Loading attendee records…" className="py-12" />
          ) : attendees.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filters.search || filters.status || filters.attendanceStatus || filters.department
                ? 'No matching attendees'
                : 'No attendees yet'}
              description={filters.search || filters.status || filters.attendanceStatus || filters.department
                ? 'Try adjusting or clearing the filters.'
                : 'Participant registrations for this event will appear here.'}
            />
          ) : (
            <>
              <div className="max-w-full overflow-auto rounded-xl border border-border">
                <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-background text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="sticky left-0 z-20 border-b border-border bg-background px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all attendees on this page"
                          checked={allCurrentSelected}
                          onChange={(eventChange) => selectCurrentPage(eventChange.target.checked)}
                          className="h-4 w-4 accent-violet-700"
                        />
                      </th>
                      {displayedColumns.map((column) => (
                        <th key={column.id} scope="col" className="whitespace-nowrap border-b border-border px-3 py-3">
                          {['registrationId', 'phone', 'actions'].includes(column.id)
                            ? column.label
                            : (
                              <button type="button" onClick={() => toggleSort(column.id === 'name' ? 'name' : column.id === 'email' ? 'email' : column.id === 'organization' ? 'organization' : column.id === 'registeredAt' ? 'registeredAt' : column.id === 'status' ? 'status' : column.id === 'attendanceStatus' ? 'attendanceStatus' : 'academicYear')} className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                                {column.label}
                                {sort.sortBy === column.id && (sort.sortOrder === 'asc' ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : <ArrowDown aria-hidden="true" className="h-3 w-3" />)}
                              </button>
                            )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {attendees.map((registration) => {
                      const registrationId = getRegistrationId(registration);
                      const participant = registration.participant || {};
                      const attendanceStatus = registration.attendanceStatus || 'not_marked';
                      return (
                        <tr key={registrationId} className="group bg-surface transition-colors hover:bg-violet-50/40">
                          <td className="sticky left-0 z-[1] border-b border-border bg-inherit px-3 py-3">
                            <input
                              type="checkbox"
                              aria-label={`Select ${participant.name || 'attendee'}`}
                              checked={selectedIds.has(registrationId)}
                              onChange={() => toggleRowSelection(registrationId)}
                              className="h-4 w-4 accent-violet-700"
                            />
                          </td>
                          {displayedColumns.map((column) => {
                            if (column.id === 'registrationId') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3 font-mono text-xs text-text-muted">{registrationId.slice(-8).toUpperCase()}</td>
                            );
                            if (column.id === 'name') return (
                              <td key={column.id} className="min-w-48 px-3 py-3">
                                <span className="block max-w-56 truncate font-semibold text-text-primary">{participant.name || 'Anonymous attendee'}</span>
                                <span className="mt-0.5 block text-xs text-text-muted">{participant.role || 'Participant'}</span>
                              </td>
                            );
                            if (column.id === 'email') return (
                              <td key={column.id} className="max-w-60 px-3 py-3">
                                <a href={`mailto:${participant.email || ''}`} className="inline-flex max-w-full items-center gap-1.5 truncate text-[#6D28D9] hover:underline">
                                  <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                  {participant.email || '—'}
                                </a>
                              </td>
                            );
                            if (column.id === 'phone') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3 text-text-secondary">{participant.phone || '—'}</td>
                            );
                            if (column.id === 'organization') return (
                              <td key={column.id} className="max-w-48 truncate px-3 py-3 text-text-secondary">{participant.organization || '—'}</td>
                            );
                            if (column.id === 'academicYear') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3 text-text-secondary">{formatAcademicYear(registration.academicYear)}</td>
                            );
                            if (column.id === 'registeredAt') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3 text-text-secondary">{formatDate(registration.registeredAt || registration.createdAt, true)}</td>
                            );
                            if (column.id === 'status') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3">
                                <Badge variant={registrationStatusVariant(registration.status)}>{registration.status || 'Unknown'}</Badge>
                              </td>
                            );
                            if (column.id === 'attendanceStatus') return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant={attendanceVariant(attendanceStatus)}>{attendanceStatus.replace('_', ' ')}</Badge>
                                  {registration.status === 'registered' && (
                                    <Select
                                      aria-label={`Attendance for ${participant.name || 'attendee'}`}
                                      value={attendanceStatus}
                                      disabled={savingAttendance}
                                      onChange={(eventChange) => updateOneAttendance(registration, eventChange.target.value)}
                                      className="min-h-8 w-auto min-w-32 py-1 text-xs"
                                    >
                                      {ATTENDANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                    </Select>
                                  )}
                                </div>
                              </td>
                            );
                            return (
                              <td key={column.id} className="whitespace-nowrap px-3 py-3">
                                <Button size="sm" variant="ghost" onClick={() => setSelectedRegistration(registration)} aria-label={`View details for ${participant.name || 'attendee'}`}>
                                  <Eye aria-hidden="true" className="h-4 w-4" /> Details
                                </Button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={pagination.page} totalPages={pagination.pages} onPageChange={setPage} className="mt-4" label="Attendee pages" />
              <p className="mt-3 text-xs text-text-muted" aria-live="polite">
                Showing {attendees.length} of {pagination.total} matching registrations.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {selectedRegistration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRegistration(null); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setSelectedRegistration(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="registration-details-title" className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Registration details</p>
                <h2 id="registration-details-title" className="mt-1 break-words text-xl font-bold text-text-primary">
                  {selectedRegistration.participant?.name || 'Attendee'}
                </h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close registration details" onClick={() => setSelectedRegistration(null)}>
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-text-muted">Email</dt><dd className="mt-1 break-all font-medium text-text-primary">{selectedRegistration.participant?.email || '—'}</dd></div>
              <div><dt className="text-xs text-text-muted">Phone</dt><dd className="mt-1 font-medium text-text-primary">{selectedRegistration.participant?.phone || '—'}</dd></div>
              <div><dt className="text-xs text-text-muted">Department / organization</dt><dd className="mt-1 font-medium text-text-primary">{selectedRegistration.participant?.organization || '—'}</dd></div>
              <div><dt className="text-xs text-text-muted">Academic year</dt><dd className="mt-1 font-medium text-text-primary">{formatAcademicYear(selectedRegistration.academicYear)}</dd></div>
              <div><dt className="text-xs text-text-muted">Registration ID</dt><dd className="mt-1 break-all font-mono text-xs text-text-primary">{getRegistrationId(selectedRegistration)}</dd></div>
              <div><dt className="text-xs text-text-muted">Registered</dt><dd className="mt-1 font-medium text-text-primary">{formatDate(selectedRegistration.registeredAt || selectedRegistration.createdAt, true)}</dd></div>
              <div><dt className="text-xs text-text-muted">Registration status</dt><dd className="mt-1"><Badge variant={registrationStatusVariant(selectedRegistration.status)}>{selectedRegistration.status}</Badge></dd></div>
              <div><dt className="text-xs text-text-muted">Attendance</dt><dd className="mt-1"><Badge variant={attendanceVariant(selectedRegistration.attendanceStatus)}>{(selectedRegistration.attendanceStatus || 'not_marked').replace('_', ' ')}</Badge></dd></div>
            </dl>
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedRegistration(null)}>Close</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
