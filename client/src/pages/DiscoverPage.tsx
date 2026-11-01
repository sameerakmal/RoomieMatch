import { useEffect, useState, useId } from 'react';
import { ArrowRight, Compass, Filter, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { preferencesService } from '../services/preferences';
import { matchingService } from '../services/matching';
import { apiError } from '../services/api';
import type { MatchDiscoveryItem, MatchesPagination, MatchFilters, PreferencesStatus } from '../types';

export function DiscoverPage() {
  const [prefStatus, setPrefStatus] = useState<PreferencesStatus | null>(null);
  const [checkingPref, setCheckingPref] = useState(true);

  const [matches, setMatches] = useState<MatchDiscoveryItem[]>([]);
  const [pagination, setPagination] = useState<MatchesPagination>({
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 1,
  });
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [city, setCity] = useState('');
  const [accommodationType, setAccommodationType] = useState('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [minBudget, setMinBudget] = useState<string>('');
  const [maxBudget, setMaxBudget] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const cityInputId = useId();
  const accomSelectId = useId();
  const minScoreSelectId = useId();
  const minBudgetId = useId();
  const maxBudgetId = useId();

  // 1. Check if user completed questionnaire
  useEffect(() => {
    const controller = new AbortController();
    preferencesService.getStatus(controller.signal)
      .then((status) => {
        setPrefStatus(status);
      })
      .catch((err) => {
        setError(apiError(err).message);
      })
      .finally(() => {
        setCheckingPref(false);
      });

    return () => controller.abort();
  }, []);

  // 2. Fetch matches when preferences are confirmed complete or when filters/page change
  useEffect(() => {
    if (!prefStatus || !prefStatus.isCompleted) return;

    const controller = new AbortController();
    setLoadingMatches(true);
    setError(null);

    const filters: MatchFilters = {
      page: currentPage,
      limit: 9,
    };
    if (city.trim()) filters.city = city.trim();
    if (accommodationType !== 'all') filters.accommodationType = accommodationType;
    if (minScore > 0) filters.minScore = minScore;
    if (minBudget && !Number.isNaN(Number(minBudget))) filters.minBudget = Number(minBudget);
    if (maxBudget && !Number.isNaN(Number(maxBudget))) filters.maxBudget = Number(maxBudget);

    matchingService.getMatches(filters, controller.signal)
      .then((res) => {
        setMatches(res.matches);
        setPagination(res.pagination);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(apiError(err).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingMatches(false);
        }
      });

    return () => controller.abort();
  }, [prefStatus, currentPage, city, accommodationType, minScore, minBudget, maxBudget]);

  const handleResetFilters = () => {
    setCity('');
    setAccommodationType('all');
    setMinScore(0);
    setMinBudget('');
    setMaxBudget('');
    setCurrentPage(1);
  };

  return (
    <DashboardLayout title="Roommate discovery">
      {/* Page Header */}
      <section className="discover-header">
        <p className="eyebrow">A curated search for your next home</p>
        <h1>
          Discover compatible <em>roommates.</em>
        </h1>
        <p className="discover-intro">
          Matches calculated deterministically from shared lifestyle rhythms, cleanliness expectations, sound boundaries, and budget alignment.
        </p>
      </section>

      {/* Case 1: Checking preferences status */}
      {checkingPref && (
        <div className="discover-loading-box">
          <LoadingState label="Preparing your roommate recommendations…" />
        </div>
      )}

      {/* Case 2: User questionnaire is incomplete */}
      {!checkingPref && prefStatus && !prefStatus.isCompleted && (
        <section className="discover-incomplete-card">
          <div className="incomplete-icon">
            <SlidersHorizontal size={28} />
          </div>
          <h2>Questionnaire required for discovery</h2>
          <p>
            RoomieMatch pairs roommates based on everyday living compatibility. Please complete all five sections of your lifestyle questionnaire so our algorithm can match you with eligible candidates.
          </p>
          <div className="incomplete-progress-bar">
            <span>{prefStatus.completedSections} of 5 sections completed ({prefStatus.percent}%)</span>
            <div className="progress-track">
              <span style={{ width: `${prefStatus.percent}%` }} />
            </div>
          </div>
          <ButtonLink to="/preferences" variant="primary">
            Complete your preferences <ArrowRight size={16} />
          </ButtonLink>
        </section>
      )}

      {/* Case 3: Questionnaire is complete - Filter Bar and Results */}
      {!checkingPref && prefStatus && prefStatus.isCompleted && (
        <>
          {/* Filters Bar */}
          <section className="discover-filters-section" aria-label="Discovery filters">
            <div className="filters-header">
              <div className="filters-title">
                <Filter size={16} />
                <span>Filter candidates</span>
              </div>
              <button
                type="button"
                className="filter-reset-btn"
                onClick={handleResetFilters}
              >
                <RefreshCw size={14} /> Reset
              </button>
            </div>

            <div className="filters-grid">
              <div className="filter-group">
                <label htmlFor={cityInputId}>City</label>
                <input
                  id={cityInputId}
                  type="text"
                  placeholder="e.g. Mumbai, Bengaluru"
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label htmlFor={accomSelectId}>Accommodation</label>
                <select
                  id={accomSelectId}
                  value={accommodationType}
                  onChange={(e) => {
                    setAccommodationType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="all">Any accommodation</option>
                  <option value="apartment">Apartment</option>
                  <option value="pg">Paying Guest (PG)</option>
                  <option value="shared-house">Shared House</option>
                  <option value="hostel">Hostel</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor={minScoreSelectId}>Min. Compatibility</label>
                <select
                  id={minScoreSelectId}
                  value={minScore}
                  onChange={(e) => {
                    setMinScore(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="filter-select"
                >
                  <option value={0}>All matches</option>
                  <option value={70}>70% and above</option>
                  <option value={80}>80% and above</option>
                  <option value={85}>85% and above (High)</option>
                  <option value={90}>90% and above (Exceptional)</option>
                </select>
              </div>

              <div className="filter-group budget-filter-group">
                <label htmlFor={minBudgetId}>Budget range (₹)</label>
                <div className="budget-inputs">
                  <input
                    id={minBudgetId}
                    type="number"
                    placeholder="Min"
                    value={minBudget}
                    onChange={(e) => {
                      setMinBudget(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="filter-input small"
                  />
                  <span>–</span>
                  <input
                    id={maxBudgetId}
                    type="number"
                    placeholder="Max"
                    value={maxBudget}
                    onChange={(e) => {
                      setMaxBudget(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="filter-input small"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Results Area */}
          {error && (
            <div className="form-message form-message-error" role="alert">
              {error}
            </div>
          )}

          {loadingMatches ? (
            <div className="discover-loading-box">
              <LoadingState label="Calculating roommate compatibility…" />
            </div>
          ) : matches.length === 0 ? (
            <section className="discover-empty-state">
              <div className="empty-icon">
                <Compass size={32} />
              </div>
              <h3>No compatible roommates found</h3>
              <p>
                We could not find candidates matching your exact criteria who satisfy all mutual living requirements.
                Try adjusting your city or budget filters, or check back as more residents complete their profiles.
              </p>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleResetFilters}
              >
                Clear all filters
              </button>
            </section>
          ) : (
            <>
              <div className="matches-count-bar">
                <span>
                  Showing {matches.length} of {pagination.total} compatible {pagination.total === 1 ? 'roommate' : 'roommates'}
                </span>
              </div>

              <div className="matches-grid">
                {matches.map(({ candidate, compatibility }) => (
                  <article key={candidate.id} className="candidate-card">
                    <div className="candidate-card-header">
                      <div className="candidate-avatar-wrap">
                        <ProfileAvatar
                          name={candidate.name}
                          url={candidate.profile.profilePhotoUrl}
                          large
                        />
                      </div>
                      <div className="candidate-title-block">
                        <div className="candidate-name-row">
                          <h3>{candidate.name}</h3>
                          {candidate.profile.age && (
                            <span className="candidate-age">{candidate.profile.age} yrs</span>
                          )}
                        </div>
                        <p className="candidate-location">
                          {candidate.profile.city || 'Location flexible'} · {candidate.profile.occupation || 'Resident'}
                        </p>
                      </div>
                    </div>

                    {candidate.profile.bio && (
                      <p className="candidate-bio">“{candidate.profile.bio}”</p>
                    )}

                    {/* Compatibility Badge & Summary */}
                    <div className="candidate-score-block">
                      <div className="score-badge">
                        <Sparkles size={14} />
                        <strong>{compatibility.overallScore}%</strong>
                        <span>Compatibility</span>
                      </div>
                      <p className="score-summary">{compatibility.summary}</p>
                    </div>

                    {/* Top Strengths */}
                    {compatibility.strengths.length > 0 && (
                      <div className="candidate-strengths">
                        <p className="strengths-label">Key shared traits</p>
                        <ul>
                          {compatibility.strengths.slice(0, 3).map((strength, idx) => (
                            <li key={idx}>
                              <span className="strength-bullet" />
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* View Details CTA */}
                    <div className="candidate-card-footer">
                      <ButtonLink
                        to={`/discover/${candidate.id}`}
                        variant="secondary"
                        className="candidate-view-btn"
                      >
                        View compatibility breakdown <ArrowRight size={15} />
                      </ButtonLink>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <nav className="pagination-bar" aria-label="Matches pagination">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={pagination.page <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
