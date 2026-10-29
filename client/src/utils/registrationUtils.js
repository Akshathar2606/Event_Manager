/**
 * Participant Registration & Attendee Management Utilities
 */

export const REGISTRATION_STATUS = ['registered', 'cancelled'];
export const ACADEMIC_YEAR_OPTIONS = [
  { value: 'first', label: 'First Year' },
  { value: 'second', label: 'Second Year' },
  { value: 'third', label: 'Third Year' },
  { value: 'fourth', label: 'Fourth Year' }
];

export const formatAcademicYear = (academicYear) =>
  ACADEMIC_YEAR_OPTIONS.find((year) => year.value === academicYear)?.label || 'Not provided';

/**
 * Checks if an event has already started based on its start date-time.
 * @param {string|Date} startDateTime
 * @param {Date} [referenceDate] - Optional reference date (defaults to now)
 * @returns {boolean}
 */
export const isEventStarted = (startDateTime, referenceDate = new Date()) => {
  if (!startDateTime) return false;
  const start = new Date(startDateTime);
  if (isNaN(start.getTime())) return false;
  return start.getTime() <= new Date(referenceDate).getTime();
};

/**
 * Checks if an event's registration deadline has passed.
 * @param {string|Date} deadline
 * @param {Date} [referenceDate] - Optional reference date (defaults to now)
 * @returns {boolean}
 */
export const isRegistrationDeadlinePassed = (deadline, referenceDate = new Date()) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < new Date(referenceDate).getTime();
};

/**
 * Checks if an event is at maximum seating capacity.
 * @param {number} capacity
 * @param {number} registeredCount
 * @returns {boolean}
 */
export const isEventFull = (capacity, registeredCount = 0) => {
  if (capacity === undefined || capacity === null) return false;
  return Number(registeredCount) >= Number(capacity);
};

/**
 * Evaluates registration eligibility for a participant.
 *
 * @param {Object} event - Event record
 * @param {Object|null} [userRegistration] - Existing user registration if known
 * @param {Date} [referenceDate] - Optional reference date
 * @returns {{ eligible: boolean, reason: string|null, code: string|null }}
 */
export const evaluateRegistrationEligibility = (event, userRegistration = null, referenceDate = new Date()) => {
  if (!event) {
    return { eligible: false, reason: 'Event not found', code: 'NOT_FOUND' };
  }

  if (event.status !== 'published') {
    return { eligible: false, reason: 'Event is not published for registrations', code: 'NOT_PUBLISHED' };
  }

  if (isEventStarted(event.startDateTime, referenceDate)) {
    return { eligible: false, reason: 'Event has already started', code: 'EVENT_STARTED' };
  }

  if (isRegistrationDeadlinePassed(event.registrationDeadline, referenceDate)) {
    return { eligible: false, reason: 'Registration deadline has passed', code: 'DEADLINE_PASSED' };
  }

  if (userRegistration && userRegistration.status === 'registered') {
    return { eligible: false, reason: 'You are already registered for this event', code: 'ALREADY_REGISTERED' };
  }

  if (isEventFull(event.capacity, event.registeredCount)) {
    return { eligible: false, reason: 'Event has reached maximum capacity', code: 'CAPACITY_FULL' };
  }

  return { eligible: true, reason: null, code: null };
};

/**
 * Determines whether a registration can be cancelled by the participant.
 *
 * @param {Object} registration - Registration record
 * @param {Object|null} [event] - Associated event record
 * @param {Date} [referenceDate] - Optional reference date
 * @returns {{ cancellable: boolean, reason: string|null }}
 */
export const isRegistrationCancellable = (registration, event = null, referenceDate = new Date()) => {
  if (!registration) {
    return { cancellable: false, reason: 'Registration record is missing' };
  }

  if (registration.status === 'cancelled') {
    return { cancellable: false, reason: 'Registration is already cancelled' };
  }

  const effectiveStart = event?.startDateTime || registration.event?.startDateTime;
  if (effectiveStart && isEventStarted(effectiveStart, referenceDate)) {
    return { cancellable: false, reason: 'Cannot cancel registration for an event that has already started' };
  }

  return { cancellable: true, reason: null };
};

/**
 * Format registration status badge styling.
 *
 * @param {string} status - 'registered' or 'cancelled'
 * @returns {{ label: string, classes: string, dotClass: string }}
 */
export const getRegistrationStatusBadge = (status) => {
  switch (status) {
    case 'registered':
      return {
        label: 'Registered',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500'
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
        dotClass: 'bg-rose-500'
      };
    default:
      return {
        label: status || 'Unknown',
        classes: 'bg-slate-50 text-slate-700 border-slate-200',
        dotClass: 'bg-slate-400'
      };
  }
};

/**
 * Formats ISO date string into readable human text.
 * @param {string|Date} isoString
 * @returns {string}
 */
export const formatDisplayDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Formats time from ISO string.
 * @param {string|Date} isoString
 * @returns {string}
 */
export const formatDisplayTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
};
