import { useEffect, useState } from 'react';
import { ArrowRight, Check, Compass, Inbox, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { connectionsService } from '../services/connections';
import { apiError } from '../services/api';
import type { MatchesPagination, ReceivedRequestItem } from '../types';

export function IncomingRequestsPage() {
  const [requests, setRequests] = useState<ReceivedRequestItem[]>([]);
  const [pagination, setPagination] = useState<MatchesPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRequests = (page: number) => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    connectionsService
      .getReceivedRequests(page, 10, controller.signal)
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
    return fetchRequests(currentPage);
  }, [currentPage]);

  const handleAccept = async (id: string, senderName: string) => {
    setActionBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      await connectionsService.acceptRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setFeedback(`You have accepted the connection request from ${senderName}.`);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDecline = async (id: string, senderName: string) => {
    setActionBusyId(id);
    setError(null);
    setFeedback(null);
    try {
      await connectionsService.rejectRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      setPagination((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setFeedback(`Declined request from ${senderName}.`);
    } catch (err) {
      setError(apiError(err).message);
    } finally {
      setActionBusyId(null);
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

  return (
    <DashboardLayout title="Connection requests">
      {/* Page Header */}
      <section className="requests-header">
        <p className="eyebrow">Roommate networking</p>
        <h1>
          Connection <em>requests.</em>
        </h1>
        <p className="requests-intro">
          Review incoming roommate interest, read personal introductions, and accept requests to start networking.
        </p>

        {/* Navigation Tabs */}
        <div className="requests-tabs" role="tablist">
          <Link to="/requests" className="requests-tab active" aria-selected="true">
            <Inbox size={15} /> Incoming requests {pagination.total > 0 && <span className="tab-pill">{pagination.total}</span>}
          </Link>
          <Link to="/requests/sent" className="requests-tab" aria-selected="false">
            <Send size={15} /> Sent requests
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
          <LoadingState label="Loading incoming connection requests…" />
        </div>
      ) : requests.length === 0 ? (
        <section className="discover-empty-state">
          <div className="empty-icon">
            <Inbox size={32} />
          </div>
          <h3>No incoming connection requests</h3>
          <p>
            When other compatible roommates discover your profile and reach out, their requests and introductions will appear here.
          </p>
          <ButtonLink to="/discover" variant="primary">
            Explore compatible roommates <Compass size={15} />
          </ButtonLink>
        </section>
      ) : (
        <>
          <div className="requests-count-bar">
            <span>
              {pagination.total} pending {pagination.total === 1 ? 'request' : 'requests'} waiting for your response
            </span>
          </div>

          <div className="requests-list">
            {requests.map((req) => {
              const sender = req.sender;
              if (!sender) return null;

              return (
                <article key={req.id} className="request-card">
                  <div className="request-card-head">
                    <div className="request-sender-info">
                      <ProfileAvatar
                        name={sender.name}
                        url={sender.profile.profilePhotoUrl}
                        large
                      />
                      <div>
                        <div className="request-title-row">
                          <h3>{sender.name}</h3>
                          {sender.profile.age && (
                            <span className="candidate-age">{sender.profile.age} yrs</span>
                          )}
                        </div>
                        <p className="request-subline">
                          {sender.profile.city || 'Location flexible'} · {sender.profile.occupation || 'Resident'}
                        </p>
                        <span className="request-date">Received on {formatDate(req.createdAt)}</span>
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

                  {sender.profile.bio && (
                    <p className="request-bio">“{sender.profile.bio}”</p>
                  )}

                  {req.message && (
                    <div className="request-intro-box">
                      <div className="intro-label">
                        <MessageSquare size={13} />
                        <span>Personal message:</span>
                      </div>
                      <p className="intro-text">“{req.message}”</p>
                    </div>
                  )}

                  <div className="request-card-footer">
                    <div className="request-actions">
                      <button
                        type="button"
                        className="button button-primary btn-accept"
                        disabled={actionBusyId === req.id}
                        onClick={() => handleAccept(req.id, sender.name)}
                      >
                        {actionBusyId === req.id ? (
                          <LoadingState label="Accepting…" />
                        ) : (
                          <>
                            Accept request <Check size={15} />
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary btn-decline"
                        disabled={actionBusyId === req.id}
                        onClick={() => handleDecline(req.id, sender.name)}
                      >
                        Decline <X size={15} />
                      </button>
                    </div>

                    <ButtonLink
                      to={`/discover/${sender.id}`}
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

