const CSV_COLUMNS = [
  ['registrationId', 'Registration ID'],
  ['name', 'Participant Name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['organization', 'Department / Organization'],
  ['academicYear', 'Academic Year'],
  ['registeredAt', 'Registration Date'],
  ['status', 'Registration Status'],
  ['attendanceStatus', 'Attendance Status']
];

const EXCEL_COLUMNS = [
  ['registrationId', 'Registration ID', 24],
  ['name', 'Participant Name', 30],
  ['email', 'Email', 36],
  ['phone', 'Phone', 20],
  ['organization', 'Department', 28],
  ['registeredAt', 'Registration Date', 22],
  ['status', 'Registration Status', 22],
  ['attendanceStatus', 'Attendance Status', 20]
];

const safeString = (value) => value === null || value === undefined ? '' : String(value);

const protectSpreadsheetFormula = (value) => {
  const text = safeString(value);
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
};

const escapeCsvCell = (value) => {
  const safeValue = protectSpreadsheetFormula(value);
  return `"${safeValue.replace(/"/g, '""')}"`;
};

const getRegistrationId = (registration) => registration?.id || registration?._id || '';

const getParticipantValue = (registration, key) =>
  registration?.participant?.[key] ?? registration?.[key] ?? '';

const getRegistrationDate = (registration) => registration?.registeredAt || registration?.createdAt || '';

const validDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = validDate(value);
  if (!date) return 'Not provided';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatRegistrationDate = (value) => {
  const date = validDate(value);
  return date ? date.toLocaleString() : '';
};

const breakLongPdfTokens = (value) =>
  safeString(value).replace(/\S{24,}/g, (token) => token.match(/.{1,24}/g).join('\n'));

const eventText = (value, fallback = 'Not provided') => {
  if (typeof value === 'string') return value || fallback;
  if (!value || typeof value !== 'object') return fallback;
  return value.name || value.title || fallback;
};

const getVenue = (event) => {
  const venue = event?.venue;
  if (typeof venue !== 'object' || !venue) return eventText(venue);
  return [venue.name, venue.location].filter(Boolean).join(' — ') || 'Not provided';
};

const getOrganizer = (event) => eventText(event?.organizer);

const normalizeAttendee = (registration) => ({
  registrationId: safeString(getRegistrationId(registration)),
  name: safeString(getParticipantValue(registration, 'name')),
  email: safeString(getParticipantValue(registration, 'email')),
  phone: safeString(getParticipantValue(registration, 'phone')),
  organization: safeString(getParticipantValue(registration, 'organization')),
  academicYear: safeString(registration?.academicYear),
  registeredAt: getRegistrationDate(registration),
  status: safeString(registration?.status),
  attendanceStatus: safeString(registration?.attendanceStatus || 'not_marked')
});

export const attendeeRowsToCsv = (attendees) => {
  const rows = [
    CSV_COLUMNS.map(([, label]) => escapeCsvCell(label)).join(','),
    ...(Array.isArray(attendees) ? attendees : []).map((registration) => {
      const values = normalizeAttendee(registration);
      return CSV_COLUMNS.map(([key]) => escapeCsvCell(values[key])).join(',');
    })
  ];
  return `\uFEFF${rows.join('\r\n')}`;
};

export const selectAttendeesForExport = (attendees, selectedIds) => {
  const rows = Array.isArray(attendees) ? attendees : [];
  if (!selectedIds || selectedIds.size === 0) return rows;
  return rows.filter((registration) => selectedIds.has(String(getRegistrationId(registration))));
};

export const fetchAllAttendeePages = async (fetchPage, filters = {}) => {
  const firstPage = await fetchPage(1, 100, filters);
  const pages = Math.max(1, Number(firstPage?.pagination?.pages) || 1);
  const attendees = [...(Array.isArray(firstPage?.data) ? firstPage.data : [])];
  for (let page = 2; page <= pages; page += 1) {
    const response = await fetchPage(page, 100, filters);
    if (Array.isArray(response?.data)) attendees.push(...response.data);
  }
  return attendees;
};

export const buildAttendeeExportData = (event, attendees, generatedAt = new Date()) => {
  const rows = (Array.isArray(attendees) ? attendees : []).map(normalizeAttendee);
  const activeRows = rows.filter((row) => row.status === 'registered');
  const presentCount = activeRows.filter((row) => row.attendanceStatus === 'present').length;
  const absentCount = activeRows.filter((row) => row.attendanceStatus === 'absent').length;
  const notMarkedCount = activeRows.filter((row) =>
    !row.attendanceStatus || row.attendanceStatus === 'not_marked').length;
  const organizer = getOrganizer(event);
  const venue = getVenue(event);
  const reportDate = formatDateTime(generatedAt);

  return {
    title: 'EVENTFLOW — ATTENDEE REGISTER',
    event: {
      name: eventText(event?.title, 'Event details unavailable'),
      dateTime: event?.startDateTime
        ? `${formatDateTime(event.startDateTime)}${event.endDateTime ? ` – ${formatDateTime(event.endDateTime)}` : ''}`
        : 'Not provided',
      venue,
      organizer,
      status: eventText(event?.lifecycleStatus || event?.status),
      reportDate
    },
    summary: {
      totalRegistrations: rows.length,
      activeRegistrations: activeRows.length,
      cancelledRegistrations: rows.filter((row) => row.status === 'cancelled').length,
      present: presentCount,
      absent: absentCount,
      notMarked: notMarkedCount,
      attendancePercentage: activeRows.length ? presentCount / activeRows.length : 0
    },
    rows
  };
};

export const createAttendeePdf = async (event, attendees, generatedAt = new Date()) => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);
  const report = buildAttendeeExportData(event, attendees, generatedAt);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(76, 29, 149);
  doc.text(report.title, margin, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const eventLines = [
    `Event: ${report.event.name}  |  Date and time: ${report.event.dateTime}`,
    `Venue: ${report.event.venue}  |  Organizer: ${report.event.organizer}  |  Status: ${report.event.status}`,
    `Generated: ${report.event.reportDate}`,
    `Registrations: ${report.summary.totalRegistrations}  |  Active: ${report.summary.activeRegistrations}  |  Cancelled: ${report.summary.cancelledRegistrations}`,
    `Present: ${report.summary.present}  |  Absent: ${report.summary.absent}  |  Not marked: ${report.summary.notMarked}`
  ];
  let y = 55;
  eventLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 10 + 3;
  });

  const columnWidths = [125, 115, 165, 115, 94, 83, 72.89];
  autoTable(doc, {
    startY: y + 6,
    tableWidth: contentWidth,
    margin: { left: margin, right: margin, bottom: 36 },
    head: [[
      'Registration\nID',
      'Participant\nname',
      'Email',
      'Department /\norganization',
      'Registration\ndate',
      'Registration\nstatus',
      'Attendance\nstatus'
    ]],
    body: report.rows.map((row) => [
      row.registrationId,
      row.name,
      row.email,
      row.organization,
      formatRegistrationDate(row.registeredAt) || '—',
      row.status || '—',
      row.attendanceStatus || 'not_marked'
    ].map(breakLongPdfTokens)),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 3,
      overflow: 'linebreak',
      valign: 'top',
      lineColor: [226, 232, 240],
      textColor: [31, 41, 55]
    },
    headStyles: {
      fillColor: [76, 29, 149],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    columnStyles: Object.fromEntries(columnWidths.map((width, index) => [
      index,
      { cellWidth: width }
    ]))
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 16, {
      align: 'right'
    });
  }
  return doc;
};

