import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CircleUserRound,
  ExternalLink,
  LockKeyhole,
  MapPin,
  Plus,
  Save,
  Shield,
  Trash2,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { authService, extractErrorMessage } from '../../services/authService';
import { cateringService } from '../../services/cateringService';
import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader } from '../../components/ui';

const getNameParts = (user) => {
  const [firstName = '', ...lastNameParts] = (user?.name || '').trim().split(/\s+/);
  return {
    firstName: user?.firstName || firstName,
    lastName: user?.lastName || lastNameParts.join(' '),
  };
};

const createForm = (user) => ({
  ...getNameParts(user),
  phone: user?.phone || '',
  organization: user?.organization || '',
  location: user?.location || '',
  bio: user?.bio || '',
  interests: Array.isArray(user?.interests) ? user.interests.join(', ') : '',
  socialLinks: Array.isArray(user?.socialLinks)
    ? user.socialLinks.map((link) => ({ label: link.label || '', url: link.url || '' }))
    : [],
});

const formatDate = (date) => {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(parsed);
};

function FormField({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-text-secondary">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-error">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description, trailing }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lavender text-primary">
          <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-bold text-text-primary">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{description}</p>}
        </div>
      </div>
      {trailing}
    </div>
  );
}

export default function UserProfilePage() {
  const { user, updateUser } = useAuth();
  const { preference, setThemePreference } = useTheme();
  const [form, setForm] = useState(() => createForm(user));
  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [vendorProfileLoading, setVendorProfileLoading] = useState(false);
  const [vendorProfileError, setVendorProfileError] = useState('');

  const role = user?.role || 'participant';
  const formattedCreatedAt = useMemo(() => formatDate(user?.createdAt), [user?.createdAt]);

  useEffect(() => {
    setForm(createForm(user));
  }, [user]);

  useEffect(() => {
    if (role !== 'vendor') return undefined;
    let active = true;
    setVendorProfileLoading(true);
    cateringService.getMyProfile()
      .then((profile) => {
        if (active) setVendorProfile(profile);
      })
      .catch((error) => {
        if (!active) return;
        if (error.response?.status !== 404) {
          setVendorProfileError(extractErrorMessage(error, 'Could not load vendor business information.'));
        }
      })
      .finally(() => {
        if (active) setVendorProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice(null);
  };

  const validate = () => {
    const nextErrors = {};
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const nameLength = `${firstName}${lastName ? ` ${lastName}` : ''}`.length;
    if (!firstName || firstName.length > 50) nextErrors.firstName = 'Enter a first name up to 50 characters.';
    if (lastName.length > 50) nextErrors.lastName = 'Last name must be 50 characters or fewer.';
    if (nameLength < 2 || nameLength > 100) nextErrors.lastName = 'Full name must be between 2 and 100 characters.';
    if (form.phone.trim()) {
      const digits = form.phone.match(/\d/g) || [];
      if (!/^[+()\d.\-\s]+$/.test(form.phone.trim()) || digits.length < 7 || digits.length > 15) {
        nextErrors.phone = 'Enter a valid phone number with 7 to 15 digits.';
      }
    }
    if (form.organization.length > 120) nextErrors.organization = 'Organization must be 120 characters or fewer.';
    if (form.location.length > 120) nextErrors.location = 'Location must be 120 characters or fewer.';
    if (form.bio.length > 500) nextErrors.bio = 'Bio must be 500 characters or fewer.';

    const interests = form.interests.split(',').map((item) => item.trim()).filter(Boolean);
    if (interests.length > 20 || interests.some((interest) => interest.length > 40)) {
      nextErrors.interests = 'Use up to 20 interests, each no longer than 40 characters.';
    }
    const seenInterests = new Set();
    for (const interest of interests) {
      const normalized = interest.toLowerCase();
      if (seenInterests.has(normalized)) {
        nextErrors.interests = 'Remove duplicate interests.';
        break;
      }
      seenInterests.add(normalized);
    }

    form.socialLinks.forEach((link, index) => {
      if (!link.label.trim() || link.label.trim().length > 30) {
        nextErrors[`socialLinkLabel${index}`] = 'Add a label up to 30 characters.';
      }
      if (link.url.trim()) {
        try {
          const parsed = new URL(link.url.trim());
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
        } catch {
          nextErrors[`socialLinkUrl${index}`] = 'Enter a valid HTTP or HTTPS link.';
        }
      } else {
        nextErrors[`socialLinkUrl${index}`] = 'Enter a URL or remove this link.';
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setNotice(null);
    try {
      const updatedUser = await authService.updateMyProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        organization: form.organization.trim(),
        location: form.location.trim(),
        bio: form.bio.trim(),
        interests: form.interests.split(',').map((item) => item.trim()).filter(Boolean),
        socialLinks: form.socialLinks
          .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
          .filter((link) => link.label && link.url),
      });
      updateUser(updatedUser);
      setIsEditing(false);
      setNotice({ variant: 'success', message: 'Your profile has been updated.' });
    } catch (error) {
      setNotice({
        variant: 'error',
        message: extractErrorMessage(error, 'Could not save your profile. Please try again.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setForm(createForm(user));
    setErrors({});
    setIsEditing(false);
    setNotice(null);
  };

  const changeSocialLink = (index, field, value) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((link, linkIndex) =>
        linkIndex === index ? { ...link, [field]: value } : link
      ),
    }));
    setErrors((current) => ({
      ...current,
      [`socialLink${field === 'label' ? 'Label' : 'Url'}${index}`]: undefined,
    }));
  };

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  if (!user) {
    return <LoadingState label="Loading your profile..." />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Manage your personal information, role details, and appearance preferences."
        actions={!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <UserRound aria-hidden="true" className="h-4 w-4" />
            Edit profile
          </Button>
        )}
      />

      {notice && (
        <Alert variant={notice.variant}>
          <div className="flex items-start justify-between gap-3">
            <p>{notice.message}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded p-0.5 opacity-70 hover:opacity-100"
              aria-label="Dismiss message"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-7">
          <span className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-surface bg-lavender text-2xl font-extrabold text-primary shadow-sm">
            {getNameParts(user).firstName.slice(0, 1).toUpperCase()}
            {getNameParts(user).lastName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 sm:pb-1">
            <h2 className="truncate text-xl font-bold tracking-tight text-text-primary">{user.name}</h2>
            <p className="truncate text-sm text-text-muted">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:pb-1">
            <Badge variant="secondary">{roleLabel}</Badge>
            {formattedCreatedAt && (
              <Badge variant="neutral">
                <CalendarDays aria-hidden="true" className="mr-1 h-3 w-3" />
                Joined {formattedCreatedAt}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      <form onSubmit={handleSave} noValidate>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,0.8fr)]">
          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <SectionHeading
                icon={CircleUserRound}
                title="Personal information"
                description="These details are private to your account."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="profile-first-name" label="First name" error={errors.firstName}>
                  <Input
                    id="profile-first-name"
                    autoComplete="given-name"
                    value={form.firstName}
                    disabled={!isEditing || submitting}
                    aria-invalid={Boolean(errors.firstName)}
                    onChange={(event) => updateField('firstName', event.target.value)}
                  />
                </FormField>
                <FormField id="profile-last-name" label="Last name" error={errors.lastName}>
                  <Input
                    id="profile-last-name"
                    autoComplete="family-name"
                    value={form.lastName}
                    disabled={!isEditing || submitting}
                    aria-invalid={Boolean(errors.lastName)}
                    onChange={(event) => updateField('lastName', event.target.value)}
                  />
                </FormField>
                <FormField id="profile-email" label="Email" hint="Email changes are not available in profile settings.">
                  <Input id="profile-email" type="email" value={user.email || ''} disabled readOnly />
                </FormField>
                <FormField id="profile-phone" label="Phone number" error={errors.phone}>
                  <Input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    disabled={!isEditing || submitting}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(event) => updateField('phone', event.target.value)}
                  />
                </FormField>
                <FormField id="profile-location" label="Location" error={errors.location}>
                  <Input
                    id="profile-location"
                    autoComplete="address-level2"
                    value={form.location}
                    disabled={!isEditing || submitting}
                    aria-invalid={Boolean(errors.location)}
                    onChange={(event) => updateField('location', event.target.value)}
                    placeholder="City or region"
                  />
                </FormField>
                {(role === 'organizer' || role === 'participant') && (
                  <FormField
                    id="profile-organization"
                    label={role === 'organizer' ? 'Organization' : 'College / organization'}
                    error={errors.organization}
                  >
                    <Input
                      id="profile-organization"
                      value={form.organization}
                      disabled={!isEditing || submitting}
                      aria-invalid={Boolean(errors.organization)}
                      onChange={(event) => updateField('organization', event.target.value)}
                    />
                  </FormField>
                )}
                <div className="sm:col-span-2">
                  <FormField id="profile-bio" label="Bio" error={errors.bio} hint={`${form.bio.length}/500 characters`}>
                    <textarea
                      id="profile-bio"
                      rows={4}
                      maxLength={500}
                      value={form.bio}
                      disabled={!isEditing || submitting}
                      aria-invalid={Boolean(errors.bio)}
                      onChange={(event) => updateField('bio', event.target.value)}
                      className="w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-primary/20 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70"
                    />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField
                    id="profile-interests"
                    label="Interests"
                    error={errors.interests}
                    hint="Separate interests with commas."
                  >
                    <Input
                      id="profile-interests"
                      value={form.interests}
                      disabled={!isEditing || submitting}
                      aria-invalid={Boolean(errors.interests)}
                      onChange={(event) => updateField('interests', event.target.value)}
                      placeholder="Technology, volunteering, music"
                    />
                  </FormField>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeading
                icon={ExternalLink}
                title="Social links"
                description="Optional links displayed only in your private profile."
              />
              <div className="space-y-3">
                {form.socialLinks.length === 0 && !isEditing && (
                  <p className="text-sm text-text-muted">No social links added.</p>
                )}
                {form.socialLinks.map((link, index) => (
                  <div key={`social-link-${index}`} className="grid gap-3 sm:grid-cols-[minmax(8rem,0.6fr)_minmax(0,1.4fr)_auto]">
                    <FormField id={`social-label-${index}`} label={index === 0 ? 'Label' : `Link ${index + 1}`} error={errors[`socialLinkLabel${index}`]}>
                      <Input
                        id={`social-label-${index}`}
                        value={link.label}
                        disabled={!isEditing || submitting}
                        onChange={(event) => changeSocialLink(index, 'label', event.target.value)}
                        placeholder="Website"
                      />
                    </FormField>
                    <FormField id={`social-url-${index}`} label={index === 0 ? 'URL' : ' ' } error={errors[`socialLinkUrl${index}`]}>
                      <Input
                        id={`social-url-${index}`}
                        type="url"
                        value={link.url}
                        disabled={!isEditing || submitting}
                        onChange={(event) => changeSocialLink(index, 'url', event.target.value)}
                        placeholder="https://example.com"
                      />
                    </FormField>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="self-end text-error hover:bg-error-50"
                        aria-label={`Remove ${link.label || `link ${index + 1}`}`}
                        disabled={submitting}
                        onClick={() => setForm((current) => ({
                          ...current,
                          socialLinks: current.socialLinks.filter((_, linkIndex) => linkIndex !== index),
                        }))}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting || form.socialLinks.length >= 10}
                    onClick={() => setForm((current) => ({
                      ...current,
                      socialLinks: [...current.socialLinks, { label: '', url: '' }],
                    }))}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Add social link
                  </Button>
                )}
                {!isEditing && form.socialLinks.map((link, index) => (
                  <a
                    key={`social-link-view-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    {link.label}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </Card>

            {isEditing && (
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={cancelEdit} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : <><Check aria-hidden="true" className="h-4 w-4" /> Save changes</>}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-5 sm:p-6">
              <SectionHeading icon={role === 'vendor' ? UtensilsCrossed : role === 'administrator' ? Shield : Building2} title="Role information" />
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-muted">Account role</span>
                  <Badge variant="secondary">{roleLabel}</Badge>
                </div>
                {role === 'administrator' ? (
                  <Alert variant="info">
                    Administrator privileges are managed by authorized system administrators and cannot be changed here.
                  </Alert>
                ) : role === 'vendor' ? (
                  <div className="space-y-3">
                    {vendorProfileLoading ? (
                      <LoadingState label="Loading business profile..." className="!p-4" />
                    ) : vendorProfileError ? (
                      <Alert variant="error">{vendorProfileError}</Alert>
                    ) : vendorProfile ? (
                      <>
                        <div>
                          <p className="text-xs text-text-muted">Business name</p>
                          <p className="font-semibold text-text-primary">{vendorProfile.businessName}</p>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-text-secondary">
                          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                          <span>{[vendorProfile.locality, vendorProfile.city, vendorProfile.serviceArea].filter(Boolean).join(', ') || 'Location not provided'}</span>
                        </div>
                        <Badge variant={vendorProfile.isAvailable ? 'success' : 'neutral'}>
                          {vendorProfile.isAvailable ? 'Accepting requests' : 'Not accepting requests'}
                        </Badge>
                      </>
                    ) : (
                      <p className="text-sm text-text-muted">No business profile has been set up yet.</p>
                    )}
                    <Link to="/vendor/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                      Manage business profile <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-text-muted">
                      {role === 'organizer' ? 'Organization' : 'College / organization'}
                    </p>
                    <p className="mt-1 font-semibold text-text-primary">
                      {user.organization || 'Not provided'}
                    </p>
                    {role === 'participant' && user.interests?.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {user.interests.map((interest) => <Badge key={interest}>{interest}</Badge>)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeading icon={CircleUserRound} title="Appearance" description="Choose how EventFlow looks on this device." />
              <label htmlFor="theme-preference" className="mb-1.5 block text-sm font-semibold text-text-secondary">
                Theme preference
              </label>
              <select
                id="theme-preference"
                value={preference}
                onChange={(event) => setThemePreference(event.target.value)}
                className="min-h-10 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-primary/20"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                System follows your device appearance setting. Your choice is saved locally and does not change account data.
              </p>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionHeading icon={LockKeyhole} title="Password" description="Reset your password using the existing secure email flow." />
              <p className="mb-4 text-sm leading-relaxed text-text-muted">
                Request a password reset link for the email address on your account.
              </p>
              <Link to="/forgot-password">
                <Button variant="outline" className="w-full">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                  Manage password
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
