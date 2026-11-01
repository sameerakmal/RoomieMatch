import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Compass,
  House,
  Inbox,
  Leaf,
  LogOut,
  MessageSquare,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { useAuth } from '../hooks/useAuth';
import { useHealth } from '../hooks/useHealth';
import { apiError } from '../services/api';
import { connectionsService } from '../services/connections';
import { conversationsService } from '../services/conversations';
import { getSocket } from '../services/socket';
import { notificationsService } from '../services/notifications';
import type { InAppNotification } from '../types';

export function DashboardLayout({ children, title = 'Your home base' }: { children: ReactNode; title?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const health = useHealth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Notifications and badge state
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Fetch unread notifications
    notificationsService
      .getNotifications(1, 8, controller.signal)
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});

    // Fetch connection counts for sidebar badge
    connectionsService
      .getSummary(controller.signal)
      .then((summary) => {
        setPendingRequestsCount(summary.incomingPendingCount);
      })
      .catch(() => {});

    // Fetch unread message count for sidebar badge
    conversationsService
      .getUnreadCount(controller.signal)
      .then((data) => {
        setUnreadMessagesCount(data.unreadCount);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // Listen for socket events to update unread message count in real time
  useEffect(() => {
    const socket = getSocket();
    const handleUpdate = () => {
      conversationsService
        .getUnreadCount()
        .then((data) => setUnreadMessagesCount(data.unreadCount))
        .catch(() => {});
    };

    socket.on('conversation:updated', handleUpdate);
    socket.on('message:new', handleUpdate);
    socket.on('message:read:update', handleUpdate);

    return () => {
      socket.off('conversation:updated', handleUpdate);
      socket.off('message:new', handleUpdate);
      socket.off('message:read:update', handleUpdate);
    };
  }, []);

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(apiError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  const handleMarkAsRead = async (notif: InAppNotification) => {
    if (!notif.isRead) {
      try {
        const res = await notificationsService.markAsRead(notif.id);
        setUnreadCount(res.unreadCount);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // Silently catch
      }
    }
    setNotifOpen(false);
    if (notif.type === 'connection_request') {
      navigate('/requests');
    } else if (notif.type === 'connection_accepted') {
      navigate(`/connections/${notif.connectionId}`);
    } else {
      navigate('/requests/sent');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // Silently catch
    }
  };

  const renderNotifIcon = (type: string) => {
    switch (type) {
      case 'connection_accepted':
        return <UserCheck size={14} className="notif-type-icon olive" />;
      case 'connection_rejected':
        return <XCircle size={14} className="notif-type-icon terracotta" />;
      case 'connection_request':
      default:
        return <Inbox size={14} className="notif-type-icon olive" />;
    }
  };

  const renderNotifText = (notif: InAppNotification) => {
    const actorName = notif.actor?.name || 'A roommate candidate';
    switch (notif.type) {
      case 'connection_accepted':
        return `${actorName} accepted your connection request.`;
      case 'connection_rejected':
        return `${actorName} declined your connection request.`;
      case 'connection_request':
      default:
        return `${actorName} sent you a connection request.`;
    }
  };

  return (
    <div className="dashboard-layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="dashboard-sidebar">
        <Brand />
        <p className="eyebrow sidebar-label">Your little corner</p>
        <nav aria-label="Dashboard navigation">
          <NavLink to="/dashboard" end>
            <House size={19} /> Overview
          </NavLink>
          <NavLink to="/profile">
            <UserRound size={19} /> Your profile
          </NavLink>
          <NavLink to="/preferences">
            <SlidersHorizontal size={19} /> Roommate preferences
          </NavLink>
          <NavLink to="/discover">
            <Compass size={19} /> Roommate discovery
          </NavLink>
          <NavLink to="/requests">
            <Inbox size={19} /> Requests
            {pendingRequestsCount > 0 && (
              <span className="sidebar-badge">{pendingRequestsCount}</span>
            )}
          </NavLink>
          <NavLink to="/connections">
            <Users size={19} /> Connections
          </NavLink>
          <NavLink to="/messages">
            <MessageSquare size={19} /> Messages
            {unreadMessagesCount > 0 && (
              <span className="sidebar-badge">{unreadMessagesCount}</span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <Leaf size={27} strokeWidth={1.25} />
          <p>
            Good things take
            <br />a little growing.
          </p>
          <Link to="/">
            <ArrowLeft size={15} /> Back to the website
          </Link>
        </div>
      </aside>

      <main id="main-content" className="dashboard-main">
        <header className="dashboard-topbar">
          <span>{title}</span>
          <div className="dashboard-account">
            {/* Notification bell and dropdown */}
            <div className="notifications-wrapper" ref={notifDropdownRef}>
              <button
                type="button"
                className="notif-bell-button"
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-count-pill">{unreadCount}</span>}
              </button>

              {notifOpen && (
                <div className="notifications-popover" role="dialog" aria-label="Notifications list">
                  <div className="notif-popover-header">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="mark-all-read-btn"
                        onClick={handleMarkAllRead}
                      >
                        <CheckCheck size={14} /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="notif-popover-list">
                    {notifications.length === 0 ? (
                      <p className="notif-empty">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-item ${!n.isRead ? 'unread' : ''}`}
                          onClick={() => handleMarkAsRead(n)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="notif-icon-col">{renderNotifIcon(n.type)}</div>
                          <div className="notif-text-col">
                            <p className="notif-desc">{renderNotifText(n)}</p>
                            <span className="notif-time">
                              {new Date(n.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          {!n.isRead && <span className="notif-unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/profile" aria-label="View your profile">
              <ProfileAvatar name={user!.name} url={user!.profile.profilePhotoUrl} />
            </Link>
            <Button variant="text" className="logout-button" onClick={signOut} disabled={busy}>
              {busy ? (
                <LoadingState label="Signing out…" />
              ) : (
                <>
                  Log out <LogOut size={15} />
                </>
              )}
            </Button>
          </div>
        </header>

        {error && (
          <p className="form-message form-message-error" role="alert">
            {error}
          </p>
        )}
        {children}

        <footer className="dashboard-footer">
          <span>RoomieMatch · A little more like home.</span>
          {health === 'loading' ? (
            <LoadingState label="Checking connection" />
          ) : (
            <span className="service-status">
              <span className={health === 'available' ? 'olive-dot' : 'muted-dot'} />
              {health === 'available' ? 'Service available' : 'Service currently unavailable'}
            </span>
          )}
        </footer>
      </main>
    </div>
  );
}
