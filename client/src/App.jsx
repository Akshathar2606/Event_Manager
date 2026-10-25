import React, { useEffect, useState } from 'react';
import { Calendar, Shield, Users, UtensilsCrossed, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function App() {
  const [apiHealth, setApiHealth] = useState({ status: 'checking', message: 'Checking API...' });

  useEffect(() => {
    axios.get('/api/health')
      .then(res => {
        setApiHealth({ status: 'connected', message: res.data.service + ' is running' });
      })
      .catch(() => {
        setApiHealth({ status: 'disconnected', message: 'API not reachable (make sure backend is started)' });
      });
  }, []);

  const roles = [
    {
      title: 'Administrator',
      icon: Shield,
      color: 'bg-rose-50 text-rose-600 border-rose-200',
      description: 'Review venue requests, manage shared campus venues, and supervise system listings.',
    },
    {
      title: 'Event Organizer',
      icon: Calendar,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      description: 'Check venue availability, request catering, coordinate agendas, and publish events.',
    },
    {
      title: 'Catering Vendor',
      icon: UtensilsCrossed,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      description: 'Showcase food packages, set capacity and pricing, and accept/reject catering requests.',
    },
    {
      title: 'Participant',
      icon: Users,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      description: 'Browse upcoming events, inspect venues, view catering menus, and reserve seats.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col justify-between">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
              EF
            </div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">EventFlow</span>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              apiHealth.status === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {apiHealth.status === 'connected' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
              {apiHealth.message}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 flex-1 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-3">
            Day 1: Platform Foundation
          </span>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Event Management, <span className="text-indigo-600">Unified.</span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed">
            A high-reliability, multi-role event management platform orchestrating campus venues, catering vendors, organizers, and attendees seamlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roles.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className={`w-12 h-12 rounded-lg border flex items-center justify-center mb-4 ${r.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-lg mb-2">{r.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{r.description}</p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Role Workflow</span>
                  <span className="font-medium text-indigo-600">Configured</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500">
          EventFlow Platform Architecture &middot; React + Vite + Tailwind &middot; Node.js + Express &middot; MongoDB Atlas
        </div>
      </footer>
    </div>
  );
}
