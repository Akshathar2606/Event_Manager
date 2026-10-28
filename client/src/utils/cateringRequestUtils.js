/**
 * EventFlow Catering Request Utilities & Business Rules
 */

export const CATERING_REQUEST_STATUS = ['pending', 'accepted', 'rejected', 'cancelled'];

/**
 * Checks if a given start date-time has already arrived or passed.
 * @param {string|Date} startDateTime
 * @param {Date} [referenceDate] - Defaults to new Date()
 * @returns {boolean}
 */
export const isEventStarted = (startDateTime, referenceDate = new Date()) => {
  if (!startDateTime) return false;
  const start = new Date(startDateTime);
  if (isNaN(start.getTime())) return false;
  return start.getTime() <= new Date(referenceDate).getTime();
};

/**
 * Determines whether a catering request can be cancelled by the organizer.
 * Rules:
 * - A request that is already cancelled cannot be cancelled again.
 * - A request that is rejected cannot be cancelled.
 * - An accepted request can ONLY be cancelled if the event has not yet started.
 * - A pending request can always be cancelled.
 *
 * @param {Object} request - CateringRequest object
 * @param {Object|null} [event] - Optional event object if not populated on request
 * @param {Date} [referenceDate] - Optional reference date
 * @returns {{ cancellable: boolean, reason: string|null }}
 */
export const isCateringRequestCancellable = (request, event = null, referenceDate = new Date()) => {
  if (!request) {
    return { cancellable: false, reason: 'Request record is missing.' };
  }

  if (request.status === 'cancelled') {
    return { cancellable: false, reason: 'Catering request is already cancelled.' };
  }

  if (request.status === 'rejected') {
    return { cancellable: false, reason: 'Cannot cancel a request that has already been rejected.' };
  }

  if (request.status === 'accepted') {
    const effectiveStart = event?.startDateTime || request.event?.startDateTime || request.serviceDateTime;
    if (effectiveStart && isEventStarted(effectiveStart, referenceDate)) {
      return { cancellable: false, reason: 'Cannot cancel catering request for an event that has already started.' };
    }
  }

  return { cancellable: true, reason: null };
};

/**
 * Returns UI presentation badge configuration for a catering request status.
 *
 * @param {string} status - 'pending' | 'accepted' | 'rejected' | 'cancelled'
 * @returns {{ label: string, classes: string, dotClass: string }}
 */
export const getCateringRequestStatusBadge = (status) => {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending Review',
        classes: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    case 'accepted':
      return {
        label: 'Accepted',
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500'
      };
    case 'rejected':
      return {
        label: 'Rejected',
        classes: 'bg-rose-50 text-rose-800 border-rose-200',
        dotClass: 'bg-rose-500'
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        classes: 'bg-slate-100 text-slate-700 border-slate-300',
        dotClass: 'bg-slate-400'
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
 * Calculates a non-authoritative client price estimate before submission.
 * Authoritative quote is derived by the backend upon record creation.
 *
 * @param {number|string} pricePerPlate
 * @param {number|string} guestCount
 * @returns {number}
 */
export const calculateEstimatedQuote = (pricePerPlate, guestCount) => {
  const p = Number(pricePerPlate);
  const g = Number(guestCount);
  if (isNaN(p) || isNaN(g) || p < 0 || g < 1) return 0;
  return Math.round(p * g * 100) / 100;
};

/**
 * Validates vendor rejection input reason.
 *
 * @param {string} reason
 * @returns {{ isValid: boolean, error: string|null, sanitized: string }}
 */
export const validateRejectionReason = (reason) => {
  if (typeof reason !== 'string' || !reason.trim()) {
    return {
      isValid: false,
      error: 'Rejection reason is required.',
      sanitized: ''
    };
  }

  const trimmed = reason.trim();
  if (trimmed.length > 1000) {
    return {
      isValid: false,
      error: 'Rejection reason cannot exceed 1000 characters.',
      sanitized: trimmed.slice(0, 1000)
    };
  }

  return {
    isValid: true,
    error: null,
    sanitized: trimmed
  };
};

/**
 * Validates organizer request form data prior to submission.
 *
 * @param {Object} input
 * @param {string} input.eventId
 * @param {string} input.cateringServiceId
 * @param {string} input.packageId
 * @param {number|string} input.guestCount
 * @param {Object} [input.selectedPackage]
 * @param {Object} [input.selectedEvent]
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export const validateCateringRequestForm = ({
  eventId,
  cateringServiceId,
  packageId,
  guestCount,
  selectedPackage = null,
  selectedEvent = null
}) => {
  const errors = [];

  if (!eventId) {
    errors.push('Please select an event for this catering proposal.');
  }

  if (!cateringServiceId) {
    errors.push('Catering service selection is required.');
  }

  if (!packageId) {
    errors.push('Please select a food package.');
  }

  const count = Number(guestCount);
  if (guestCount === undefined || guestCount === null || guestCount === '' || isNaN(count)) {
    errors.push('Guest count is required.');
  } else if (!Number.isInteger(count) || count < 1) {
    errors.push('Guest count must be a whole number of at least 1 person.');
  } else {
    if (selectedPackage && selectedPackage.minOrder && count < selectedPackage.minOrder) {
      errors.push(`Guest count (${count}) is below the package minimum order of ${selectedPackage.minOrder} guests.`);
    }
    if (selectedEvent && selectedEvent.capacity && count > selectedEvent.capacity) {
      errors.push(`Guest count (${count}) exceeds event venue capacity of ${selectedEvent.capacity} guests.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Formats ISO date string into readable calendar text.
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
 * Formats ISO date string into readable calendar date and time.
 * @param {string|Date} isoString
 * @returns {string}
 */
export const formatDisplayDateTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
