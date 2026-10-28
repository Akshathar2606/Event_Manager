export const isCurrentAdminAccount = (account, currentUser) =>
  Boolean(
    account?.id &&
    currentUser?.id &&
    String(account.id).toLowerCase() === String(currentUser.id).toLowerCase()
  );

export const formatUserCreationDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const buildUserDirectoryParams = ({ page, limit, search, role, isActive }) => ({
  page,
  limit,
  search: search.trim(),
  role,
  isActive
});

export const getUserDirectoryNavigation = ({ page, pages }) => ({
  previousPage: Math.max(1, page - 1),
  nextPage: Math.min(pages, page + 1)
});

export const getUserDirectoryView = ({ loading, error, users }) => {
  if (loading) return 'loading';
  if (error) return 'error';
  return users.length === 0 ? 'empty' : 'list';
};

export const executeUserStatusChange = async ({
  account,
  isActive,
  inProgress,
  updateStatus,
  onSuccess,
  onError,
  onFinally
}) => {
  if (inProgress.current) return false;

  inProgress.current = true;
  try {
    const response = await updateStatus(account.id, isActive);
    await onSuccess(response);
    return true;
  } catch (error) {
    onError(error);
    return false;
  } finally {
    inProgress.current = false;
    if (onFinally) onFinally();
  }
};
