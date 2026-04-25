export type UserRole = 'fan' | 'creator' | 'both' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'banned';
export type CreatorApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type ContentType = 'image' | 'video' | 'audio' | 'text';
export type AccessType = 'free' | 'locked' | 'subscribers';
export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'removed';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'disputed';
export type TransactionRefType = 'content' | 'tip' | 'subscription' | 'custom_request';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type CustomRequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  is_verified_creator: boolean;
  created_at: string;
  reason_for_joining?: string;
}

export interface CreatorProfile {
  id: string;
  user_id: string;
  bio: string;
  cover_image_url?: string;
  tags: string[];
  subscription_price: number;
  starting_price: number;
  is_approved: boolean;
  application_status: CreatorApplicationStatus;
  total_earnings: number;
  created_at: string;
  display_name?: string;
  username?: string;
  avatar_url?: string;
  is_verified_creator?: boolean;
  content_count?: number;
  subscriber_count?: number;
}

export interface Content {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  content_type: ContentType;
  access_type: AccessType;
  preview_url?: string;
  media_url?: string;
  price: number;
  status: ContentStatus;
  created_at: string;
  creator_name?: string;
  creator_username?: string;
  creator_avatar?: string;
  unlock_count?: number;
  creator_subscription_price?: number;
  // Scarcity & pricing
  max_unlocks?: number;
  current_unlocks?: number;
  available_until?: string;
  subscriber_discount_pct?: number;
  bundle_ids?: string[];
}

export interface Bundle {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  content_ids: string[];
  bundle_price: number;
  individual_total: number;
  status: 'active' | 'archived';
  created_at: string;
  content_titles?: string[];
}

export interface PricingConfig {
  accessType: AccessType;
  price: number;
  maxUnlocks: number | null;
  availableUntil: string | null;
  subscriberDiscountPct: number;
  bundleEnabled: boolean;
  bundleName: string;
  bundlePrice: number | null;
}

export interface VideoProcessingConfig {
  trimStart: number;
  trimEnd: number;
  quality: 'high' | 'standard' | 'compact';
  slowMotion: boolean;
  thumbnail: string | null;
}

export interface Transaction {
  id: string;
  payer_id: string;
  payee_id: string;
  ref_type: TransactionRefType;
  ref_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: TransactionStatus;
  created_at: string;
  description?: string;
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  creator_id: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string;
  creator_name?: string;
  creator_avatar?: string;
  subscription_price?: number;
}

export interface CustomRequest {
  id: string;
  fan_id: string;
  creator_id: string;
  description: string;
  offered_price: number;
  status: CustomRequestStatus;
  created_at: string;
  fan_name?: string;
  fan_avatar?: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  custom_request_id?: string;
  read_at?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface Conversation {
  partner_id: string;
  partner_name: string;
  partner_avatar?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// ─── Access Key System ────────────────────────────────────────────────────────

export type KeyType = 'standard' | 'gold' | 'black';
export type KeyStatus = 'unused' | 'used' | 'expired' | 'transferred';
export type UserTierStatus = 'connector' | 'inner_circle' | 'gatekeeper';

export interface AccessKey {
  id: string;
  key_type: KeyType;
  status: KeyStatus;
  inviter_id: string;
  assigned_to_user_id?: string;
  invite_code: string;
  expires_at?: string;
  created_at: string;
  invitee_name?: string;
  invitee_avatar?: string;
}

export interface KeyDrop {
  id: string;
  drop_name: string;
  drop_description: string;
  key_type: KeyType;
  quantity: number;
  claimed: number;
  start_time: string;
  end_time: string;
  eligible_tiers: UserTierStatus[];
}

export interface KeyListing {
  id: string;
  key_type: KeyType;
  lister_id: string;
  lister_name: string;
  lister_avatar?: string;
  lister_tier: UserTierStatus;
  listed_at: string;
  status: 'available' | 'claimed' | 'cancelled';
}

export interface ReferralRecord {
  id: string;
  key_id: string;
  invite_code: string;
  key_type: KeyType;
  invitee_name?: string;
  invitee_avatar?: string;
  status: 'pending' | 'approved' | 'rejected';
  earnings: number;
  invited_at: string;
}

export interface KeyVaultSummary {
  total: number;
  available: number;
  used: number;
  by_type: Record<KeyType, number>;
  tier_status: UserTierStatus;
  referral_earnings_total: number;
  successful_invites: number;
}
