export interface AuthValues { name: string; email: string; password: string; confirmPassword: string }
export type AuthErrors = Partial<Record<keyof AuthValues, string>>;
export interface UserProfile {
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: number | null;
  moveInDate: string | null;
}
export interface User {
  id: string;
  name: string;
  email: string;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}
export interface UserResponse { user: User }
export interface LoginInput { email: string; password: string }
export interface RegisterInput extends LoginInput { name: string }
export interface ProfileInput { name?: string; profile?: Partial<UserProfile> }
export interface ProfileValues {
  name: string;
  city: string;
  occupation: string;
  bio: string;
  profilePhotoUrl: string;
  age: string;
  moveInDate: string;
}
export type ProfileErrors = Partial<Record<keyof ProfileValues, string>>;
export interface ApiErrorBody { error: { message: string; status: number; fields?: Record<string, string> } }
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'unconfigured';
  timestamp: string;
}

// Phase 3: Lifestyle Questionnaire & Roommate Preferences Types
export interface SleepScheduleData {
  bedtime: string;
  wakeUpTime: string;
  consistency: 'very-consistent' | 'somewhat-consistent' | 'irregular';
  wakingEnvironment: 'quiet' | 'normal-activity';
  dailyRoutine: 'student' | 'working-professional' | 'remote-worker' | 'mixed-other';
  timeAtHome: 'mostly-at-home' | 'partially-at-home' | 'rarely-at-home';
  sleepWindowHours?: number;
}

export interface CleanlinessData {
  cleanlinessLevel: 'very-organized' | 'moderately-organized' | 'relaxed';
  cleaningFrequency: 'daily' | 'several-times-a-week' | 'weekly' | 'as-needed';
  kitchenCleanliness: 'clean-immediately' | 'clean-same-day' | 'flexible';
  bathroomCleaning: 'shared-schedule' | 'alternate-responsibilities' | 'individual-responsibility';
  sharedSpaceOrganization: 'very-tidy' | 'moderately-tidy' | 'relaxed';
}

export interface NoiseData {
  noiseTolerance: 'very-low' | 'moderate' | 'high';
  musicHabits: 'rarely' | 'occasionally' | 'frequently';
  studyWorkEnvironment: 'silent' | 'low-background-noise' | 'doesnt-matter';
  quietHoursStart: string;
  quietHoursEnd: string;
  headphoneUsage: 'always' | 'usually' | 'sometimes' | 'rarely';
}

export interface GuestsData {
  guestFrequency: 'rarely' | 'occasionally' | 'frequently';
  overnightGuests: 'not-comfortable' | 'occasionally' | 'comfortable';
  advanceNotice: 'required' | 'preferred' | 'not-necessary';
  socialLifestyle: 'introverted' | 'balanced' | 'extroverted';
  sharedActivities: 'frequently' | 'sometimes' | 'prefer-personal-space';
}

export interface BudgetData {
  minRent: number;
  maxRent: number;
  accommodationType: 'apartment' | 'pg' | 'hostel' | 'shared-house' | 'no-preference';
  foodPreference: 'vegetarian' | 'non-vegetarian' | 'vegan' | 'no-preference';
  foodSharing: 'share-groceries' | 'separate-groceries' | 'flexible';
  smoking: 'smoke-free-required' | 'non-smokers-only' | 'comfortable-with-smokers';
  alcohol: 'alcohol-free-preferred' | 'occasional-acceptable' | 'no-preference';
  pets: 'comfortable-with-pets' | 'prefer-no-pets' | 'allergic-pet-free';
  roomArrangement: 'private-room' | 'shared-room' | 'no-preference';
}

export interface RequirementsData {
  quietEnvironment: 'preferred' | 'required';
  smokeFree: 'preferred' | 'required';
  petFree: 'preferred' | 'required';
  alcoholFree: 'preferred' | 'required';
  cleanlinessLevel: 'preferred' | 'required';
  overnightGuestPolicy: 'preferred' | 'required';
  dietarySharing: 'preferred' | 'required';
}

