import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attendeeRowsToCsv,
  buildAttendeeExportData,
  createAttendeePdf,
  createAttendeeWorkbook,
  fetchAllAttendeePages,
  selectAttendeesForExport
} from '../src/utils/attendeeExport.js';

const makeAttendee = (id, fields = {}) => ({
  id,
  status: 'registered',
  attendanceStatus: 'not_marked',
  registeredAt: '2026-11-08T10:00:00.000Z',
  participant: {
    name: `Participant ${id}`,
    email: `${id}@example.test`,
    organization: 'Design Lab',
    phone: '+1234567890'
  },
  ...fields
});

describe('attendee CSV export', () => {
  test('exports attendee data with stable headers and escapes CSV cells', () => {
    const csv = attendeeRowsToCsv([{
      id: 'registration-1',
      status: 'registered',
      attendanceStatus: 'present',
      registeredAt: '2026-11-08T10:00:00.000Z',
      participant: {
        name: 'Aditi "Adi" Rao',
        email: 'aditi@example.com',
        phone: '+1234567890',
        organization: 'Design Lab'
      }
    }]);

    assert.match(csv, /"Registration ID","Participant Name","Email"/);
    assert.match(csv, /"Aditi ""Adi"" Rao"/);
    assert.match(csv, /"present"/);
  });

  test('neutralizes spreadsheet formulas in untrusted values', () => {
    const csv = attendeeRowsToCsv([{
      id: 'registration-2',
      status: 'registered',
      participant: {
        name: '=HYPERLINK("https:\/\/evil.example","open")',
        email: '+cmd@example.com',
        organization: '@formula'
      }
    }]);

    assert.match(csv, /"'=HYPERLINK/);
    assert.match(csv, /"'\+cmd@example.com"/);
    assert.match(csv, /"'@formula"/);
  });

  test('handles empty attendee lists', () => {
    assert.equal(attendeeRowsToCsv([]).split('\r\n').length, 1);
  });

  test('selects selected rows or all filtered rows when no selection exists', () => {
    const attendees = [makeAttendee('one'), makeAttendee('two')];
    assert.deepEqual(selectAttendeesForExport(attendees, new Set(['two'])), [attendees[1]]);
    assert.deepEqual(selectAttendeesForExport(attendees, new Set()), attendees);
  });

  test('fetches all filtered pages sequentially using the API page limit', async () => {
    const calls = [];
    const filters = { search: 'test@example.test', status: 'registered', sortBy: 'name' };
    const pages = [
      { pagination: { pages: 3 }, data: [makeAttendee('one')] },
      { pagination: { pages: 3 }, data: [makeAttendee('two')] },
      { pagination: { pages: 3 }, data: [makeAttendee('three')] }
    ];
    const rows = await fetchAllAttendeePages(async (page, limit, receivedFilters) => {
      calls.push({ page, limit, filters: receivedFilters });
      return pages[page - 1];
    }, filters);

    assert.deepEqual(calls, [
      { page: 1, limit: 100, filters },
      { page: 2, limit: 100, filters },
      { page: 3, limit: 100, filters }
    ]);
    assert.equal(rows.length, 3);
  });

  test('selected export rows are chosen after fetching every filtered page', async () => {
    const filters = { search: 'student', attendanceStatus: 'present', dateFrom: '2026-11-01' };
    const rows = await fetchAllAttendeePages(async (page, _limit, receivedFilters) => {
      assert.deepEqual(receivedFilters, filters);
      return {
        pagination: { pages: 2 },
        data: page === 1 ? [makeAttendee('first')] : [makeAttendee('second'), makeAttendee('third')]
      };
    }, filters);

    const selected = selectAttendeesForExport(rows, new Set(['second', 'third']));
    assert.deepEqual(selected.map((row) => row.id), ['second', 'third']);
  });

  test('report summary accurately uses the exported attendee set', () => {
    const report = buildAttendeeExportData(
      { title: 'Tech Fest', startDateTime: '2026-11-09T10:00:00.000Z' },
      [
        makeAttendee('active-present', { attendanceStatus: 'present' }),
        makeAttendee('active-absent', { attendanceStatus: 'absent' }),
        makeAttendee('cancelled', { status: 'cancelled', attendanceStatus: 'present' })
      ],
      '2026-11-08T12:00:00.000Z'
    );

    assert.equal(report.title, 'EVENTFLOW — ATTENDEE REGISTER');
    assert.equal(report.summary.totalRegistrations, 3);
    assert.equal(report.summary.activeRegistrations, 2);
    assert.equal(report.summary.cancelledRegistrations, 1);
    assert.equal(report.summary.present, 1);
    assert.equal(report.summary.absent, 1);
    assert.equal(report.summary.notMarked, 0);
    assert.equal(report.summary.attendancePercentage, 0.5);
    assert.equal(report.rows.length, 3);
  });

  test('generates a printable PDF for empty and long attendee data', async () => {
    const longAttendee = makeAttendee('long', {
      participant: {
        name: 'A very long participant name '.repeat(8),
        email: `${'very-long-address-'.repeat(8)}@example.test`,
        organization: 'An organization with a long name '.repeat(5)
      }
    });
    const pdf = await createAttendeePdf({
      title: 'EventFlow Long Name Event',
      startDateTime: '2026-11-09T10:00:00.000Z',
      venue: { name: 'Main Hall', location: 'North Campus' },
      organizer: { name: 'Organizer Example' },
      status: 'published'
    }, [longAttendee], '2026-11-08T12:00:00.000Z');
    assert.match(pdf.output(), /^%PDF-/);
    assert.ok(pdf.internal.getNumberOfPages() >= 1);
    assert.equal(pdf.lastAutoTable.settings.showHead, 'everyPage');

    const multipagePdf = await createAttendeePdf({}, Array.from({ length: 60 }, (_, index) =>
      makeAttendee(`page-${index}`)));
    assert.ok(multipagePdf.internal.getNumberOfPages() > 1);
    assert.equal(multipagePdf.lastAutoTable.settings.showHead, 'everyPage');

    const emptyPdf = await createAttendeePdf(null, [], 'invalid-date');
    assert.match(emptyPdf.output(), /^%PDF-/);
  });

  test('creates a valid Excel workbook with the requested sheets, columns, and summary', async () => {
    const attendees = [
      makeAttendee('one', { attendanceStatus: 'present' }),
      makeAttendee('two', { attendanceStatus: 'absent' }),
      makeAttendee('three'),
      makeAttendee('four', { status: 'cancelled', attendanceStatus: 'present' })
    ];
    const workbook = await createAttendeeWorkbook({
      title: 'Tech Fest',
      startDateTime: '2026-11-09T10:00:00.000Z',
      venue: { name: 'Main Hall', location: 'North Campus' },
      organizer: { name: 'Organizer Example' },
      status: 'published'
    }, attendees, '2026-11-08T12:00:00.000Z');
    const bytes = await workbook.xlsx.writeBuffer();
    const ExcelJS = (await import('exceljs')).default;
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);

    assert.deepEqual(reopened.worksheets.map((sheet) => sheet.name), [
      'Attendee Register',
      'Attendance Summary',
      'Event Information'
    ]);
    const registerSheet = reopened.getWorksheet('Attendee Register');
    assert.deepEqual(registerSheet.getRow(1).values.slice(1), [
      'Registration ID',
      'Participant Name',
      'Email',
      'Phone',
      'Department',
      'Registration Date',
      'Registration Status',
      'Attendance Status'
    ]);
    assert.equal(registerSheet.rowCount, 5);
    assert.equal(registerSheet.views[0].ySplit, 1);
    assert.equal(registerSheet.autoFilter, 'A1:H5');

    const summarySheet = reopened.getWorksheet('Attendance Summary');
    assert.equal(summarySheet.getCell('B2').value, 4);
    assert.equal(summarySheet.getCell('B3').value, 3);
    assert.equal(summarySheet.getCell('B4').value, 1);
    assert.equal(summarySheet.getCell('B5').value, 1);
    assert.equal(summarySheet.getCell('B6').value, 1);
    assert.equal(summarySheet.getCell('B7').value, 1);
    assert.equal(summarySheet.getCell('B8').value, 1 / 3);

    const eventSheet = reopened.getWorksheet('Event Information');
    assert.equal(eventSheet.getCell('B2').value, 'Tech Fest');
    assert.equal(eventSheet.getCell('B4').value, 'Main Hall — North Campus');
    assert.equal(eventSheet.getCell('B5').value, 'Organizer Example');
  });

  test('handles missing event information and empty workbook data safely', async () => {
    const report = buildAttendeeExportData(null, [], 'invalid-date');
    assert.equal(report.event.name, 'Event details unavailable');
    assert.equal(report.event.venue, 'Not provided');
    assert.equal(report.event.organizer, 'Not provided');
    assert.equal(report.summary.totalRegistrations, 0);

    const workbook = await createAttendeeWorkbook(null, [], 'invalid-date');
    assert.equal(workbook.getWorksheet('Attendee Register').rowCount, 1);
    assert.equal(workbook.getWorksheet('Attendance Summary').getCell('B8').value, 0);
  });

  test('propagates pagination errors so the page can show a useful export error', async () => {
    await assert.rejects(
      fetchAllAttendeePages(async () => { throw new Error('Attendee API unavailable'); }),
      /Attendee API unavailable/
    );
  });
});
