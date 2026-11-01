import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from './Button';
import { ProfileAvatar } from './ProfileAvatar';
import { LoadingState } from './LoadingState';
import { apiError } from '../services/api';
import type { SafeCandidateProfile } from '../types';

interface ConnectModalProps {
  candidate: SafeCandidateProfile;
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
}

export function ConnectModal({ candidate, isOpen, onClose, onSend }: ConnectModalProps) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSend(message);
      onClose();
    } catch (err) {
      setError(apiError(err).message || 'Failed to send connection request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="connect-dialog-title">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Connect with roommate</p>
            <h2 id="connect-dialog-title">Say hello to {candidate.name.split(' ')[0]}</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-candidate-preview">
          <ProfileAvatar name={candidate.name} url={candidate.profile.profilePhotoUrl} />
          <div>
            <strong>{candidate.name}</strong>
            <p>{candidate.profile.city || 'Location flexible'} · {candidate.profile.occupation || 'Resident'}</p>
          </div>
        </div>

        {error && (
          <div className="form-message form-message-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <label htmlFor="connect-message-input">
            Optional introduction message
            <span className="input-hint">Share a brief note about your move-in plans or why your rhythms align.</span>
          </label>
          <textarea
            id="connect-message-input"
            rows={4}
            maxLength={500}
            placeholder="Hi! I noticed our cleanliness standards and quiet hours match really well. Looking forward to connecting!"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            className="connect-textarea"
          />
          <div className="textarea-footer">
            <span className="char-count">{message.length}/500</span>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="send-request-btn"
            >
              {submitting ? <LoadingState label="Sending…" /> : <>Send connection request <Send size={15} /></>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
