export type LangCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'pt';

export interface TranslationMap {
  // Navigation
  'nav.explore': string;
  'nav.dashboard': string;
  'nav.creator_studio': string;
  'nav.admin': string;
  'nav.sign_in': string;
  'nav.request_access': string;
  'nav.sign_out': string;

  // Landing hero
  'landing.access_only': string;
  'landing.hero_line1': string;
  'landing.hero_line2': string;
  'landing.hero_body': string;
  'landing.cta_primary': string;
  'landing.cta_secondary': string;
  'landing.cta_explore': string;
  'landing.verified_creators': string;
  'landing.active_members': string;

  // Auth
  'auth.sign_in_title': string;
  'auth.create_account': string;
  'auth.email': string;
  'auth.password': string;
  'auth.display_name': string;
  'auth.username': string;
  'auth.sign_in_btn': string;
  'auth.sign_up_btn': string;
  'auth.forgot_password': string;
  'auth.no_account': string;
  'auth.have_account': string;
  'auth.request_access': string;

  // Common
  'common.loading': string;
  'common.save': string;
  'common.cancel': string;
  'common.back': string;
  'common.continue': string;
  'common.submit': string;
  'common.unlock': string;
  'common.subscribe': string;
  'common.upload': string;
  'common.members_only': string;

  // Explore
  'explore.title': string;
  'explore.subtitle': string;
  'explore.search_placeholder': string;
  'explore.no_creators': string;

  // Access
  'access.locked': string;
  'access.free': string;
  'access.subscribers_only': string;
  'access.unlock_now': string;
  'access.checkout_preparing': string;

  // Creator
  'creator.studio': string;
  'creator.upload': string;
  'creator.earnings': string;
  'creator.subscribers': string;
  'creator.enable_payouts': string;

  // Member
  'member.dashboard': string;
  'member.vault': string;
  'member.subscriptions': string;
  'member.messages': string;
}
