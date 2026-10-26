import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  CalendarCheck,
  Users,
  Calendar,
  UtensilsCrossed,
  Compass,
  Ticket,
  UserCheck,
  ClipboardList,
  Store,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronDown
} from 'lucide-react';

const ROLE_NAV_CONFIG = {
  administrator: {
    label: 'Administrator',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    links: [
      { to: '/admin', label: 'Admin Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/venues', label: 'Campus Venues', icon: Building2 },
      { to: '/admin/bookings', label: 'Booking Requests', icon: CalendarCheck },
      { to: '/admin/users', label: 'User Directory', icon: Users },
    ],
  },
  organizer: {
    label: 'Event Organizer',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    links: [
      { to: '/organizer', label: 'Organizer Hub', icon: LayoutDashboard, end: true },
      { to: '/organizer/events', label: 'My Events', icon: Calendar },
      { to: '/organizer/venues', label: 'Find Venues', icon: Building2 },
      { to: '/organizer/catering', label: 'Catering Services', icon: UtensilsCrossed },
    ],
  },
  participant: {
    label: 'Participant',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    links: [
      { to: '/participant', label: 'Discover Events', icon: Compass, end: true },
      { to: '/participant/registrations', label: 'My Registrations', icon: Ticket },
      { to: '/participant/profile', label: 'My Profile', icon: UserCheck },
    ],
  },
  vendor: {
    label: 'Catering Vendor',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    links: [
      { to: '/vendor', label: 'Vendor Overview', icon: LayoutDashboard, end: true },
      { to: '/vendor/menus', label: 'Food Packages', icon: UtensilsCrossed },
      { to: '/vendor/requests', label: 'Booking Inquiries', icon: ClipboardList },
      { to: '/vendor/profile', label: 'Vendor Profile', icon: Store },
    ],
  },
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleConfig = (user && ROLE_NAV_CONFIG[user.role]) || ROLE_NAV_CONFIG.participant;
  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'EF';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="md:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-indigo-200">
                  EF
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-slate-900 tracking-tight leading-tight">
                    EventFlow
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                    Platform
                  </span>
                </div>
              </div>
            </div>

            {/* Right: User Profile & Actions */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end mr-1">
                <span className="text-sm font-semibold text-slate-800 leading-snug">
                  {user?.name || 'Authorized User'}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border ${roleConfig.badgeColor}`}
                >
                  {roleConfig.label}
                </span>
              </div>

              <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs flex items-center justify-center shadow-xs">
                {userInitials}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                title="Log out of EventFlow"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1 shadow-lg">
            <div className="pb-3 mb-2 border-b border-slate-100">
              <div className="font-medium text-sm text-slate-800">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
              <div className="mt-1.5">
                <span
                  className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-full border ${roleConfig.badgeColor}`}
                >
                  {roleConfig.label}
                </span>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Menu
            </div>
            {roleConfig.links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex py-6 gap-8">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs sticky top-24">
            <div className="px-3 py-2 mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {roleConfig.label}
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</div>
            </div>

            <nav className="space-y-1">
              {roleConfig.links.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-8 pt-4 border-t border-slate-100 px-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                <span>RBAC Security Enforced</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Page Content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