export interface RoommatePreferences {
  id: string;
  userId: string;
  sleepSchedule: SleepScheduleData | null;
  cleanliness: CleanlinessData | null;
  noise: NoiseData | null;
  guests: GuestsData | null;
  budget: BudgetData | null;
  requirements: RequirementsData;
  isCompleted: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PreferencesResponse {
  preferences: RoommatePreferences | null;
}

export interface PreferencesStatus {
  isCompleted: boolean;
  completedAt: string | null;
  completedSections: number;
  totalSections: number;
  percent: number;
  sections: {
    sleepSchedule: boolean;
    cleanliness: boolean;
    noise: boolean;
    guests: boolean;
    budget: boolean;
  };
}

export interface PreferencesStatusResponse {
  status: PreferencesStatus;
}

export interface QuestionnaireFormValues {
  // Sleep
  bedtime: string;
  wakeUpTime: string;
  consistency: string;
  wakingEnvironment: string;
  dailyRoutine: string;
  timeAtHome: string;
  // Cleanliness
  cleanlinessLevel: string;
  cleaningFrequency: string;
  kitchenCleanliness: string;
  bathroomCleaning: string;
  sharedSpaceOrganization: string;
  // Noise
  noiseTolerance: string;
  musicHabits: string;
  studyWorkEnvironment: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  headphoneUsage: string;
  // Guests
  guestFrequency: string;
  overnightGuests: string;
  advanceNotice: string;
  socialLifestyle: string;
  sharedActivities: string;
  // Budget
  minRent: string;
  maxRent: string;
  accommodationType: string;
  foodPreference: string;
  foodSharing: string;
  smoking: string;
  alcohol: string;
  pets: string;
  roomArrangement: string;
  // Requirements (preferred vs required)
  quietEnvironmentRequirement: 'preferred' | 'required';
  smokeFreeRequirement: 'preferred' | 'required';
  petFreeRequirement: 'preferred' | 'required';
  alcoholFreeRequirement: 'preferred' | 'required';
  cleanlinessRequirement: 'preferred' | 'required';
  overnightGuestRequirement: 'preferred' | 'required';
  dietarySharingRequirement: 'preferred' | 'required';
}

// Phase 4: Compatibility Matching & Discovery Types
export type CategoryKey = 'sleep' | 'cleanliness' | 'noise' | 'guests' | 'budget' | 'lifestyle';

export interface CategoryScoreResult {
  score: number;
  weight: number;
  isAvailable: boolean;
  explanation?: string;
}

export interface BudgetOverlapResult {
  hasOverlap: boolean;
  min: number | null;
  max: number | null;
  overlapSpan: number;
  userBudget: { min: number; max: number };
  candidateBudget: { min: number; max: number };
  explanation: string;
}

export type ConstraintStatus = 'passed' | 'failed' | 'unknown';

export interface ConstraintEvaluation {
  id: string;
  name: string;
  status: ConstraintStatus;
  affectedCategory: CategoryKey;
  explanation: string;
  direction: 'user-to-candidate' | 'candidate-to-user';
}

export interface CompatibilityResult {
  overallScore: number | null;
  dataCoverage: number;
  isEligible: boolean;
  categories: Record<CategoryKey, CategoryScoreResult>;
  strengths: string[];
  differences: string[];
  budgetOverlap: BudgetOverlapResult;
  constraints: ConstraintEvaluation[];
  summary: string;
}

export interface SafeCandidateProfile {
  id: string;
  name: string;
  profile: {
    city: string;
    occupation: string;
    bio: string;
    profilePhotoUrl: string;
    age: number | null;
    moveInDate: string | null;
  };
}

export interface CandidateConnectionInfo {
  id: string;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
}

export interface MatchDiscoveryItem {
  candidate: SafeCandidateProfile;
  compatibility: CompatibilityResult;
  connection?: CandidateConnectionInfo | null;
}

export interface MatchesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MatchesResponse {
  matches: MatchDiscoveryItem[];
  pagination: MatchesPagination;
}

export interface MatchDetailResponse {
  candidate: SafeCandidateProfile;
  compatibility: CompatibilityResult;
  connection?: CandidateConnectionInfo | null;
}

export interface MatchFilters {
  city?: string;
  minScore?: number;
  accommodationType?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}

// Phase 5: Connection Requests & Networking Types
export type ConnectionStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface ReceivedRequestItem {
  id: string;
  sender: SafeCandidateProfile | null;
  message: string;
  status: ConnectionStatus;
  createdAt: string;
  compatibility?: {
    overallScore: number | null;
    summary: string;
    strengths: string[];
  } | null;
}

export interface SentRequestItem {
  id: string;
  recipient: SafeCandidateProfile | null;
  message: string;
  status: ConnectionStatus;
  createdAt: string;
  respondedAt: string | null;
  compatibility?: {
    overallScore: number | null;
    summary: string;
    strengths: string[];
  } | null;
}

export interface AcceptedConnectionItem {
  id: string;
  user: SafeCandidateProfile | null;
  status: ConnectionStatus;
  connectedAt: string;
  createdAt: string;
  compatibility?: {
    overallScore: number | null;
    summary: string;
    strengths: string[];
  } | null;
}

export interface ConnectionDetail {
  id: string;
  status: ConnectionStatus;
  message: string;
  createdAt: string;
  respondedAt: string | null;
  isSender: boolean;
  user: SafeCandidateProfile;
  compatibility: CompatibilityResult | null;
  sharedLifestyle: { category: string; description: string }[];
}

export interface RecentActivityItem {
  id: string;
  status: ConnectionStatus;
  direction: 'sent' | 'received';
  otherUser: SafeCandidateProfile | null;
  timestamp: string;
  message: string;
}

export interface ConnectionSummary {
  incomingPendingCount: number;
  outgoingPendingCount: number;
  acceptedCount: number;
  recentActivity: RecentActivityItem[];
}

export interface InAppNotification {
  id: string;
  type: 'connection_request' | 'connection_accepted' | 'connection_rejected';
  isRead: boolean;
  connectionId: string;
  createdAt: string;
  actor: SafeCandidateProfile | null;
}

export interface NotificationsResponse {
  notifications: InAppNotification[];
  unreadCount: number;
  pagination: MatchesPagination;
}

export interface ReceivedRequestsResponse {
  requests: ReceivedRequestItem[];
  pagination: MatchesPagination;
}

export interface SentRequestsResponse {
  requests: SentRequestItem[];
  pagination: MatchesPagination;
}

export interface ConnectionsResponse {
  connections: AcceptedConnectionItem[];
  pagination: MatchesPagination;
}

// Phase 6: Real-Time Chat & Messaging Types
export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'system';
  readBy: string[];
  createdAt: string;
  idempotencyKey?: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ConversationItem {
  id: string;
  connectionId: string;
  otherParticipant: SafeCandidateProfile | null;
  lastMessage: MessageItem | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationsResponse {
  conversations: ConversationItem[];
  totalUnread: number;
}

export interface MessagesResponse {
  messages: MessageItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TypingUpdate {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  timestamp: string;
}

export interface ReadReceiptUpdate {
  conversationId: string;
  readerId: string;
  readAt: string;
}


