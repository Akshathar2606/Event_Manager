const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DERIVED_EVENT_STATUSES = ['upcoming', 'ongoing', 'completed'];

const getEventEndDateTime = (event) => {
  if (!event) return null;

  if (event.endDateTime) {
    const endDateTime = new Date(event.endDateTime);
    if (!Number.isNaN(endDateTime.getTime())) return endDateTime;
  }

  if (!event.startDateTime) return null;
  const startDateTime = new Date(event.startDateTime);
  if (Number.isNaN(startDateTime.getTime())) return null;
  return new Date(startDateTime.getTime() + DAY_IN_MILLISECONDS);
};

const getEventLifecycleStatus = (event, now = new Date()) => {
  const storedStatus = String(event?.status || '').toLowerCase();
  if (storedStatus === 'draft' || storedStatus === 'cancelled') return storedStatus;
  if (storedStatus !== 'published') return storedStatus || 'upcoming';

  const startDateTime = event.startDateTime ? new Date(event.startDateTime) : null;
  if (!startDateTime || Number.isNaN(startDateTime.getTime())) return 'upcoming';

  const endDateTime = getEventEndDateTime(event);
  const currentTime = now instanceof Date ? now : new Date(now);
  if (endDateTime && currentTime.getTime() > endDateTime.getTime()) return 'completed';
  if (currentTime.getTime() >= startDateTime.getTime()) return 'ongoing';
  return 'upcoming';
};

const getEventLifecycleQuery = (status, now = new Date()) => {
  const currentTime = now instanceof Date ? now : new Date(now);
  const missingEndFallbackBoundary = new Date(currentTime.getTime() - DAY_IN_MILLISECONDS);

  if (status === 'upcoming') {
    return { status: 'published', startDateTime: { $gt: currentTime } };
  }
  if (status === 'ongoing') {
    return {
      $and: [
        { status: 'published' },
        { startDateTime: { $lte: currentTime } },
        {
          $or: [
            { endDateTime: { $gte: currentTime } },
            {
              $and: [
                { endDateTime: null },
                { startDateTime: { $gte: missingEndFallbackBoundary } }
              ]
            }
          ]
        }
      ]
    };
  }
  if (status === 'completed') {
    return {
      $and: [
        { status: 'published' },
        {
          $or: [
            { endDateTime: { $lt: currentTime } },
            {
              $and: [
                { endDateTime: null },
                { startDateTime: { $lt: missingEndFallbackBoundary } }
              ]
            }
          ]
        }
      ]
    };
  }
  return { status };
};

module.exports = {
  DAY_IN_MILLISECONDS,
  DERIVED_EVENT_STATUSES,
  getEventEndDateTime,
  getEventLifecycleStatus,
  getEventLifecycleQuery
};
