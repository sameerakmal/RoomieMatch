import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Volume2,
  Wallet,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { connectionsService } from '../services/connections';
import { apiError } from '../services/api';
import type { ConnectionDetail } from '../types';

export function ConnectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [connection, setConnection] = useState<ConnectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    connectionsService
      .getConnectionById(id, controller.signal)
      .then((data) => {
        setConnection(data.connection);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(apiError(err).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Connection details">
        <div className="discover-loading-box">
          <LoadingState label="Loading connection details…" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !connection) {
    return (
      <DashboardLayout title="Connection details">
        <div className="match-detail-error">
          <p className="form-message form-message-error" role="alert">
            {error || 'Unable to load connection details.'}
          </p>
          <ButtonLink to="/connections" variant="secondary">
            <ArrowLeft size={16} /> Back to my connections
          </ButtonLink>
        </div>
      </DashboardLayout>
    );
  }

  const { user, compatibility, sharedLifestyle, respondedAt, createdAt, message } = connection;

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Pending';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <DashboardLayout title={`Connection with ${user.name}`}>
      {/* Navigation */}
      <div className="match-detail-nav">
        <Link to="/connections" className="back-link">
          <ArrowLeft size={16} /> Back to my connections
        </Link>
      </div>

      {/* Banner */}
      <section className="match-profile-banner">
        <div className="match-avatar-col">
          <ProfileAvatar
            name={user.name}
            url={user.profile.profilePhotoUrl}
            large
          />
        </div>
        <div className="match-info-col">
          <p className="eyebrow">Connected Roommate</p>
          <h1>{user.name}</h1>
          <p className="match-details-meta">
            {user.profile.city || 'Location flexible'} · {user.profile.occupation || 'Resident'}
            {user.profile.age ? ` · ${user.profile.age} years old` : ''}
            {user.profile.moveInDate ? ` · Move-in: ${user.profile.moveInDate}` : ''}
          </p>
          {user.profile.bio && <p className="match-bio">“{user.profile.bio}”</p>}

          <div className="connection-meta-badges">
            <span className="status-badge status-accepted">
              <UserCheck size={14} /> Connected since {formatDate(respondedAt || createdAt)}
            </span>
          </div>
        </div>

        {/* Score Card */}
        {compatibility?.overallScore !== null && compatibility?.overallScore !== undefined && (
          <div className="match-score-card">
            <div className="score-number-group">
              <span className="score-big">{compatibility.overallScore}%</span>
              <span className="score-tier-badge tier-strong">Matched</span>
            </div>
            <p className="score-subtext">Overall Compatibility</p>
            <div className="coverage-indicator">
              <span>{compatibility.dataCoverage}% data coverage</span>
            </div>
          </div>
        )}
      </section>

      {/* Introduction note if any */}
      {message && (
        <section className="match-summary-callout">
          <div className="intro-label">
            <MessageSquare size={14} />
            <strong>Introduction message exchanged:</strong>
          </div>
          <p className="summary-main">“{message}”</p>
        </section>
      )}

      {/* Compatibility Summary */}
      {compatibility && (
        <section className="detail-card">
          <div className="card-heading">
            <p className="eyebrow">Lifestyle Overview</p>
            <h2>Compatibility assessment</h2>
          </div>
          <p className="connection-summary-text">{compatibility.summary}</p>
        </section>
      )}

      {/* Shared Lifestyle Preferences Grid */}
      <div className="match-detail-grid">
        <div className="match-categories-col">
          <section className="detail-card">
            <div className="card-heading">
              <p className="eyebrow">Shared Living Alignment</p>
              <h2>Everyday habits &amp; routines</h2>
            </div>

            {sharedLifestyle && sharedLifestyle.length > 0 ? (
              <div className="shared-lifestyle-list">
                {sharedLifestyle.map((item, idx) => (
                  <div key={idx} className="shared-lifestyle-item">
                    <div className="lifestyle-icon-col">
                      {item.category.includes('Sleep') ? (
                        <Moon size={18} className="olive" />
                      ) : item.category.includes('Cleanliness') ? (
                        <Sparkles size={18} className="olive" />
                      ) : item.category.includes('Noise') ? (
                        <Volume2 size={18} className="olive" />
                      ) : (
                        <Wallet size={18} className="olive" />
                      )}
                    </div>
                    <div className="lifestyle-content-col">
                      <strong>{item.category}</strong>
                      <p>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="insights-empty">Both users have aligned mutual lifestyle expectations.</p>
            )}
          </section>
        </div>

        {/* Right Column: Strengths & Differences */}
        <div className="match-insights-col">
          {/* Shared Strengths */}
          {compatibility?.strengths && compatibility.strengths.length > 0 && (
            <section className="detail-card strengths-card">
              <div className="card-heading">
                <p className="eyebrow">Strengths</p>
                <h2>Where your habits harmonize</h2>
              </div>
              <ul className="insights-list strengths-list">
                {compatibility.strengths.map((str, idx) => (
                  <li key={idx}>
                    <ShieldCheck size={16} className="insight-icon olive" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Potential Differences */}
          {compatibility?.differences && compatibility.differences.length > 0 && (
            <section className="detail-card differences-card">
              <div className="card-heading">
                <p className="eyebrow">Good to Discuss</p>
                <h2>Lifestyle nuances</h2>
              </div>
              <ul className="insights-list differences-list">
                {compatibility.differences.map((diff, idx) => (
                  <li key={idx}>
                    <AlertCircle size={16} className="insight-icon terracotta" />
                    <span>{diff}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Budget Mutuality */}
          {compatibility?.budgetOverlap && (
            <section className="detail-card budget-overlap-card">
              <div className="card-heading">
                <p className="eyebrow">Housing Alignment</p>
                <h2>Budget mutuality</h2>
              </div>
              <p className="budget-explanation">{compatibility.budgetOverlap.explanation}</p>
              {compatibility.budgetOverlap.hasOverlap && (
                <div className="budget-range-pill">
                  <span>Viable range:</span>
                  <strong>
                    ₹{compatibility.budgetOverlap.min?.toLocaleString()} – ₹{compatibility.budgetOverlap.max?.toLocaleString()} / mo
                  </strong>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
