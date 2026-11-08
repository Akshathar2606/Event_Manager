import React, { useCallback, useEffect, useState } from 'react';
import { Alert, EmptyState, LoadingState } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { vendorApplicationService } from '../../services/vendorApplicationService';
import { extractErrorMessage } from '../../services/authService';
import {
  Building2,
  CheckCircle2,
  RefreshCw,
  Shield,
  XCircle
} from 'lucide-react';

const STATUSES = [
  ['pending', 'Pending'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All applications']
];

export default function AdminVendorApplicationsPage() {
  const [status, setStatus] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await vendorApplicationService.list({ status, page, limit: 50 });
      setApplications(result.data || []);
      setPagination(result.pagination || { total: 0, page, pages: 1 });
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not load vendor applications.'));
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleApprove = async (application) => {
    setActionId(application.id);
    setError('');
    setSuccess('');
    try {
      const result = await vendorApplicationService.approve(application.id);
      setSuccess(`${result.data.businessName} was approved.`);
      await loadApplications();
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not approve this application.'));
    } finally {
      setActionId('');
    }
  };

  const handleReject = async (application) => {
    if (rejectionReason.trim().length < 5) {
      setError('Enter a rejection reason of at least 5 characters.');
      return;
    }
    setActionId(application.id);
    setError('');
    setSuccess('');
    try {
      const result = await vendorApplicationService.reject(application.id, rejectionReason.trim());
      setSuccess(`${result.data.businessName} was rejected.`);
      setRejectingId('');
      setRejectionReason('');
      await loadApplications();
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not reject this application.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
            <Shield aria-hidden="true" className="h-3.5 w-3.5" />
            Administrator Portal
          </span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary">Vendor Applications</h1>
          <p className="mt-1 text-sm text-text-muted">
            Review business details and grant or decline vendor access.
          </p>
        </div>
        <Button variant="outline" onClick={loadApplications} disabled={loading}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Application status filters">
          {STATUSES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatus(value);
                setPage(1);
              }}
              aria-pressed={status === value}
              className={`rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                status === value ? 'bg-primary text-on-primary' : 'bg-background text-text-secondary hover:bg-surface-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading vendor applications..." />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No applications found"
            description={status === 'pending' ? 'New vendor applications will appear here for review.' : 'There are no applications in this view.'}
          />
        ) : (
          <div className="divide-y divide-border">
            {applications.map((application) => (
              <article key={application.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-text-primary">{application.businessName}</h2>
                      <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold capitalize text-text-secondary">
                        {application.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {application.vendor?.name} · {application.vendor?.email}
                    </p>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-semibold uppercase text-text-muted">Category</dt><dd className="mt-1 text-text-primary">{application.businessCategory}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-text-muted">Contact</dt><dd className="mt-1 text-text-primary">{application.contactNumber}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-text-muted">Location</dt><dd className="mt-1 text-text-primary">{application.locality}, {application.city}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase text-text-muted">Services</dt><dd className="mt-1 text-text-primary">{application.servicesOffered.join(', ')}</dd></div>
                    </dl>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{application.businessDescription}</p>
                    {application.status === 'rejected' && application.rejectionReason && (
                      <Alert variant="warning" title="Rejection reason" className="mt-4">{application.rejectionReason}</Alert>
                    )}
                    {application.reviewedAt && (
                      <p className="mt-3 text-xs text-text-muted">
                        Reviewed {new Date(application.reviewedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {application.status === 'pending' && (
                    <div className="flex w-full flex-col gap-2 lg:w-64 lg:shrink-0">
                      <Button
                        onClick={() => handleApprove(application)}
                        loading={actionId === application.id && rejectingId !== application.id}
                      >
                        <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                        Approve application
                      </Button>
                      {rejectingId === application.id ? (
                        <div className="space-y-2 rounded-xl border border-border p-3">
                          <label htmlFor={`rejection-${application.id}`} className="text-xs font-semibold text-text-secondary">
                            Reason for rejection
                          </label>
                          <textarea
                            id={`rejection-${application.id}`}
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            rows={3}
                            maxLength={500}
                            className="w-full rounded-control border border-border-strong bg-surface p-2 text-sm text-text-primary"
                          />
                          <Button
                            variant="danger"
                            onClick={() => handleReject(application)}
                            loading={actionId === application.id}
                            className="w-full"
                          >
                            Confirm rejection
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          disabled={Boolean(actionId)}
                          onClick={() => {
                            setRejectingId(application.id);
                            setRejectionReason('');
                            setError('');
                          }}
                        >
                          <XCircle aria-hidden="true" className="h-4 w-4" />
                          Reject
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-4 text-sm">
            <span className="text-text-muted">
              Page {pagination.page} of {pagination.pages} · {pagination.total} applications
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= pagination.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
