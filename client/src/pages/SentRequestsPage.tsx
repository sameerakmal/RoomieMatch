import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock, Compass, Inbox, MessageSquare, Send, Sparkles, UserCheck, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { connectionsService } from '../services/connections';
import { apiError } from '../services/api';
import type { MatchesPagination, SentRequestItem } from '../types';

export function SentRequestsPage() {
  const [requests, setRequests] = useState<SentRequestItem[]>([]);
  const [pagination, setPagination] = useState<MatchesPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSent = (page: number) => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    connectionsService
      .getSentRequests(page, 10, undefined, controller.signal)
      .then((data) => {
        setRequests(data.requests);
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
  };

  useEffect(() => {
    return fetchSent(currentPage);
  }, [currentPage]);

  const handleCancel = async (id: string, recipientName: string) => {
    setCancellingId(id);
    setError(null);
    setFeedback(null);
    try {
      await connectionsService.cancelRequest(id);
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)),
      );
      setFeedback(`Connection request to ${recipientName} has been cancelled.`);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setCancellingId(null);
    }
  };

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

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="status-badge status-accepted">
            <UserCheck size={13} /> Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge status-rejected">
            <XCircle size={13} /> Declined
          </span>
        );
      case 'cancelled':
        return (
          <span className="status-badge status-cancelled">
            <X size={13} /> Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="status-badge status-pending">
            <Clock size={13} /> Awaiting response
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="Sent requests">
      {/* Page Header */}
      <section className="requests-header">
        <p className="eyebrow">Roommate networking</p>
        <h1>
          Sent <em>requests.</em>
        </h1>
        <p className="requests-intro">
          Track connection requests you’ve dispatched to potential roommates and check their current status.
        </p>

        {/* Navigation Tabs */}
        <div className="requests-tabs" role="tablist">
          <Link to="/requests" className="requests-tab" aria-selected="false">
            <Inbox size={15} /> Incoming requests
          </Link>
          <Link to="/requests/sent" className="requests-tab active" aria-selected="true">
            <Send size={15} /> Sent requests {pagination.total > 0 && <span className="tab-pill">{pagination.total}</span>}
          </Link>
        </div>
      </section>

      {/* Feedback & Error */}
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

      {/* Main Content */}
      {loading ? (
        <div className="discover-loading-box">
          <LoadingState label="Loading sent connection requests…" />
        </div>
      ) : requests.length === 0 ? (
        <section className="discover-empty-state">
          <div className="empty-icon">
            <Send size={32} />
          </div>
          <h3>No requests sent yet</h3>
          <p>
            When you discover someone who shares your habits and lifestyle, send a connection request with an introduction note.
          </p>
          <ButtonLink to="/discover" variant="primary">
            Explore compatible roommates <Compass size={15} />
          </ButtonLink>
        </section>
      ) : (
        <>
          <div className="requests-count-bar">
            <span>
              Showing {requests.length} of {pagination.total} sent {pagination.total === 1 ? 'request' : 'requests'}
            </span>
          </div>

          <div className="requests-list">
            {requests.map((req) => {
              const recipient = req.recipient;
              if (!recipient) return null;

              return (
                <article key={req.id} className="request-card">
                  <div className="request-card-head">
                    <div className="request-sender-info">
                      <ProfileAvatar
                        name={recipient.name}
                        url={recipient.profile.profilePhotoUrl}
                        large
                      />
                      <div>
                        <div className="request-title-row">
                          <h3>{recipient.name}</h3>
                          {recipient.profile.age && (
                            <span className="candidate-age">{recipient.profile.age} yrs</span>
                          )}
                          {renderStatusBadge(req.status)}
                        </div>
                        <p className="request-subline">
                          {recipient.profile.city || 'Location flexible'} · {recipient.profile.occupation || 'Resident'}
                        </p>
                        <span className="request-date">Sent on {formatDate(req.createdAt)}</span>
                      </div>
                    </div>

                    {req.compatibility?.overallScore !== null && req.compatibility?.overallScore !== undefined && (
                      <div className="request-score-badge">
                        <Sparkles size={14} />
                        <strong>{req.compatibility.overallScore}%</strong>
                        <span>Compatibility</span>
                      </div>
                    )}
                  </div>

                  {recipient.profile.bio && (
                    <p className="request-bio">“{recipient.profile.bio}”</p>
                  )}

                  {req.message && (
                    <div className="request-intro-box">
                      <div className="intro-label">
                        <MessageSquare size={13} />
                        <span>Your introduction note:</span>
                      </div>
                      <p className="intro-text">“{req.message}”</p>
                    </div>
                  )}

                  <div className="request-card-footer">
                    <div className="request-actions">
                      {req.status === 'pending' && (
                        <button
                          type="button"
                          className="button button-secondary btn-cancel-request"
                          disabled={cancellingId === req.id}
                          onClick={() => handleCancel(req.id, recipient.name)}
                        >
                          {cancellingId === req.id ? (
                            <LoadingState label="Cancelling…" />
                          ) : (
                            <>
                              Cancel request <X size={15} />
                            </>
                          )}
                        </button>
                      )}
                      {req.status === 'accepted' && (
                        <ButtonLink
                          to={`/connections/${req.id}`}
                          variant="secondary"
                          className="btn-connected"
                        >
                          <UserCheck size={14} /> View connection
                        </ButtonLink>
                      )}
                    </div>

                    <ButtonLink
                      to={`/discover/${recipient.id}`}
                      variant="text"
                      className="request-view-profile"
                    >
                      View profile &amp; compatibility <ArrowRight size={15} />
                    </ButtonLink>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <nav className="pagination-bar" aria-label="Requests pagination">
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

