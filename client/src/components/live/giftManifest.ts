/**
 * Gift Manifest
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for how each gift is rendered in the live gift engine.
 *
 * The engine is Rive-ready: a gift can declare an `assetType` of "rive" (or
 * "webm") and point at an animation file. If that file is missing or fails to
 * load, RiveGiftRenderer falls back to `fallbackEmoji`, so the build and the
 * live room never break before real assets land.
 *
 * Asset files live under `client/public/gifts/{icons,rive,sounds,webm}` and are
 * named after the gift `id`. See `public/gifts/README.md`.
 */

export type GiftLane      = 'micro' | 'feature' | 'fullscreen';
export type GiftTier      = 'standard' | 'premium' | 'legendary' | 'event';
export type GiftAssetType = 'emoji' | 'svg' | 'lottie' | 'rive' | 'webm';

export interface GiftManifestEntry {
  id: string;
  name: string;
  priceGold: number;
  lane: GiftLane;
  tier: GiftTier;
  /** Always-available fallback if the rich asset is missing or fails to load. */
  fallbackEmoji: string;
  /** Small tile icon for the gift drawer (optional). */
  iconAsset?: string;
  assetType: GiftAssetType;
  /** Path to the rich animation (.riv or .webm). Omitted for emoji-only gifts. */
  animationAsset?: string;
  /** Rive state-machine name to play. Convention: "GiftStateMachine". */
  riveStateMachine?: string;
  /** Audio synced to the animation (played on load or on a Rive "PlaySound" event). */
  soundAsset?: string;
  /** How long the gift occupies its lane, in ms. */
  durationMs: number;
  /** Whether repeated sends stack into a ×N combo badge. */
  comboEligible: boolean;
}

// Default lane durations, kept in sync with GiftAnimationManager.
const MICRO_MS      = 3800;
const FEATURE_MS    = 5400;
const FULLSCREEN_MS = 7200;

/**
 * The catalogue.
 *
 * The first block mirrors the purchasable gifts in GoldGiftDrawer (emoji
 * placeholders today — drop in `.riv`/`.svg` assets later with no code change).
 *
 * The second block is the first wave of premium / event Rive gifts. They are
 * declared here so the engine is fully Rive-wired; `.riv` files can be added to
 * `public/gifts/rive/` whenever they are ready.
 */
