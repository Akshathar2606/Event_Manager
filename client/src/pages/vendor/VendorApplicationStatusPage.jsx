import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { authService, extractErrorMessage } from '../../services/authService';
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from 'lucide-react';

export default function VendorApplicationStatusPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(user?.vendorApplicationStatus || 'pending');
  const [rejectionReason, setRejectionReason] = useState(user?.vendorRejectionReason || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const currentUser = await authService.getCurrentUser();
      updateUser(currentUser);
      setStatus(currentUser.vendorApplicationStatus || 'approved');
      setRejectionReason(currentUser.vendorRejectionReason || '');
      if (currentUser.vendorApplicationStatus === 'approved') {
        navigate('/vendor', { replace: true });
      }
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not refresh your application status.'));
    } finally {
      setLoading(false);
    }
  }, [navigate, updateUser]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const rejected = status === 'rejected';
  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">EF</span>
          EventFlow
        </Link>
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
          <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${rejected ? 'bg-rose-100 text-rose-700' : status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {rejected ? <XCircle aria-hidden="true" /> : status === 'approved' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Vendor application</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary">
            {rejected ? 'Application not approved' : status === 'approved' ? 'Application approved' : 'Awaiting administrator approval'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            {rejected
              ? 'Your vendor application was reviewed. Review the feedback below and contact the EventFlow team if you have questions.'
              : status === 'approved'
                ? 'Your business is approved. Opening your vendor workspace...'
                : 'Your account is ready, but vendor tools remain locked until an administrator reviews your application. You can sign in again later to check for an update.'}
          </p>
          {rejected && rejectionReason && (
            <Alert variant="warning" title="Administrator feedback" className="mt-5">
              {rejectionReason}
            </Alert>
          )}
          {error && <Alert variant="error" className="mt-5">{error}</Alert>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={refreshStatus} loading={loading} variant="primary">
              Check application status
            </Button>
            <Link to="/profile" className="inline-flex min-h-10 items-center justify-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-background">
              Account profile
            </Link>
          </div>
          <p className="mt-5 border-t border-border pt-4 text-xs text-text-muted">
            Signed in as <span className="font-medium text-text-secondary">{user?.email}</span>
          </p>
          <button type="button" onClick={handleSignOut} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Sign out
          </button>
        </section>
      </div>
    </main>
  );
}
