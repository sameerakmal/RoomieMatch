import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, AlertCircle, Clock, HeartHandshake, HelpCircle, Moon, ShieldCheck, Sparkles, UserCheck, UserPlus, Users, Volume2, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { ConnectModal } from '../components/ConnectModal';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { matchingService } from '../services/matching';
import { connectionsService } from '../services/connections';
import { apiError } from '../services/api';
import type { CategoryKey, MatchDetailResponse } from '../types';

const CATEGORY_META: Record<CategoryKey, { title: string; icon: typeof Moon; weight: number }> = {
  sleep: { title: 'Sleep & Daily Routine', icon: Moon, weight: 20 },
  cleanliness: { title: 'Cleanliness Standards', icon: Sparkles, weight: 20 },
  noise: { title: 'Noise & Quiet Hours', icon: Volume2, weight: 15 },
  guests: { title: 'Guests & Social Rhythms', icon: Users, weight: 15 },
  budget: { title: 'Budget & Accommodation', icon: Wallet, weight: 20 },
  lifestyle: { title: 'Other Lifestyle Preferences', icon: HeartHandshake, weight: 10 },
};

function getScoreTier(score: number): { label: string; className: string } {
  if (score >= 80) return { label: 'Strong alignment', className: 'tier-strong' };
  if (score >= 65) return { label: 'Moderate alignment', className: 'tier-moderate' };
  return { label: 'Notable difference', className: 'tier-difference' };
}