export const GIFT_MANIFEST: GiftManifestEntry[] = [
  // ── Purchasable catalogue (emoji placeholders) ──────────────────────────────
  { id: 'gold_rain',        name: 'Gold Rain',             priceGold: 100,   lane: 'micro',      tier: 'standard',  fallbackEmoji: '💛', assetType: 'emoji', durationMs: MICRO_MS,      comboEligible: true  },
  { id: 'halo_drop',        name: 'Halo Drop',             priceGold: 250,   lane: 'micro',      tier: 'standard',  fallbackEmoji: '✨', assetType: 'emoji', durationMs: MICRO_MS,      comboEligible: true  },
  { id: 'wings_open',       name: 'Wings Open',            priceGold: 500,   lane: 'feature',    tier: 'standard',  fallbackEmoji: '🪽', assetType: 'emoji', durationMs: FEATURE_MS,    comboEligible: false },
  { id: 'crown_signal',     name: 'Crown Signal',          priceGold: 1000,  lane: 'feature',    tier: 'premium',   fallbackEmoji: '👑', assetType: 'emoji', durationMs: FEATURE_MS,    comboEligible: false },
  { id: 'vault_key',        name: 'Vault Key',             priceGold: 2500,  lane: 'feature',    tier: 'premium',   fallbackEmoji: '🗝️', assetType: 'emoji', durationMs: FEATURE_MS,    comboEligible: false },
  { id: 'private_tribute',  name: 'Private Tribute',       priceGold: 5000,  lane: 'feature',    tier: 'premium',   fallbackEmoji: '⭐', assetType: 'emoji', durationMs: FEATURE_MS,    comboEligible: false },
  { id: 'room_blessing',    name: 'Room Blessing',         priceGold: 10000, lane: 'fullscreen', tier: 'legendary', fallbackEmoji: '🌟', assetType: 'emoji', durationMs: FULLSCREEN_MS, comboEligible: false },
  { id: 'after_hours',      name: 'After-Hours Signal',    priceGold: 12000, lane: 'fullscreen', tier: 'legendary', fallbackEmoji: '🌙', assetType: 'emoji', durationMs: FULLSCREEN_MS, comboEligible: false },
  { id: 'private_encore',   name: 'Private Encore Signal', priceGold: 15000, lane: 'fullscreen', tier: 'legendary', fallbackEmoji: '🎭', assetType: 'emoji', durationMs: FULLSCREEN_MS, comboEligible: false },
  { id: 'vault_drop',       name: 'Vault Drop Signal',     priceGold: 20000, lane: 'fullscreen', tier: 'legendary', fallbackEmoji: '💎', assetType: 'emoji', durationMs: FULLSCREEN_MS, comboEligible: false },
  { id: 'creator_blessing', name: 'Creator Blessing',      priceGold: 25000, lane: 'fullscreen', tier: 'legendary', fallbackEmoji: '🔮', assetType: 'emoji', durationMs: FULLSCREEN_MS, comboEligible: false },

  // ── First wave of premium / event Rive gifts ────────────────────────────────
  {
    id: 'golden-wings',
    name: 'Golden Wings',
    priceGold: 999,
    lane: 'feature',
    tier: 'premium',
    fallbackEmoji: '🪽',
    iconAsset: '/gifts/icons/golden-wings.svg',
    assetType: 'rive',
    animationAsset: '/gifts/rive/golden-wings.riv',
    riveStateMachine: 'GiftStateMachine',
    soundAsset: '/gifts/sounds/golden-wings.mp3',
    durationMs: 4500,
    comboEligible: true,
  },
  {
    id: 'angel-crown',
    name: 'Angel Crown',
    priceGold: 2500,
    lane: 'feature',
    tier: 'premium',
    fallbackEmoji: '👑',
    iconAsset: '/gifts/icons/angel-crown.svg',
    assetType: 'rive',
    animationAsset: '/gifts/rive/angel-crown.riv',
    riveStateMachine: 'GiftStateMachine',
    soundAsset: '/gifts/sounds/angel-crown.mp3',
    durationMs: 5000,
    comboEligible: false,
  },
  {
    id: 'diamond-rain',
    name: 'Diamond Rain',
    priceGold: 10000,
    lane: 'fullscreen',
    tier: 'legendary',
    fallbackEmoji: '💎',
    iconAsset: '/gifts/icons/diamond-rain.svg',
    assetType: 'rive',
    animationAsset: '/gifts/rive/diamond-rain.riv',
    riveStateMachine: 'GiftStateMachine',
    soundAsset: '/gifts/sounds/diamond-rain.mp3',
    durationMs: 7000,
    comboEligible: false,
  },
  {
    id: 'room-goal-complete',
    name: 'Room Goal Complete',
    priceGold: 0,
    lane: 'fullscreen',
    tier: 'event',
    fallbackEmoji: '🌟',
    iconAsset: '/gifts/icons/room-goal-complete.svg',
    assetType: 'rive',
    animationAsset: '/gifts/rive/room-goal-complete.riv',
    riveStateMachine: 'GiftStateMachine',
    soundAsset: '/gifts/sounds/room-goal-complete.mp3',
    durationMs: 7200,
    comboEligible: false,
  },
  {
    id: 'top-supporter-takeover',
    name: 'Top Supporter Takeover',
    priceGold: 0,
    lane: 'fullscreen',
    tier: 'event',
    fallbackEmoji: '🏆',
    iconAsset: '/gifts/icons/top-supporter-takeover.svg',
    assetType: 'rive',
    animationAsset: '/gifts/rive/top-supporter-takeover.riv',
    riveStateMachine: 'GiftStateMachine',
    soundAsset: '/gifts/sounds/top-supporter-takeover.mp3',
    durationMs: 7200,
    comboEligible: false,
  },
];

const GIFT_BY_ID: Record<string, GiftManifestEntry> = Object.fromEntries(
  GIFT_MANIFEST.map(g => [g.id, g]),
);

/** Look up a gift definition by id. Returns undefined for unknown ids. */
export function getGiftDef(id: string): GiftManifestEntry | undefined {
  return GIFT_BY_ID[id];
}

/** Lane fallback for gifts not in the manifest — mirrors the legacy gold thresholds. */
export function laneForGold(goldCost: number): GiftLane {
  if (goldCost >= 10000) return 'fullscreen';
  if (goldCost >= 500)   return 'feature';
  return 'micro';
}
