import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CircleUserRound, ClipboardList, Loader2, Megaphone } from 'lucide-react';
import { eventService } from '../../services/eventService';
import { Alert, Card, CardContent, CardHeader, CardTitle, EmptyState } from '../ui';

const activityIcons = {
  event_created: CalendarDays,
  event_published: Megaphone,
  event_updated: CalendarDays,
  event_cancelled: CalendarDays,
  event_completed: CheckCircle2,
  participant_registered: CircleUserRound,
  registration_cancelled: CircleUserRound,
  venue_booking_requested: ClipboardList,
  venue_booking_approved: CheckCircle2,
  venue_booking_rejected: ClipboardList,
  catering_request_created: ClipboardList,
  catering_request_accepted: CheckCircle2,
  catering_request_rejected: ClipboardList
};

const formatActivityDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

export default function EventActivityTimeline({
  eventId,
  activities: suppliedActivities,
  loading: suppliedLoading,
  error: suppliedError,
  title = 'Event activity',
  showCardHeader = true,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Important event and workflow updates will be recorded here.'
}) {
  const [eventActivities, setEventActivities] = useState([]);
  const [eventLoading, setEventLoading] = useState(true);
  const [eventError, setEventError] = useState('');
  const isSupplied = suppliedActivities !== undefined;
  const activities = isSupplied ? suppliedActivities : eventActivities;
  const loading = isSupplied ? Boolean(suppliedLoading) : eventLoading;
  const error = isSupplied ? suppliedError : eventError;

  useEffect(() => {
    if (isSupplied) return undefined;
    let active = true;
    setEventLoading(true);
    setEventError('');
    eventService.getEventActivity(eventId)
      .then((result) => {
        if (active) setEventActivities(result.data || []);
      })
      .catch(() => {
        if (active) setEventError('Event activity could not be loaded.');
      })
      .finally(() => {
        if (active) setEventLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, isSupplied]);

  return (
    <Card>
      {showCardHeader && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={showCardHeader ? '' : 'pt-5'}>
        {error && <Alert variant="error">{error}</Alert>}
        {loading ? (
          <div role="status" className="flex items-center gap-2 py-6 text-sm text-text-muted">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Loading event activity...
          </div>
        ) : error && activities.length === 0 ? null : activities.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={emptyTitle}
            description={emptyDescription}
            className="py-6"
          />
        ) : (
          <ol className="space-y-0">
            {activities.map((activity, index) => {
              const Icon = activityIcons[activity.action] || CalendarDays;
              return (
                <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < activities.length - 1 && (
                    <span aria-hidden="true" className="absolute bottom-0 left-4 top-9 w-px bg-border" />
                  )}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm text-text-primary">{activity.description}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {activity.actor?.name ? `${activity.actor.name} · ` : ''}
                      {activity.eventTitle ? `${activity.eventTitle} · ` : ''}
                      {formatActivityDate(activity.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
