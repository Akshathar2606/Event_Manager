import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminUserService, extractErrorMessage } from '../../services/adminUserService';
import {
  buildUserDirectoryParams,
  executeUserStatusChange,
  formatUserCreationDate,
  getUserDirectoryNavigation,
  getUserDirectoryView,
  isCurrentAdminAccount
} from '../../utils/adminUserUtils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserX,
  X
} from 'lucide-react';

const INITIAL_PAGINATION = { total: 0, page: 1, pages: 1, limit: 10 };
const USER_ROLES = ['administrator', 'organizer', 'participant', 'vendor'];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [confirmationUser, setConfirmationUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInProgress = useRef(false);

  const fetchUsers = useCallback(async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = buildUserDirectoryParams({
        page: targetPage,
        limit: INITIAL_PAGINATION.limit,
        search,
        role: roleFilter,
        isActive: activeFilter
      });
      const response = await adminUserService.getUsers(params);
      setUsers(Array.isArray(response.data) ? response.data : []);
      setPagination(response.pagination || INITIAL_PAGINATION);
      setPage(response.pagination?.page || targetPage);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Failed to load users.'));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, page, roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(page), 250);
    return () => clearTimeout(timer);
  }, [fetchUsers, page]);

  const handleRefresh = () => {
    setSuccessMessage(null);
    fetchUsers(page);
  };

  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
    setSuccessMessage(null);
  };

  const pageNavigation = getUserDirectoryNavigation(pagination);
  const directoryView = getUserDirectoryView({ loading, error, users });

  const handleConfirmStatusChange = async () => {
    if (!confirmationUser || actionInProgress.current) return;

    const targetUser = confirmationUser;
    const nextIsActive = !targetUser.isActive;
    if (!nextIsActive && isCurrentAdminAccount(targetUser, currentUser)) {
      setConfirmationUser(null);
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    await executeUserStatusChange({
      account: targetUser,
      isActive: nextIsActive,
      inProgress: actionInProgress,
      updateStatus: adminUserService.updateUserStatus,
      onSuccess: async (response) => {
        if (response.user) {
          setUsers((currentUsers) =>
            currentUsers.map((item) =>
              item.id === response.user.id ? { ...item, ...response.user } : item
            )
          );
        }
        setConfirmationUser(null);
        setSuccessMessage(response.message || `Account ${nextIsActive ? 'activated' : 'deactivated'}.`);
        await fetchUsers(page);
      },
      onError: (requestError) => {
        setError(
          extractErrorMessage(
            requestError,
            'Could not update this account. The request may be blocked by administrator safeguards.'
          )
        );
      },
      onFinally: () => setActionLoading(false)
    });
  };

  return (
    <div className="space-y-6">
      <header className="bg-surface rounded-2xl border border-border p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Shield className="w-3.5 h-3.5" />
            Administrator Portal
          </span>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            User Directory
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Search accounts and manage access. Account roles and historical records are preserved.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-text-secondary bg-surface border border-border hover:bg-background disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {successMessage && (
        <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button type="button" onClick={handleRefresh} disabled={loading} className="font-semibold underline disabled:opacity-50">
            Retry
          </button>
        </div>
      )}

      <section className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="sm:col-span-2 relative">
            <span className="sr-only">Search users by name or email</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={handleFilterChange(setSearch)}
              placeholder="Search name or email..."
              className="block w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-surface focus:outline-hidden focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600"
            />
          </label>
          <label>
            <span className="sr-only">Filter by role</span>
            <select
              value={roleFilter}
              onChange={handleFilterChange(setRoleFilter)}
              className="block w-full py-2 px-3 text-sm rounded-xl border border-border bg-surface text-text-secondary"
            >
              <option value="">All roles</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by account status</span>
            <select
              value={activeFilter}
              onChange={handleFilterChange(setActiveFilter)}
              className="block w-full py-2 px-3 text-sm rounded-xl border border-border bg-surface text-text-secondary"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <div className="px-4 py-3 bg-background border-b border-border text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">{pagination.total}</span>{' '}
          {pagination.total === 1 ? 'user' : 'users'} total
          <span className="mx-2 text-text-muted">|</span>
          Page <span className="font-semibold text-text-primary">{pagination.page}</span> of{' '}
          <span className="font-semibold text-text-primary">{pagination.pages}</span>
          {pagination.total > 0 && (
            <span className="ml-2 text-text-muted">
              (showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)})
            </span>
          )}
        </div>

        {directoryView === 'loading' ? (
          <div className="py-16 flex flex-col items-center text-text-muted" role="status">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600 mb-3" />
            <span className="text-sm">Loading users...</span>
          </div>
        ) : directoryView === 'error' ? (
          <div className="py-12 text-center text-sm text-text-muted">
            User list could not be loaded. Retry to try again.
          </div>
        ) : directoryView === 'empty' ? (
          <div className="py-16 text-center">
            <UserCheck className="w-10 h-10 mx-auto text-text-muted mb-3" />
            <h2 className="font-semibold text-text-primary">No users found</h2>
            <p className="mt-1 text-sm text-text-muted">Try changing your search or filters.</p>
            {(search || roleFilter || activeFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('');
                  setActiveFilter('');
                  setPage(1);
                }}
                className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">User</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Organization / Phone</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Created</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-right">Account access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((account) => (
                  <tr key={account.id} className="hover:bg-background">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-text-primary">{account.name || 'Unnamed user'}</div>
                      <div className="text-xs text-text-muted break-all">{account.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold capitalize">
                        {account.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        account.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-surface-subtle text-text-secondary border-border'
                      }`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-text-secondary">
                      <div>{account.organization || '—'}</div>
                      {account.phone && <div className="mt-1 text-text-muted">{account.phone}</div>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-text-secondary">
                      {formatUserCreationDate(account.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {isCurrentAdminAccount(account, currentUser) && account.isActive ? (
                        <button
                          type="button"
                          disabled
                          title="You cannot deactivate your own account."
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-text-muted bg-background cursor-not-allowed"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Your account
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmationUser(account)}
                          disabled={actionLoading}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 ${
                            account.isActive
                              ? 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {actionLoading && confirmationUser?.id === account.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : account.isActive ? (
                            <UserX className="w-3.5 h-3.5" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5" />
                          )}
                          {account.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="py-3 px-4 border-t border-border bg-background flex items-center justify-between text-xs text-text-secondary">
          <button
            type="button"
            onClick={() => setPage(pageNavigation.previousPage)}
            disabled={pagination.page <= 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface font-medium hover:bg-background disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span>Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
          <button
            type="button"
            onClick={() => setPage(pageNavigation.nextPage)}
            disabled={pagination.page >= pagination.pages || loading}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-surface font-medium hover:bg-background disabled:opacity-50"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      </section>

      {confirmationUser && (
        <div className="fixed inset-0 z-50 bg-overlay/40 backdrop-blur-xs flex items-center justify-center p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-status-confirmation-title"
            className="bg-surface rounded-2xl border border-border shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="user-status-confirmation-title" className="text-lg font-bold text-text-primary">
                  {confirmationUser.isActive ? 'Deactivate account?' : 'Activate account?'}
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                  {confirmationUser.isActive
                    ? `This will prevent ${confirmationUser.name || confirmationUser.email} from signing in. Their role and historical records will remain unchanged.`
                    : `This will allow ${confirmationUser.name || confirmationUser.email} to sign in again.`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close confirmation"
                disabled={actionLoading}
                onClick={() => setConfirmationUser(null)}
                className="p-1 text-text-muted hover:text-text-secondary disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <div role="alert" className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
                {error}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmationUser(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text-secondary hover:bg-background disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmStatusChange}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {confirmationUser.isActive ? 'deactivation' : 'activation'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