export const createAttendeeWorkbook = async (event, attendees, generatedAt = new Date()) => {
  const ExcelJS = (await import('exceljs')).default;
  const report = buildAttendeeExportData(event, attendees, generatedAt);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EventFlow';
  workbook.created = validDate(generatedAt) || new Date();
  workbook.subject = 'Event attendee register';
  workbook.title = report.title;

  const registerSheet = workbook.addWorksheet('Attendee Register', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  registerSheet.columns = EXCEL_COLUMNS.map(([, header, width]) => ({ header, width }));
  report.rows.forEach((row) => {
    registerSheet.addRow([
      row.registrationId,
      row.name,
      row.email,
      row.phone,
      row.organization,
      validDate(row.registeredAt),
      row.status,
      row.attendanceStatus
    ]);
  });
  registerSheet.autoFilter = {
    from: 'A1',
    to: `H${Math.max(1, report.rows.length + 1)}`
  };
  registerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  registerSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4C1D95' }
  };
  registerSheet.getColumn(6).numFmt = 'mmm d, yyyy h:mm AM/PM';
  registerSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
    }
  });

  const summarySheet = workbook.addWorksheet('Attendance Summary', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];
  summarySheet.addRows([
    ['Total registrations', report.summary.totalRegistrations],
    ['Active registrations', report.summary.activeRegistrations],
    ['Cancelled registrations', report.summary.cancelledRegistrations],
    ['Present', report.summary.present],
    ['Absent', report.summary.absent],
    ['Not marked', report.summary.notMarked],
    ['Attendance percentage', report.summary.attendancePercentage]
  ]);
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4C1D95' }
  };
  summarySheet.getCell('B8').numFmt = '0.0%';
  summarySheet.autoFilter = 'A1:B8';

  const eventSheet = workbook.addWorksheet('Event Information', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  eventSheet.columns = [
    { header: 'Event Information', key: 'label', width: 28 },
    { header: 'Details', key: 'value', width: 64 }
  ];
  eventSheet.addRows([
    ['Event name', report.event.name],
    ['Event date and time', report.event.dateTime],
    ['Venue', report.event.venue],
    ['Organizer', report.event.organizer],
    ['Event status', report.event.status],
    ['Report generated', report.event.reportDate]
  ]);
  eventSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  eventSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4C1D95' }
  };
  return workbook;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const downloadAttendeeCsv = (attendees, filename) => {
  const file = new Blob([attendeeRowsToCsv(attendees)], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(file, filename);
};

export const downloadAttendeePdf = (event, attendees, filename, generatedAt) => {
  return createAttendeePdf(event, attendees, generatedAt).then((doc) => doc.save(filename));
};

export const downloadAttendeeExcel = async (event, attendees, filename, generatedAt) => {
  const workbook = await createAttendeeWorkbook(event, attendees, generatedAt);
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), filename);
};
