import { useEffect, useState } from 'react';
import { ArrowRight, Compass, Sparkles, UserCheck, Users } from 'lucide-react';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { connectionsService } from '../services/connections';
import { apiError } from '../services/api';
import type { AcceptedConnectionItem, MatchesPagination } from '../types';

export function ConnectionsPage() {
  const [connections, setConnections] = useState<AcceptedConnectionItem[]>([]);
  const [pagination, setPagination] = useState<MatchesPagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    connectionsService
      .getConnections(currentPage, 12, controller.signal)
      .then((data) => {
        setConnections(data.connections);
        setPagination(data.pagination);
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
  }, [currentPage]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <DashboardLayout title="My connections">
      {/* Page Header */}
      <section className="connections-header">
        <p className="eyebrow">Your roommate network</p>
        <h1>
          Connected <em>roommates.</em>
        </h1>
        <p className="connections-intro">
          People you’ve agreed to connect with. Review shared compatibility breakdowns and lifestyle alignment as you plan your living arrangements.
        </p>
      </section>

      {/* Error State */}
      {error && (
        <div className="form-message form-message-error" role="alert">
          {error}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="discover-loading-box">
          <LoadingState label="Loading your roommate connections…" />
        </div>
      ) : connections.length === 0 ? (
        <section className="discover-empty-state">
          <div className="empty-icon">
            <Users size={32} />
          </div>
          <h3>No accepted connections yet</h3>
          <p>
            When you and another candidate mutually accept each other’s connection requests, they will appear here as part of your roommate network.
          </p>
          <div className="empty-actions">
            <ButtonLink to="/discover" variant="primary">
              Explore compatible roommates <Compass size={15} />
            </ButtonLink>
            <ButtonLink to="/requests" variant="secondary">
              Check incoming requests
            </ButtonLink>
          </div>
        </section>
      ) : (
        <>
          <div className="connections-count-bar">
            <span>
              You have {pagination.total} accepted {pagination.total === 1 ? 'connection' : 'connections'}
            </span>
          </div>

          <div className="connections-grid">
            {connections.map((item) => {
              const user = item.user;
              if (!user) return null;

              return (
                <article key={item.id} className="connection-card">
                  <div className="connection-card-head">
                    <ProfileAvatar
                      name={user.name}
                      url={user.profile.profilePhotoUrl}
                      large
                    />
                    <div className="connection-title-block">
                      <div className="connection-name-row">
                        <h3>{user.name}</h3>
                        {user.profile.age && (
                          <span className="candidate-age">{user.profile.age} yrs</span>
                        )}
                      </div>
                      <p className="connection-meta">
                        {user.profile.city || 'Location flexible'} · {user.profile.occupation || 'Resident'}
                      </p>
                      <span className="connection-date-badge">
                        <UserCheck size={12} /> Connected {formatDate(item.connectedAt)}
                      </span>
                    </div>
                  </div>

                  {user.profile.bio && (
                    <p className="connection-bio">“{user.profile.bio}”</p>
                  )}

                  {/* Compatibility score pill */}
                  {item.compatibility?.overallScore !== null && item.compatibility?.overallScore !== undefined && (
                    <div className="connection-score-row">
                      <div className="score-badge">
                        <Sparkles size={13} />
                        <strong>{item.compatibility.overallScore}%</strong>
                        <span>Compatibility</span>
                      </div>
                      {item.compatibility.summary && (
                        <p className="connection-score-summary">{item.compatibility.summary}</p>
                      )}
                    </div>
                  )}

                  {/* Top strengths */}
                  {item.compatibility?.strengths && item.compatibility.strengths.length > 0 && (
                    <div className="connection-strengths">
                      <p className="strengths-label">Shared alignment</p>
                      <ul>
                        {item.compatibility.strengths.slice(0, 2).map((str, idx) => (
                          <li key={idx}>
                            <span className="strength-bullet" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="connection-card-footer">
                    <ButtonLink
                      to={`/connections/${item.id}`}
                      variant="secondary"
                      className="connection-view-btn"
                    >
                      View connection details <ArrowRight size={15} />
                    </ButtonLink>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <nav className="pagination-bar" aria-label="Connections pagination">
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
    </DashboardLayout>
  );
}

