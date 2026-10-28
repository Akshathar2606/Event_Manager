import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cateringRequestService } from '../../services/cateringRequestService';
import {
  UtensilsCrossed,
  ClipboardList,
  Store,
  ArrowRight,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function VendorDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPendingCount = async () => {
      try {
        const res = await cateringRequestService.getVendorCateringRequests({
          status: 'pending',
          limit: 1
        });
        if (isMounted) {
          setPendingCount(res.pagination?.total ?? 0);
        }
      } catch (err) {
        // Non-blocking for dashboard rendering
        console.warn('Could not fetch pending requests count:', err);
      }
    };

    fetchPendingCount();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <UtensilsCrossed className="w-3.5 h-3.5" />
                Catering Vendor Hub
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Vendor'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your commercial catering profile, food menus, pricing tiers, and campus event requests.
            </p>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 shrink-0">
            <div>Account: <span className="font-semibold text-slate-800">{user?.email}</span></div>
            <div>Role: <span className="font-semibold text-amber-600 capitalize">{user?.role}</span></div>
          </div>
        </div>
      </div>

      {/* Vendor Hub Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Store className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Commercial Profile</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Configure your business name, contact phone, cuisine specialties, service areas, and availability toggle.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/vendor/profile"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              <span>Manage Profile & Details</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Packages Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Food Packages & Menus</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create and manage buffet, high-tea, and banquet packages with price-per-plate and dietary tags.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/vendor/menus"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-orange-700 hover:text-orange-800"
            >
              <span>Configure Packages & Menus</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Requests Queue Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              {pendingCount !== null && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    pendingCount > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Catering Requests Queue</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Review incoming event catering proposals from organizers, confirm headcount, and accept or decline contracts.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/vendor/requests"
              className="inline-flex items-center justify-between w-full text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              <span>Review Incoming Proposals</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
