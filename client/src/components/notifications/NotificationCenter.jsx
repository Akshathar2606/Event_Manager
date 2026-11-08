import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CalendarDays, CheckCheck, ClipboardList, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import { normalizeRole } from '../../utils/roles';
import { Alert, Badge, Button, EmptyState, LoadingState } from '../ui';

const getNotificationDestination = (notification, role) => {
  const destinations = {
    event: {
      administrator: '/admin/events',
      organizer: '/organizer/events',
      participant: '/participant/events',
      vendor: '/vendor'
    },
    registration: {
      administrator: '/organizer/events',
      organizer: '/organizer/events',
      participant: '/participant/registrations',
      vendor: '/vendor'
    },
    booking: {
      administrator: '/admin/bookings',
      organizer: '/organizer/bookings',
      participant: '/participant/events',
      vendor: '/vendor'
    },
    cateringRequest: {
      administrator: '/admin',
      organizer: '/organizer/catering-requests',
      participant: '/participant/events',
      vendor: '/vendor/requests'
    },
    vendorApplication: {
      administrator: '/admin/vendor-applications',
      organizer: '/organizer',
      participant: '/participant',
      vendor: '/vendor/application-status'
    }
  };
  return destinations[notification.entityType]?.[role] || null;
};

const formatNotificationDate = (date) => {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
};

export default function NotificationCenter({ user, open, onOpenChange, containerRef }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const role = normalizeRole(user?.role);
  const isMounted = useRef(true);

  const refreshUnreadCount = useCallback(async () => {
    const count = await notificationService.getUnreadCount();
    if (isMounted.current) setUnreadCount(count);
  }, []);

  const refreshNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [result, count] = await Promise.all([
        notificationService.getNotifications({ page: 1, limit: 20 }),
        notificationService.getUnreadCount()
      ]);
      if (isMounted.current) {
        setNotifications(result.data || []);
        setUnreadCount(count);
        setPage(result.pagination?.page || 1);
        setPages(result.pagination?.pages || 1);
      }
    } catch {
      if (isMounted.current) setError('Notifications could not be loaded. Please try again.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    setBusyId('more');
    setError('');
    try {
      const result = await notificationService.getNotifications({ page: page + 1, limit: 20 });
      setNotifications((items) => [...items, ...(result.data || [])]);
      setPage(result.pagination?.page || page + 1);
      setPages(result.pagination?.pages || pages);
    } catch {
      setError('More notifications could not be loaded. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    refreshUnreadCount().catch(() => {
      if (isMounted.current) setError('Unread notifications could not be refreshed.');
    });
    const intervalId = window.setInterval(() => {
      refreshUnreadCount().catch(() => {
        if (isMounted.current) setError('Unread notifications could not be refreshed.');
      });
    }, 60000);
    return () => {
      isMounted.current = false;
      window.clearInterval(intervalId);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (open) refreshNotifications();
  }, [open, refreshNotifications]);

  const markAllRead = async () => {
    setBusyId('all');
    setError('');
    try {
      await notificationService.markAllRead();
      const readAt = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
    } catch {
      setError('Notifications could not be marked as read. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const openNotification = async (notification) => {
    setBusyId(notification.id);
    setError('');
    try {
      if (!notification.readAt) await notificationService.markRead(notification.id);
      setNotifications((items) => items.map((item) =>
        item.id === notification.id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item
      ));
      if (!notification.readAt) setUnreadCount((count) => Math.max(0, count - 1));
      onOpenChange(false);
      const destination = getNotificationDestination(notification, role);
      if (destination) navigate(destination);
    } catch {
      setError('This notification could not be marked as read. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className="relative"
      >
        <Bell aria-hidden="true" className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <Badge
            variant="error"
            className="absolute -right-1 -top-1 min-h-5 min-w-5 justify-center px-1 text-[10px]"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-border bg-surface shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
              <p className="text-xs text-text-muted">{unreadCount} unread</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || busyId === 'all'}
              loading={busyId === 'all'}
              onClick={markAllRead}
              aria-label="Mark all notifications as read"
            >
              <CheckCheck aria-hidden="true" className="h-4 w-4" />
              Mark all read
            </Button>
          </div>
          {error && <Alert variant="error" className="m-3">{error}</Alert>}
          {loading ? (
            <LoadingState label="Loading notifications..." className="py-8" />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="New updates for your events and requests will appear here."
              className="py-8"
            />
          ) : (
            <ul className="max-h-[min(65vh,28rem)] overflow-y-auto divide-y divide-border">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    disabled={busyId === notification.id}
                    onClick={() => openNotification(notification)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-background disabled:opacity-60 ${
                      notification.readAt ? '' : 'bg-lavender/30'
                    }`}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary">
                      {busyId === notification.id
                        ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        : notification.entityType === 'event'
                          ? <CalendarDays aria-hidden="true" className="h-4 w-4" />
                          : <ClipboardList aria-hidden="true" className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-text-primary">{notification.title}</span>
                          {notification.type?.endsWith('_reminder') && (
                            <Badge variant="info" className="min-h-5 px-1.5 py-0.5 text-[9px]">
                              Reminder
                            </Badge>
                          )}
                        </span>
                        {!notification.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{notification.message}</span>
                      <span className="mt-1 block text-[11px] text-text-muted">
                        {formatNotificationDate(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && page < pages && notifications.length > 0 && (
            <div className="border-t border-border p-2">
              <Button
                variant="ghost"
                className="w-full"
                loading={busyId === 'more'}
                disabled={busyId === 'more'}
                onClick={loadMore}
              >
                Load more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