export function MatchDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<MatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    matchingService.getMatchDetails(userId, controller.signal)
      .then((res) => {
        setData(res);
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
  }, [userId]);

  const handleSendConnection = async (message: string) => {
    if (!data) return;
    const res = await connectionsService.sendRequest(data.candidate.id, message);
    setData({
      ...data,
      connection: {
        id: res.connection.id,
        status: 'pending',
        direction: 'sent',
      },
    });
    setFeedback(`Connection request sent to ${data.candidate.name}.`);
  };

  const handleAcceptRequest = async () => {
    if (!data || !data.connection) return;
    setActionBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await connectionsService.acceptRequest(data.connection.id);
      setData({
        ...data,
        connection: {
          ...data.connection,
          status: 'accepted',
        },
      });
      setFeedback(`You are now connected with ${data.candidate.name}!`);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Compatibility breakdown">
        <div className="discover-loading-box">
          <LoadingState label="Calculating detailed compatibility breakdown…" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout title="Compatibility breakdown">
        <div className="match-detail-error">
          <p className="form-message form-message-error" role="alert">
            {error || 'Unable to retrieve compatibility details.'}
          </p>
          <ButtonLink to="/discover" variant="secondary">
            <ArrowLeft size={16} /> Back to roommate discovery
          </ButtonLink>
        </div>
      </DashboardLayout>
    );
  }

  const { candidate, compatibility } = data;
  const overallTier = getScoreTier(compatibility.overallScore ?? 0);

  return (
    <DashboardLayout title={`Compatibility with ${candidate.name}`}>
      {/* Back button */}
      <div className="match-detail-nav">
        <Link to="/discover" className="back-link">
          <ArrowLeft size={16} /> Back to roommate discovery
        </Link>
      </div>

      {feedback && (
        <div className="form-message form-message-success" role="status">
          <Check size={16} /> {feedback}
        </div>
      )}
      {error && (
        <div className="form-message form-message-error" role="alert">
          {error}
        </div>
      )}

      {/* Candidate Profile Summary Banner */}
      <section className="match-profile-banner">
        <div className="match-avatar-col">
          <ProfileAvatar
            name={candidate.name}
            url={candidate.profile.profilePhotoUrl}
            large
          />
        </div>
        <div className="match-info-col">
          <p className="eyebrow">Compatibility Report</p>
          <h1>{candidate.name}</h1>
          <p className="match-details-meta">
            {candidate.profile.city || 'Location flexible'} · {candidate.profile.occupation || 'Resident'}
            {candidate.profile.age ? ` · ${candidate.profile.age} years old` : ''}
            {candidate.profile.moveInDate ? ` · Move-in: ${candidate.profile.moveInDate}` : ''}
          </p>
          {candidate.profile.bio && (
            <p className="match-bio">“{candidate.profile.bio}”</p>
          )}

          {/* Action button */}
          <div className="match-action-row">
            {data.connection?.status === 'accepted' ? (
              <ButtonLink
                to={`/connections/${data.connection.id}`}
                variant="secondary"
                className="btn-connected"
              >
                <UserCheck size={15} /> Connected
              </ButtonLink>
            ) : data.connection?.status === 'pending' && data.connection.direction === 'sent' ? (
              <button
                type="button"
                disabled
                className="button button-secondary btn-pending"
              >
                <Clock size={15} /> Connection request pending
              </button>
            ) : data.connection?.status === 'pending' && data.connection.direction === 'received' ? (
              <button
                type="button"
                className="button button-primary btn-accept"
                disabled={actionBusy}
                onClick={handleAcceptRequest}
              >
                {actionBusy ? <LoadingState label="Accepting…" /> : <>Accept connection request <Check size={15} /></>}
              </button>
            ) : (
              <button
                type="button"
                className="button button-primary btn-connect"
                onClick={() => setIsConnectOpen(true)}
              >
                Connect with {candidate.name.split(' ')[0]} <UserPlus size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Overall Score Card */}
        <div className="match-score-card">
          <div className="score-number-group">
            <span className="score-big">{compatibility.overallScore}%</span>
            <span className={`score-tier-badge ${overallTier.className}`}>
              {overallTier.label}
            </span>
          </div>
          <p className="score-subtext">Overall Compatibility</p>
          <div className="coverage-indicator">
            <span>{compatibility.dataCoverage}% data coverage</span>
          </div>
        </div>
      </section>

      {/* Algorithm Summary & Scientific Disclaimer */}
      <section className="match-summary-callout">
        <p className="summary-main">{compatibility.summary}</p>
        <p className="disclaimer-text">
          <strong>Note:</strong> Compatibility scores are estimates derived deterministically from lifestyle questionnaire responses across daily schedules, quiet hours, cleanliness, and living habits. They are intended as a thoughtful conversation guide, not a guarantee of co-living success.
        </p>
      </section>

      {/* Two Column Grid: Category Scores & Deep Dives */}
      <div className="match-detail-grid">
        {/* Left Column: Category Score Breakdown */}
        <div className="match-categories-col">
          <section className="detail-card">
            <div className="card-heading">
              <p className="eyebrow">01 — Category Breakdown</p>
              <h2>How your lifestyles align</h2>
            </div>

            <div className="categories-list">
              {(Object.keys(CATEGORY_META) as CategoryKey[]).map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const catScore = compatibility.categories[catKey];
                const Icon = meta.icon;
                const tier = catScore?.isAvailable
                  ? getScoreTier(catScore.score)
                  : { label: 'Not provided', className: 'tier-unavailable' };

                return (
                  <div key={catKey} className="category-row">
                    <div className="cat-row-top">
                      <div className="cat-title-block">
                        <Icon size={16} className="cat-icon" />
                        <strong>{meta.title}</strong>
                        <span className="cat-weight">({meta.weight}% weight)</span>
                      </div>
                      <div className="cat-score-block">
                        <span className={`cat-tier-badge ${tier.className}`}>
                          {tier.label}
                        </span>
                        <strong className="cat-score-num">
                          {catScore?.isAvailable ? `${catScore.score}%` : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    {/* Score Bar Meter */}
                    <div
                      className="cat-track"
                      role="progressbar"
                      aria-label={meta.title}
                      aria-valuenow={catScore?.isAvailable ? catScore.score : 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className={`cat-fill ${tier.className}`}
                        style={{ width: `${catScore?.isAvailable ? catScore.score : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Mutual Hard Constraints Evaluation */}
          <section className="detail-card">
            <div className="card-heading">
              <p className="eyebrow">02 — Living Conditions</p>
              <h2>Mutual hard constraints check</h2>
              <p className="card-subtitle">
                Strict requirements evaluated in both directions to prevent non-negotiable living conflicts.
              </p>
            </div>

            <div className="constraints-list">
              {compatibility.constraints.length === 0 ? (
                <p className="no-constraints-note">
                  No strict requirements were flagged by either party. All standard living conditions are open to mutual arrangement.
                </p>
              ) : (
                compatibility.constraints.map((constraint, idx) => (
                  <div key={idx} className={`constraint-item status-${constraint.status}`}>
                    <div className="constraint-header">
                      <div className="constraint-title">
                        {constraint.status === 'passed' && (
                          <CheckCircle2 size={16} className="icon-passed" />
                        )}
                        {constraint.status === 'failed' && (
                          <AlertCircle size={16} className="icon-failed" />
                        )}
                        {constraint.status === 'unknown' && (
                          <HelpCircle size={16} className="icon-unknown" />
                        )}
                        <strong>{constraint.name}</strong>
                      </div>
                      <span className={`constraint-badge badge-${constraint.status}`}>
                        {constraint.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="constraint-explanation">{constraint.explanation}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Strengths, Differences & Budget Overlap */}
        <div className="match-insights-col">
          {/* Budget Overlap Card */}
          <section className="detail-card budget-overlap-card">
            <div className="card-heading">
              <p className="eyebrow">Financial Alignment</p>
              <h2>Monthly rental budget</h2>
            </div>
            <div className="budget-comparison-box">
              <div className="budget-range-pill">
                {compatibility.budgetOverlap.hasOverlap ? (
                  <>
                    <span className="budget-overlap-label">Mutually Viable Range:</span>
                    <strong>
                      ₹{compatibility.budgetOverlap.min?.toLocaleString()} – ₹{compatibility.budgetOverlap.max?.toLocaleString()} / mo
                    </strong>
                  </>
                ) : (
                  <span className="budget-no-overlap">No direct overlapping budget range</span>
                )}
              </div>
              <p className="budget-explanation">{compatibility.budgetOverlap.explanation}</p>
            </div>
          </section>

          {/* Key Strengths */}
          <section className="detail-card strengths-card">
            <div className="card-heading">
              <p className="eyebrow">Shared Rhythms</p>
              <h2>Strongest compatibility areas</h2>
            </div>
            {compatibility.strengths.length > 0 ? (
              <ul className="insights-list strengths-list">
                {compatibility.strengths.map((str, idx) => (
                  <li key={idx}>
                    <ShieldCheck size={16} className="insight-icon olive" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="insights-empty">No standout shared rhythms recorded.</p>
            )}
          </section>

          {/* Potential Differences */}
          <section className="detail-card differences-card">
            <div className="card-heading">
              <p className="eyebrow">Worth Discussing</p>
              <h2>Potential lifestyle differences</h2>
            </div>
            {compatibility.differences.length > 0 ? (
              <ul className="insights-list differences-list">
                {compatibility.differences.map((diff, idx) => (
                  <li key={idx}>
                    <AlertCircle size={16} className="insight-icon terracotta" />
                    <span>{diff}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="insights-empty">
                No major lifestyle divergences detected. Your recorded preferences are remarkably cohesive.
              </p>
            )}
          </section>
        </div>
      </div>

      {isConnectOpen && (
        <ConnectModal
          candidate={candidate}
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          onSend={handleSendConnection}
        />
      )}
    </DashboardLayout>
  );
}
