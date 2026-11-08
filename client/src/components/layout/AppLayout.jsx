import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Store,
  Ticket,
  UserCheck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../utils/roles';
import { Badge, Button, Card } from '../ui';
import NotificationCenter from '../notifications/NotificationCenter';

const ROLE_NAV_CONFIG = {
  administrator: {
    label: 'Administrator',
    links: [
      { to: '/admin', label: 'Admin Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/events', label: 'Event Management', icon: Calendar },
      { to: '/admin/venues', label: 'Campus Venues', icon: Building2 },
      { to: '/admin/bookings', label: 'Booking Requests', icon: CalendarCheck },
      { to: '/admin/users', label: 'User Directory', icon: Users },
    ],
  },
  organizer: {
    label: 'Event Organizer',
    links: [
      { to: '/organizer', label: 'Organizer Hub', icon: LayoutDashboard, end: true },
      { to: '/organizer/events', label: 'My Events', icon: Calendar },
      { to: '/organizer/venues', label: 'Find Venues', icon: Building2 },
      { to: '/organizer/bookings', label: 'Venue Bookings', icon: CalendarCheck },
      { to: '/organizer/catering', label: 'Catering Services', icon: UtensilsCrossed },
      { to: '/organizer/catering-requests', label: 'Catering Requests', icon: ClipboardList },
    ],
  },
  participant: {
    label: 'Participant',
    links: [
      { to: '/participant', label: 'Discover Events', icon: Compass, end: true },
      { to: '/participant/registrations', label: 'My Registrations', icon: Ticket },
      { to: '/participant/profile', label: 'My Profile', icon: UserCheck },
    ],
  },
  vendor: {
    label: 'Catering Vendor',
    links: [
      { to: '/vendor', label: 'Vendor Overview', icon: LayoutDashboard, end: true },
      { to: '/vendor/menus', label: 'Food Packages', icon: UtensilsCrossed },
      { to: '/vendor/requests', label: 'Catering Requests', icon: ClipboardList },
      { to: '/vendor/profile', label: 'Vendor Profile', icon: Store },
    ],
  },
};

const ROUTE_TITLES = {
  '/admin': 'Admin Overview',
  '/admin/events': 'Event Management',
  '/admin/venues': 'Campus Venues',
  '/admin/bookings': 'Booking Requests',
  '/admin/users': 'User Directory',
  '/organizer': 'Organizer Hub',
  '/organizer/events': 'My Events',
  '/organizer/venues': 'Find Venues',
  '/organizer/bookings': 'Venue Bookings',
  '/organizer/catering': 'Catering Services',
  '/organizer/catering-requests': 'Catering Requests',
  '/participant': 'Discover Events',
  '/participant/events': 'Discover Events',
  '/participant/dashboard': 'Participant Dashboard',
  '/participant/registrations': 'My Registrations',
  '/participant/profile': 'My Profile',
  '/profile': 'Your Profile',
  '/vendor': 'Vendor Overview',
  '/vendor/menus': 'Food Packages',
  '/vendor/requests': 'Catering Requests',
  '/vendor/profile': 'Vendor Profile',
};

function getPageTitle(pathname) {
  if (/^\/organizer\/events\/[^/]+\/attendees\/?$/.test(pathname)) {
    return 'Attendee Roster';
  }
  return ROUTE_TITLES[pathname.replace(/\/$/, '')] || 'EventFlow';
}

