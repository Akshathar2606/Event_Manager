import React, { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LandingNavigation from '../../components/landing/LandingNavigation';
import LandingHero from '../../components/landing/LandingHero';
import LandingSections from '../../components/landing/LandingSections';
import LandingFooter from '../../components/landing/LandingFooter';
import './LandingPage.css';

export default function LandingPage() {
  const { isAuthenticated, loading, getHomePath } = useAuth();
  const pageRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    if (!page || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    page.querySelectorAll('[data-reveal]').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-text-muted">
        Loading EventFlow...
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={getHomePath()} replace />;

  return (
    <div ref={pageRef} className="landing-page min-h-screen overflow-hidden bg-background text-text-primary">
      <LandingNavigation />
      <main>
        <LandingHero />
        <LandingSections />
      </main>
      <LandingFooter />
    </div>
  );
}
