import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Compass,
  MessageSquare,
  Search,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { conversationsService } from '../services/conversations';
import { getSocket } from '../services/socket';
import { apiError } from '../services/api';
import {
  createOptimisticMessage,
  mergeOlderMessages,
  reconcileFailedMessage,
  reconcileMessage,
} from '../utils/messageDeduplication';
import type {
  ConversationItem,
  MessageItem,
  PresenceUpdate,
  ReadReceiptUpdate,
  TypingUpdate,
} from '../types';

export function MessagesPage() {
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

  // Conversations state
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    routeConversationId || null,
  );
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [convError, setConvError] = useState<string | null>(null);

  // Active chat state
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Composer & typing state
  const [inputText, setInputText] = useState('');
  const [isTypingRemote, setIsTypingRemote] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingLocalRef = useRef(false);

  // Keep route in sync with selected conversation and browser navigation
  useEffect(() => {
    if (routeConversationId) {
      setSelectedConversationId(routeConversationId);
    } else {
      // If at /messages without conversationId, reset on mobile to show the list view
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setSelectedConversationId(null);
      }
    }
  }, [routeConversationId]);

  // 1. Fetch conversations list
  const loadConversations = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await conversationsService.getConversations(signal);
      setConversations(data.conversations);
      // Auto-select first conversation on desktop if none selected and not on mobile
      if (!routeConversationId && data.conversations.length > 0 && window.innerWidth > 768) {
        setSelectedConversationId(data.conversations[0].id);
      }
    } catch (err) {
      if (signal?.aborted) return;
      setConvError(apiError(err).message);
    } finally {
      if (!signal?.aborted) {
        setLoadingConversations(false);
      }
    }
  }, [routeConversationId]);

  useEffect(() => {
    const controller = new AbortController();
    loadConversations(controller.signal);
    return () => controller.abort();
  }, [loadConversations]);

  // Track refs for active conversation and user to keep socket listeners stable
  const selectedConversationIdRef = useRef(selectedConversationId);
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // 2. Fetch messages when selected conversation changes
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true);
    setChatError(null);
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);
    setIsTypingRemote(false);

    try {
      const data = await conversationsService.getMessages(convId, null, 30);
      setMessages(data.messages);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);

      // Automatically mark as read
      await conversationsService.markAsRead(convId).catch(() => {});

      // Decrease unread in local conversations list
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
      );
    } catch (err) {
      setChatError(apiError(err).message);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
      setIsTypingRemote(false);
    }
  }, [selectedConversationId, loadMessages]);

  // 3. Load older messages (cursor pagination with deduplication)
  const handleLoadOlder = async () => {
    if (!selectedConversationId || !nextCursor || loadingOlder) return;

    setLoadingOlder(true);
    try {
      const data = await conversationsService.getMessages(
        selectedConversationId,
        nextCursor,
        30,
      );
      setMessages((prev) => mergeOlderMessages(prev, data.messages));
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setChatError(apiError(err).message);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    if (!loadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingOlder]);

  // 4a. Manage Conversation Room Subscriptions (independent of listener attachment)
  useEffect(() => {
    if (!selectedConversationId) return;
    const socket = getSocket();
    socket.emit('conversation:join', { conversationId: selectedConversationId });

    return () => {
      socket.emit('conversation:leave', { conversationId: selectedConversationId });
    };
  }, [selectedConversationId]);

  // 4b. Socket.IO Real-Time Event Handlers (registered once per component lifecycle)
  useEffect(() => {
    const socket = getSocket();
    setIsConnected(socket.connected);

    function onConnect() {
      setIsConnected(true);
      setConnectionError(null);
      const activeId = selectedConversationIdRef.current;
      if (activeId) {
        socket.emit('conversation:join', { conversationId: activeId });
      }
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onConnectError() {
      setIsConnected(false);
      setConnectionError(socket.active
        ? 'Unable to connect to chat. Retrying…'
        : 'Unable to connect to chat. Please sign in again or reload the page.');
    }

    function onNewMessage(newMsg: MessageItem) {
      const activeId = selectedConversationIdRef.current;
      const myId = currentUserIdRef.current;

      // If belongs to currently open conversation
      if (newMsg.conversationId === activeId) {
        setMessages((prev) => reconcileMessage(prev, newMsg));

        // Mark as read if received from other participant
        if (newMsg.senderId !== myId) {
          socket.emit('message:read', { conversationId: activeId });
        }
      }

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === newMsg.conversationId) {
            const isCurrentChat = c.id === activeId;
            return {
              ...c,
              lastMessage: newMsg,
              lastMessageAt: newMsg.createdAt,
              unreadCount: isCurrentChat ? 0 : c.unreadCount + 1,
            };
          }
          return c;
        }),
      );
    }

    function onMessageSent(payload: { message: MessageItem; idempotencyKey?: string }) {
      if (payload.message.conversationId === selectedConversationIdRef.current) {
        setMessages((prev) =>
          reconcileMessage(prev, payload.message, payload.idempotencyKey),
        );
      }
    }

    function onMessageFailed(payload: {
      conversationId?: string;
      error: string;
      idempotencyKey?: string;
    }) {
      if (!payload.conversationId || payload.conversationId === selectedConversationIdRef.current) {
        if (payload.idempotencyKey) {
          setMessages((prev) => reconcileFailedMessage(prev, payload.idempotencyKey!));
        }
        setChatError(payload.error || 'Failed to send message.');
      }
    }

    function onTypingUpdate(data: TypingUpdate) {
      if (
        data.conversationId === selectedConversationIdRef.current &&
        data.userId !== currentUserIdRef.current
      ) {
        setIsTypingRemote(data.isTyping);
      }
    }

    function onReadReceipt(data: ReadReceiptUpdate) {
      if (
        data.conversationId === selectedConversationIdRef.current &&
        data.readerId !== currentUserIdRef.current
      ) {
        setMessages((prev) =>
          prev.map((m) =>
            !m.readBy.includes(data.readerId)
              ? { ...m, readBy: [...m.readBy, data.readerId] }
              : m,
          ),
        );
      }
    }

    function onPresenceUpdate(data: PresenceUpdate) {
      setConversations((prev) =>
        prev.map((c) =>
          c.otherParticipant?.id === data.userId
            ? { ...c, isOnline: data.isOnline }
            : c,
        ),
      );
    }

    function onConversationUpdated(data: { conversationId: string; lastMessage: MessageItem }) {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === data.conversationId);
        if (!exists) {
          // Re-fetch conversation list if new conversation appeared
          conversationsService
            .getConversations()
            .then((res) => setConversations(res.conversations))
            .catch(() => {});
          return prev;
        }
        return prev.map((c) =>
          c.id === data.conversationId
            ? {
                ...c,
                lastMessage: data.lastMessage,
                lastMessageAt: data.lastMessage.createdAt,
              }
            : c,
        );
      });
    }

    const onConversationRevoked = (payload: { conversationId?: string }) => {
      if (payload?.conversationId === selectedConversationIdRef.current) {
        setChatError('Messaging is unavailable because the connection is no longer accepted.');
      }
    };

    const onConversationError = (payload: { error?: string }) => {
      if (payload?.error) {
        setChatError(payload.error);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message:new', onNewMessage);
    socket.on('message:sent', onMessageSent);
    socket.on('message:failed', onMessageFailed);
    socket.on('typing:update', onTypingUpdate);
    socket.on('message:read:update', onReadReceipt);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('conversation:revoked', onConversationRevoked);
    socket.on('conversation:error', onConversationError);
    // The shared dashboard socket may have failed before this page mounted.
    if (!socket.connected && !socket.active) onConnectError();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message:new', onNewMessage);
      socket.off('message:sent', onMessageSent);
      socket.off('message:failed', onMessageFailed);
      socket.off('typing:update', onTypingUpdate);
      socket.off('message:read:update', onReadReceipt);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('conversation:revoked', onConversationRevoked);
      socket.off('conversation:error', onConversationError);
    };
  }, []);

  // 5. Send message action
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || !selectedConversationId) return;

    const socket = getSocket();
    if (!socket.connected) {
      setConnectionError('Chat is not connected. Please wait for the connection before sending.');
      return;
    }
    const { message: optimisticMessage, idempotencyKey } = createOptimisticMessage({
      conversationId: selectedConversationId,
      senderId: currentUserId,
      content,
    });

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText('');
    setChatError(null);

    // Stop typing immediately on send
    if (isTypingLocalRef.current) {
      isTypingLocalRef.current = false;
      socket.emit('typing:stop', { conversationId: selectedConversationId });
    }

    // Emit real-time message to server
    socket.emit('message:send', {
      conversationId: selectedConversationId,
      content,
      idempotencyKey,
    });
  };

  // 6. Typing handling with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (!selectedConversationId) return;

    const socket = getSocket();

    if (!isTypingLocalRef.current) {
      isTypingLocalRef.current = true;
      socket.emit('typing:start', { conversationId: selectedConversationId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingLocalRef.current = false;
      socket.emit('typing:stop', { conversationId: selectedConversationId });
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // On mobile devices, Enter inserts a newline and user uses Send button
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        return;
      }
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Filtered conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) =>
      c.otherParticipant?.name.toLowerCase().includes(q) ||
      c.otherParticipant?.profile.city.toLowerCase().includes(q) ||
      (c.lastMessage?.content && c.lastMessage.content.toLowerCase().includes(q)),
    );
  }, [conversations, searchQuery]);

  const selectConversation = (id: string) => {
    setSelectedConversationId(id);
    navigate(`/messages/${id}`);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
    navigate('/messages');
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatConversationDate = (isoString: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <DashboardLayout title="Messages & Chat">
      {/* Top Header - hidden on mobile when viewing an active conversation to maximize chat space */}
      <section className={`messages-page-header ${selectedConversationId ? 'hidden-on-mobile-chat' : ''}`}>
        <p className="eyebrow">Real-time messaging</p>
        <h1>
          Roommate <em>conversations.</em>
        </h1>
        <p className="messages-intro">
          Coordinate living arrangements, discuss daily rhythms, and plan move-in details directly with your connected roommates.
        </p>
      </section>

      {/* Disconnection Warning */}
      {!isConnected && (
        <div className="form-message form-message-error reconnect-banner" role="alert">
          <Clock size={16} /> {connectionError || 'Connecting to RoomieMatch real-time chat…'}
        </div>
      )}

      {convError && (
        <div className="form-message form-message-error" role="alert">
          {convError}
        </div>
      )}

      {loadingConversations ? (
        <div className="discover-loading-box">
          <LoadingState label="Loading your conversations…" />
        </div>
      ) : conversations.length === 0 ? (
        <section className="discover-empty-state">
          <div className="empty-icon">
            <MessageSquare size={34} />
          </div>
          <h3>No conversations yet</h3>
          <p>
            When you and a roommate candidate have an accepted connection, your private conversation room will be ready here.
          </p>
          <div className="empty-actions">
            <ButtonLink to="/connections" variant="primary">
              View your connections <Users size={15} />
            </ButtonLink>
            <ButtonLink to="/discover" variant="secondary">
              Discover roommates <Compass size={15} />
            </ButtonLink>
          </div>
        </section>
      ) : (
        <div className={`chat-layout ${selectedConversationId ? 'has-active-chat chat-active-mobile' : 'no-active-chat'}`}>
          {/* Left Panel: Conversation List */}
          <aside className="chat-sidebar">
            <div className="chat-search-bar">
              <Search size={15} className="chat-search-icon" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="chat-search-input"
              />
            </div>

            <div className="chat-conversation-list" role="list">
              {filteredConversations.length === 0 ? (
                <p className="chat-no-results">No conversations match your search.</p>
              ) : (
                filteredConversations.map((c) => {
                  const partner = c.otherParticipant;
                  const isSelected = c.id === selectedConversationId;

                  return (
                    <div
                      key={c.id}
                      className={`chat-convo-item ${isSelected ? 'active' : ''}`}
                      onClick={() => selectConversation(c.id)}
                      role="listitem"
                      tabIndex={0}
                    >
                      <div className="convo-avatar-col">
                        <ProfileAvatar
                          name={partner?.name || 'Roommate'}
                          url={partner?.profile.profilePhotoUrl}
                        />
                        <span
                          className={`presence-dot ${c.isOnline ? 'online' : 'offline'}`}
                          title={c.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>

                      <div className="convo-info-col">
                        <div className="convo-head-row">
                          <strong className="convo-name">{partner?.name || 'Candidate'}</strong>
                          <span className="convo-time">
                            {formatConversationDate(c.lastMessageAt || c.updatedAt)}
                          </span>
                        </div>

                        <div className="convo-sub-row">
                          <p className="convo-preview">
                            {c.lastMessage ? (
                              <>
                                {c.lastMessage.senderId === currentUserId && <span className="preview-prefix">You: </span>}
                                {c.lastMessage.content}
                              </>
                            ) : (
                              <em>No messages yet</em>
                            )}
                          </p>
                          {c.unreadCount > 0 && (
                            <span className="convo-unread-pill">{c.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Panel: Active Chat View */}
          <main className="chat-main-area">
            {activeConversation ? (
              <>
                {/* Active Chat Header */}
                <header className="chat-active-header">
                  <button
                    type="button"
                    className="chat-mobile-back-btn"
                    onClick={handleBackToList}
                    aria-label="Back to conversations list"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="chat-header-user">
                    <div className="chat-header-avatar-wrap">
                      <ProfileAvatar
                        name={activeConversation.otherParticipant?.name || 'Roommate'}
                        url={activeConversation.otherParticipant?.profile.profilePhotoUrl}
                      />
                      <span
                        className={`presence-dot ${activeConversation.isOnline ? 'online' : 'offline'}`}
                      />
                    </div>
                    <div>
                      <h2>{activeConversation.otherParticipant?.name}</h2>
                      <p className="chat-partner-meta">
                        {activeConversation.otherParticipant?.profile.city || 'Location flexible'} ·{' '}
                        {activeConversation.otherParticipant?.profile.occupation || 'Resident'} ·{' '}
                        <span className="presence-label">
                          {activeConversation.isOnline ? 'Online now' : 'Offline'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="chat-header-actions">
                    <ButtonLink
                      to={`/connections/${activeConversation.connectionId}`}
                      variant="text"
                      className="view-connection-btn"
                      title="View connection details"
                    >
                      <UserCheck size={14} />
                      <span className="view-connection-label">View connection</span>
                    </ButtonLink>
                  </div>
                </header>

                {chatError && (
                  <div className="form-message form-message-error chat-inline-error" role="alert">
                    <AlertCircle size={15} /> {chatError}
                  </div>
                )}

                {/* Message History */}
                <div className="chat-history-scroll">
                  {hasMore && (
                    <div className="load-older-bar">
                      <button
                        type="button"
                        className="button button-secondary load-older-btn"
                        onClick={handleLoadOlder}
                        disabled={loadingOlder}
                      >
                        {loadingOlder ? <LoadingState label="Loading earlier messages…" /> : 'Load earlier messages'}
                      </button>
                    </div>
                  )}

                  {loadingMessages ? (
                    <div className="chat-messages-loading">
                      <LoadingState label="Loading conversation history…" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="chat-empty-history">
                      <div className="empty-bubble-icon">
                        <MessageSquare size={26} />
                      </div>
                      <p>
                        This is the beginning of your conversation with <strong>{activeConversation.otherParticipant?.name}</strong>.
                      </p>
                      <span>Share your move-in timeline, apartment search updates, or ask about living rhythms.</span>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isMe = msg.senderId === currentUserId;
                      const partnerId = activeConversation.otherParticipant?.id || '';
                      const isReadByPartner = isMe && msg.readBy.includes(partnerId);

                      // Date separator check
                      const showDateHeader =
                        index === 0 ||
                        new Date(msg.createdAt).toDateString() !==
                          new Date(messages[index - 1].createdAt).toDateString();

                      return (
                        <div key={msg.id} className="message-row-wrap">
                          {showDateHeader && (
                            <div className="chat-date-separator">
                              <span>
                                {new Date(msg.createdAt).toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>
                          )}

                          <div className={`message-bubble-row ${isMe ? 'outgoing' : 'incoming'}`}>
                            {!isMe && (
                              <ProfileAvatar
                                name={activeConversation.otherParticipant?.name || 'R'}
                                url={activeConversation.otherParticipant?.profile.profilePhotoUrl}
                              />
                            )}

                            <div className={`message-bubble ${isMe ? 'outgoing-bubble' : 'incoming-bubble'}`}>
                              <p className="message-content">{msg.content}</p>
                              <div className="message-meta-row">
                                <span className="message-time">{formatMessageTime(msg.createdAt)}</span>
                                {isMe && (
                                  <span
                                    className="receipt-indicator"
                                    title={
                                      msg.failed
                                        ? 'Failed to send'
                                        : msg.pending
                                          ? 'Sending…'
                                          : isReadByPartner
                                            ? 'Read'
                                            : 'Sent'
                                    }
                                  >
                                    {msg.failed ? (
                                      <span className="receipt-sent" style={{ color: '#c85a32' }}>
                                        <AlertCircle size={13} /> Failed
                                      </span>
                                    ) : msg.pending ? (
                                      <span className="receipt-sent">
                                        <Clock size={12} />
                                      </span>
                                    ) : isReadByPartner ? (
                                      <span className="receipt-read">
                                        <CheckCheck size={13} /> Read
                                      </span>
                                    ) : (
                                      <span className="receipt-sent">
                                        <Check size={13} /> Sent
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Remote Typing Indicator */}
                  {isTypingRemote && (
                    <div className="typing-indicator-row">
                      <div className="typing-bubble">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                      <span className="typing-text">
                        {activeConversation.otherParticipant?.name.split(' ')[0]} is typing…
                      </span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Message Composer */}
                <form className="chat-composer" onSubmit={handleSendMessage}>
                  <div className="composer-inner">
                    <textarea
                      rows={2}
                      maxLength={4000}
                      placeholder={
                        typeof window !== 'undefined' && window.innerWidth <= 768
                          ? `Message ${activeConversation.otherParticipant?.name.split(' ')[0] || 'roommate'}…`
                          : `Message ${activeConversation.otherParticipant?.name.split(' ')[0] || 'roommate'}… (Press Enter to send, Shift+Enter for new line)`
                      }
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="chat-textarea"
                    />
                    <div className="composer-actions">
                      <span className="composer-chars">{inputText.length}/4000</span>
                      <button
                        type="submit"
                        disabled={!inputText.trim() || !isConnected}
                        className="button button-primary chat-send-btn"
                        aria-label="Send message"
                      >
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="chat-placeholder-view">
                <div className="placeholder-icon">
                  <MessageSquare size={36} />
                </div>
                <h3>{selectedConversationId ? 'Conversation not found' : 'Select a conversation'}</h3>
                <p>
                  {selectedConversationId
                    ? "This conversation may have been removed or you don't have access to it."
                    : 'Choose a roommate from the left panel to review past messages and chat in real-time.'}
                </p>
                {selectedConversationId && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={handleBackToList}
                    style={{ marginTop: '16px', gap: '6px' }}
                  >
                    <ArrowLeft size={15} /> Back to conversations
                  </button>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </DashboardLayout>
  );
}