function getUserInitials(name) {
  if (!name) return 'EF';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function SidebarLink({ link, collapsed, onNavigate, pathname }) {
  const Icon = link.icon;

  return (
    <NavLink
      to={link.to}
      end={link.end}
      onClick={onNavigate}
      title={collapsed ? link.label : undefined}
      aria-label={collapsed ? link.label : undefined}
      className={({ isActive }) =>
        `group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm transition-colors duration-fast ${
          isActive || (link.to === '/participant' && pathname === '/participant/events')
            ? 'bg-lavender font-semibold text-primary'
            : 'text-text-secondary hover:bg-background hover:text-text-primary'
        } ${collapsed ? 'justify-center px-2' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={`absolute inset-y-2 left-0 w-1 origin-center rounded-r-full bg-secondary transition-transform duration-normal ${
              isActive || (link.to === '/participant' && pathname === '/participant/events')
                ? 'scale-y-100'
                : 'scale-y-0'
            }`}
          />
          <Icon
            aria-hidden="true"
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              isActive || (link.to === '/participant' && pathname === '/participant/events')
                ? 'text-secondary'
                : 'text-text-muted group-hover:text-primary'
            }`}
          />
          {!collapsed && <span className="truncate">{link.label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  const roleConfig = ROLE_NAV_CONFIG[normalizeRole(user?.role)] || ROLE_NAV_CONFIG.participant;
  const pageTitle = getPageTitle(location.pathname);
  const userInitials = getUserInitials(user?.name);
  const sidebarIsCollapsed = sidebarCollapsed && !mobileMenuOpen;

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-text-primary/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        id="eventflow-sidebar"
        className={`${
          mobileMenuOpen
            ? 'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))]'
            : 'hidden'
        } h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width,transform] duration-normal md:sticky md:top-0 md:flex ${
          sidebarCollapsed ? 'md:w-20' : 'md:w-64'
        }`}
      >
        <Card className="flex h-full flex-col rounded-none border-0 p-4 shadow-none">
          <div className={`flex h-12 items-center ${sidebarIsCollapsed ? 'justify-center' : 'justify-between'}`}>
            <Link
              to="/"
              aria-label="EventFlow home"
              className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-sm font-extrabold tracking-tight text-white shadow-sm">
                <CalendarDays aria-hidden="true" className="h-5 w-5" />
              </span>
              {!sidebarIsCollapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold tracking-tight text-text-primary">
                    EventFlow
                  </span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    Event workspace
                  </span>
                </span>
              )}
            </Link>

            {!sidebarIsCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className={`mt-8 mb-3 flex items-center ${sidebarIsCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
            {!sidebarIsCollapsed && (
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Workspace
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={sidebarCollapsed}
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            >
              {sidebarCollapsed
                ? <ChevronRight aria-hidden="true" className="h-4 w-4" />
                : <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
            </Button>
          </div>

          <nav aria-label={`${roleConfig.label} navigation`} className="flex-1 space-y-1">
            {roleConfig.links.map((link) => (
              <SidebarLink
                key={link.to}
                link={link}
                collapsed={sidebarIsCollapsed}
                pathname={location.pathname}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            ))}
          </nav>

          <div className="mt-4 border-t border-border pt-4">
            {!sidebarIsCollapsed && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-lavender/70 px-3 py-2.5">
                <Shield aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-[11px] font-medium text-text-secondary">
                  Role-based access enabled
                </span>
              </div>
            )}

            <div className={`mb-3 flex items-center gap-3 rounded-xl px-2 py-2 ${sidebarIsCollapsed ? 'justify-center' : ''}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavender text-xs font-bold text-primary ring-1 ring-primary/10">
                {userInitials}
              </span>
              {!sidebarIsCollapsed && (
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-text-primary">
                    {user?.name || 'Authorized User'}
                  </span>
                  <span className="block truncate text-[11px] text-text-muted">{user?.email}</span>
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              className={`w-full justify-start text-text-secondary hover:bg-error-50 hover:text-error ${
                sidebarIsCollapsed ? 'justify-center px-2' : ''
              }`}
              aria-label={sidebarIsCollapsed ? 'Log out' : undefined}
              title={sidebarIsCollapsed ? 'Log out' : undefined}
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              {!sidebarIsCollapsed && <span>Log out</span>}
            </Button>
          </div>
        </Card>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <div className="flex h-[4.5rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
                aria-controls="eventflow-sidebar"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu aria-hidden="true" className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <nav aria-label="Breadcrumb">
                  <ol className="flex min-w-0 items-center gap-2 text-xs">
                    <li className="hidden shrink-0 font-medium text-text-muted sm:block">EventFlow</li>
                    <li aria-hidden="true" className="hidden text-text-muted sm:block">/</li>
                    <li className="hidden shrink-0 text-text-secondary sm:block">{roleConfig.label}</li>
                    <li aria-hidden="true" className="hidden text-text-muted sm:block">/</li>
                    <li aria-current="page" className="truncate font-semibold text-text-primary">
                      {pageTitle}
                    </li>
                  </ol>
                </nav>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <NotificationCenter
                user={user}
                open={notificationsOpen}
                onOpenChange={(open) => {
                  setNotificationsOpen(open);
                  if (open) setProfileMenuOpen(false);
                }}
                containerRef={notificationsRef}
              />

              <div className="relative" ref={profileMenuRef}>
                <Button
                  variant="ghost"
                  className="gap-2 px-1.5 sm:gap-3 sm:px-2"
                  aria-label="Open profile menu"
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setProfileMenuOpen((open) => !open);
                    setNotificationsOpen(false);
                  }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-bold text-white shadow-sm">
                    {userInitials}
                  </span>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-36 truncate text-xs font-semibold text-text-primary">
                      {user?.name || 'Authorized User'}
                    </span>
                    <span className="block text-[11px] text-text-muted">{roleConfig.label}</span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`hidden h-4 w-4 text-text-muted transition-transform sm:block ${
                      profileMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </Button>

                {profileMenuOpen && (
                  <div
                    role="dialog"
                    aria-label="Profile"
                    className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] rounded-panel border border-border bg-surface p-2 shadow-lg"
                  >
                    <div className="flex items-center gap-3 px-3 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavender text-xs font-bold text-primary">
                        {userInitials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text-primary">
                          {user?.name || 'Authorized User'}
                        </span>
                        <span className="block truncate text-xs text-text-muted">{user?.email}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border px-3 py-3">
                      <span className="text-xs text-text-muted">Account role</span>
                      <Badge variant="secondary">{roleConfig.label}</Badge>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-background hover:text-text-primary"
                    >
                      <UserCheck aria-hidden="true" className="h-4 w-4" />
                      View profile
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-50"
                    >
                      <LogOut aria-hidden="true" className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 bg-background px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
