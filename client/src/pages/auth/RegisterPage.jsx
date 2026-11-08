import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomePath } from '../../utils/roles';
import { FormField, Input, Textarea } from '../../components/ui/FormControls';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  Phone,
  Building,
  Loader2,
  AlertCircle,
  Calendar,
  Users,
  Store,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function RegisterPage() {
  const { register, submitting, authError, clearError } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    organization: '',
    role: 'participant',
    vendorApplication: {
      businessName: '',
      businessCategory: '',
      businessDescription: '',
      contactNumber: '',
      city: '',
      locality: '',
      servicesOffered: '',
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [clientErrors, setClientErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name is required (at least 2 characters).';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else {
      if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters long.';
      } else if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
        errors.password = 'Password must contain at least one letter and one number.';
      }
    }

    if (!['participant', 'organizer', 'vendor'].includes(formData.role)) {
      errors.role = 'Please select a valid registration role.';
    }

    if (formData.role === 'vendor') {
      const application = formData.vendorApplication;
      if (application.businessName.trim().length < 2 || application.businessName.trim().length > 120) {
        errors.businessName = 'Business name must be between 2 and 120 characters.';
      }
      if (application.businessCategory.trim().length < 2 || application.businessCategory.trim().length > 80) {
        errors.businessCategory = 'Business category must be between 2 and 80 characters.';
      }
      if (application.businessDescription.trim().length < 10 || application.businessDescription.trim().length > 1000) {
        errors.businessDescription = 'Description must be between 10 and 1,000 characters.';
      }
      const contactDigits = (application.contactNumber.match(/\d/g) || []).length;
      if (!/^[+()\d.\-\s]+$/.test(application.contactNumber.trim()) || contactDigits < 7 || contactDigits > 15) {
        errors.contactNumber = 'Enter a valid contact number with 7 to 15 digits.';
      }
      if (application.city.trim().length < 2 || application.city.trim().length > 100) {
        errors.city = 'City must be between 2 and 100 characters.';
      }
      if (application.locality.trim().length < 2 || application.locality.trim().length > 120) {
        errors.locality = 'Locality must be between 2 and 120 characters.';
      }
      const services = application.servicesOffered
        .split(/[,\n]/)
        .map((service) => service.trim())
        .filter(Boolean);
      if (services.length < 1 || services.length > 20 || services.some((service) => service.length < 2 || service.length > 80)) {
        errors.servicesOffered = 'List 1 to 20 services, each between 2 and 80 characters.';
      } else if (new Set(services.map((service) => service.toLowerCase())).size !== services.length) {
        errors.servicesOffered = 'Services offered must not contain duplicates.';
      }
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (clientErrors[name]) {
      setClientErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (authError) {
      clearError();
    }
  };

  const handleVendorChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      vendorApplication: { ...prev.vendorApplication, [name]: value },
    }));
    setClientErrors((prev) => ({ ...prev, [name]: '' }));
    if (authError) clearError();
  };

  const handleRoleSelect = (selectedRole) => {
    setFormData((prev) => ({ ...prev, role: selectedRole }));
    setClientErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const result = await register({
      name: formData.name.trim(),
      email: formData.email.trim(),
      password: formData.password,
      role: formData.role,
      phone: formData.phone.trim(),
      organization: formData.organization.trim(),
      ...(formData.role === 'vendor' && {
        vendorApplication: {
          ...formData.vendorApplication,
          servicesOffered: formData.vendorApplication.servicesOffered
            .split(/[,\n]/)
            .map((service) => service.trim())
            .filter(Boolean),
        },
      }),
    });

    if (result.success) {
      navigate(
        result.user?.role === 'vendor'
          ? '/vendor/application-status'
          : getRoleHomePath(result.user?.role),
        { replace: true }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200">
            EF
          </div>
          <span className="font-extrabold text-2xl text-text-primary tracking-tight">EventFlow</span>
        </Link>
        <h2 className="text-2xl font-bold text-text-primary tracking-tight">Create your account</h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose how you want to participate in EventFlow
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-surface py-8 px-6 sm:px-10 rounded-2xl border border-border shadow-sm">
          {/* Server Error Alert */}
          {authError && (
            <div
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-fadeIn"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{authError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Role selection */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Participant Card */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('participant')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    formData.role === 'participant'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100'
                      : 'border-border hover:border-border-strong bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-text-primary">Participant</span>
                    </div>
                    {formData.role === 'participant' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Discover upcoming campus events, inspect catering menus, and reserve seats.
                  </p>
                </button>

                {/* Organizer Card */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect('organizer')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    formData.role === 'organizer'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100'
                      : 'border-border hover:border-border-strong bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-text-primary">Event Organizer</span>
                    </div>
                    {formData.role === 'organizer' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Check venue availability, request catering services, and publish events.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleSelect('vendor')}
                  aria-pressed={formData.role === 'vendor'}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    formData.role === 'vendor'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-100'
                      : 'border-border hover:border-border-strong bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                        <Store className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-text-primary">Vendor</span>
                    </div>
                    {formData.role === 'vendor' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Share your business and services with event organizers.
                  </p>
                </button>
              </div>
              {clientErrors.role && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.role}</p>
              )}
            </div>

            {formData.role === 'vendor' && (
              <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4" aria-labelledby="vendor-application-heading">
                <div>
                  <h3 id="vendor-application-heading" className="font-semibold text-sm text-text-primary">
                    Business application
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    These details will be reviewed by an administrator. Vendor tools unlock after approval.
                  </p>
                </div>
                {[
                  ['businessName', 'Business name', 'text', 120],
                  ['businessCategory', 'Business category', 'text', 80],
                  ['contactNumber', 'Contact number', 'tel', 30],
                  ['city', 'City', 'text', 100],
                  ['locality', 'Locality', 'text', 120],
                ].map(([name, label, type, maxLength]) => (
                  <FormField key={name} id={name} label={label} required error={clientErrors[name]}>
                    <Input
                      name={name}
                      type={type}
                      maxLength={maxLength}
                      value={formData.vendorApplication[name]}
                      onChange={handleVendorChange}
                    />
                  </FormField>
                ))}
                <FormField
                  id="businessDescription"
                  label="Business description"
                  required
                  error={clientErrors.businessDescription}
                >
                  <Textarea
                    name="businessDescription"
                    rows={3}
                    maxLength={1000}
                    value={formData.vendorApplication.businessDescription}
                    onChange={handleVendorChange}
                  />
                </FormField>
                <FormField
                  id="servicesOffered"
                  label="Services offered"
                  required
                  error={clientErrors.servicesOffered}
                  description="Separate services with commas or new lines."
                >
                  <Textarea
                    name="servicesOffered"
                    rows={2}
                    maxLength={2000}
                    value={formData.vendorApplication.servicesOffered}
                    onChange={handleVendorChange}
                  />
                </FormField>
              </section>
            )}

            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Jane Doe or Alex Smith"
                  className={`block w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border bg-surface text-text-primary placeholder:text-text-muted transition-colors focus:outline-hidden focus:ring-2 ${
                    clientErrors.name
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-border focus:border-indigo-600 focus:ring-indigo-100'
                  }`}
                />
              </div>
              {clientErrors.name && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.name}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@institution.edu"
                  className={`block w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border bg-surface text-text-primary placeholder:text-text-muted transition-colors focus:outline-hidden focus:ring-2 ${
                    clientErrors.email
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-border focus:border-indigo-600 focus:ring-indigo-100'
                  }`}
                />
              </div>
              {clientErrors.email && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters with letters & numbers"
                  className={`block w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border bg-surface text-text-primary placeholder:text-text-muted transition-colors focus:outline-hidden focus:ring-2 ${
                    clientErrors.password
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-border focus:border-indigo-600 focus:ring-indigo-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-secondary focus:outline-hidden"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {clientErrors.password ? (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{clientErrors.password}</p>
              ) : (
                <p className="mt-1 text-[11px] text-text-muted">
                  Must be at least 8 characters and include both letters and numbers.
                </p>
              )}
            </div>

            {/* Optional Phone & Organization Fields in Two Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Phone <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1 (555) 000-0000"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="organization" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Department / Club <span className="text-text-muted font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Building className="w-4 h-4" />
                  </div>
                  <input
                    id="organization"
                    name="organization"
                    type="text"
                    value={formData.organization}
                    onChange={handleChange}
                    placeholder="e.g. Computer Science Dept"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-muted focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{formData.role === 'vendor' ? 'Submitting application...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  <span>{formData.role === 'vendor' ? 'Submit Vendor Application' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-text-muted">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
