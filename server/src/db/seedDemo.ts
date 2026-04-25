/**
 * Demo seed — creates 3 demo creators + 5 content items each.
 *
 * Safe to run multiple times: uses ON CONFLICT … DO UPDATE so rows are
 * updated in place rather than duplicated.
 *
 * Usage:
 *   DATABASE_URL=<postgres url> npm run seed:demo
 *
 * To wipe and re-seed from scratch delete the rows whose IDs start with
 * 'demo-' and re-run.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from './client.js';
import { runMigrations } from './migrate.js';

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set.');
  console.error('   Run: DATABASE_URL=<your-pg-url> npm run seed:demo');
  process.exit(1);
}

// ─── Fixed IDs ────────────────────────────────────────────────────────────────
// Deterministic IDs so re-running the script updates rows instead of inserting.

const U = {
  aria:   'demo-user-00000000-aria-000000000001',
  selena: 'demo-user-00000000-sele-000000000002',
  elara:  'demo-user-00000000-elar-000000000003',
};
const P = {
  aria:   'demo-prof-00000000-aria-000000000001',
  selena: 'demo-prof-00000000-sele-000000000002',
  elara:  'demo-prof-00000000-elar-000000000003',
};

// picsum.photos/seed/<seed>/<w>/<h> returns a stable image for the same seed
const AVATAR = (seed: string) => `https://picsum.photos/seed/${seed}-av/200/200`;
const COVER  = (seed: string) => `https://picsum.photos/seed/${seed}-cv/1200/400`;
const PREV   = (seed: string) => `https://picsum.photos/seed/${seed}/480/640`;

// ─── Creator definitions ──────────────────────────────────────────────────────

const CREATORS = [
  {
    userId:    U.aria,
    profileId: P.aria,
    email:     'demo.arialuxe@archangels.demo',
    username:  'arialuxe',
    displayName: 'Aria Luxe',
    avatarUrl: AVATAR('arialuxe'),
    bio: 'Fashion photographer and visual artist. Exclusive editorials, behind-the-scenes, and personal drops. ⚠️ DEMO ACCOUNT',
    tags: ['Fashion', 'Photography', 'Visual Art'],
    coverUrl: COVER('arialuxe'),
    subscriptionPrice: 14.99,
    startingPrice:      4.99,
    content: [
      { id: 'demo-c-aria-01', title: '[DEMO] After Hours Session',    desc: 'A late-night studio shoot, unfiltered.',                   type: 'image', access: 'locked',      price: 9.99,  prev: PREV('aria-c1') },
      { id: 'demo-c-aria-02', title: '[DEMO] Golden Editorial Vol. 1', desc: 'Behind-the-scenes of the spring editorial shoot.',        type: 'video', access: 'locked',      price: 14.99, prev: PREV('aria-c2') },
      { id: 'demo-c-aria-03', title: '[DEMO] Rooftop Shoot Exclusive', desc: 'Skyline series — 12 high-res stills.',                    type: 'image', access: 'locked',      price: 7.99,  prev: PREV('aria-c3') },
      { id: 'demo-c-aria-04', title: '[DEMO] Behind the Lens Notes',   desc: 'My process, gear list, and editing philosophy.',          type: 'text',  access: 'locked',      price: 4.99,  prev: null },
      { id: 'demo-c-aria-05', title: '[DEMO] Summer Collection — Free Preview', desc: 'Public teaser for the full summer drop.',        type: 'image', access: 'free',        price: 0,     prev: PREV('aria-c5') },
    ],
  },
  {
    userId:    U.selena,
    profileId: P.selena,
    email:     'demo.selenanoir@archangels.demo',
    username:  'selenanoir',
    displayName: 'Selena Noir',
    avatarUrl: AVATAR('selenanoir'),
    bio: 'Dark aesthetics, editorial, and cinematic photography. Shadow is the medium. ⚠️ DEMO ACCOUNT',
    tags: ['Dark Aesthetic', 'Editorial', 'Cinematic'],
    coverUrl: COVER('selenanoir'),
    subscriptionPrice: 12.99,
    startingPrice:      3.99,
    content: [
      { id: 'demo-c-sele-01', title: '[DEMO] Midnight Noir Series',    desc: 'A 9-image editorial shot between midnight and 3 AM.',     type: 'image', access: 'locked',      price: 12.99, prev: PREV('selena-c1') },
      { id: 'demo-c-sele-02', title: '[DEMO] Dark Room Sessions',      desc: '20-minute intimate video — shot in one take.',            type: 'video', access: 'locked',      price: 19.99, prev: PREV('selena-c2') },
      { id: 'demo-c-sele-03', title: '[DEMO] Shadow & Light',          desc: 'Contrast studies from the Berlin trip.',                  type: 'image', access: 'locked',      price: 8.99,  prev: PREV('selena-c3') },
      { id: 'demo-c-sele-04', title: '[DEMO] The Black Collection',    desc: 'Essay: building a brand around negative space.',         type: 'text',  access: 'locked',      price: 5.99,  prev: null },
      { id: 'demo-c-sele-05', title: '[DEMO] Cinematic BTS — Free',    desc: 'Free behind-the-scenes clip from the last shoot.',       type: 'image', access: 'free',        price: 0,     prev: PREV('selena-c5') },
    ],
  },
  {
    userId:    U.elara,
    profileId: P.elara,
    email:     'demo.elaramoon@archangels.demo',
    username:  'elaramoon',
    displayName: 'Elara Moon',
    avatarUrl: AVATAR('elaramoon'),
    bio: 'Lifestyle, wellness, and beauty. Full moon drops every month. ⚠️ DEMO ACCOUNT',
    tags: ['Lifestyle', 'Wellness', 'Beauty'],
    coverUrl: COVER('elaramoon'),
    subscriptionPrice: 9.99,
    startingPrice:      2.99,
    content: [
      { id: 'demo-c-elar-01', title: '[DEMO] Morning Ritual Series',    desc: '30-min morning routine and wellness guide.',              type: 'video', access: 'locked',      price: 9.99,  prev: PREV('elara-c1') },
      { id: 'demo-c-elar-02', title: '[DEMO] Wellness Drop Vol. 2',     desc: 'Skincare routine, supplements, and sleep stack.',         type: 'image', access: 'locked',      price: 6.99,  prev: PREV('elara-c2') },
      { id: 'demo-c-elar-03', title: '[DEMO] Full Moon Series',         desc: 'Photo series shot only under full moon light.',           type: 'image', access: 'locked',      price: 11.99, prev: PREV('elara-c3') },
      { id: 'demo-c-elar-04', title: '[DEMO] Inner Circle Diary',       desc: 'Monthly subscriber-only personal journal drop.',          type: 'text',  access: 'subscribers', price: 0,     prev: null },
      { id: 'demo-c-elar-05', title: '[DEMO] Golden Hour Glow',         desc: 'Beauty shoot — 8 looks, natural light only.',             type: 'image', access: 'locked',      price: 7.99,  prev: PREV('elara-c5') },
    ],
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seedDemo() {
  console.log('\n🌱  Archangels Club — demo seed\n');
  await runMigrations();

  const demoPassword = await bcrypt.hash('DemoPass123!', 10);

  for (const creator of CREATORS) {
    console.log(`\n── ${creator.displayName} (@${creator.username}) ──`);

    // ── User ────────────────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO users
         (id, email, username, password_hash, display_name, avatar_url, role, status, is_verified_creator)
       VALUES ($1, $2, $3, $4, $5, $6, 'creator', 'approved', 1)
       ON CONFLICT (email) DO UPDATE SET
         username          = EXCLUDED.username,
         display_name      = EXCLUDED.display_name,
         avatar_url        = EXCLUDED.avatar_url,
         role              = 'creator',
         status            = 'approved',
         is_verified_creator = 1`,
      [creator.userId, creator.email, creator.username, demoPassword,
       creator.displayName, creator.avatarUrl]
    );

    // Resolve the actual user id in case email existed before our seed
    const userRow = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1', [creator.email]
    );
    const actualUserId = userRow.rows[0].id;

    console.log(`  ✓ user        ${creator.email}  (id=${actualUserId})`);

    // ── Creator profile ─────────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO creator_profiles
         (id, user_id, bio, cover_image_url, tags, content_categories,
          subscription_price, starting_price, is_approved, application_status, pitch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'approved', 'Demo account — auto-seeded')
       ON CONFLICT (user_id) DO UPDATE SET
         bio               = EXCLUDED.bio,
         cover_image_url   = EXCLUDED.cover_image_url,
         tags              = EXCLUDED.tags,
         subscription_price= EXCLUDED.subscription_price,
         starting_price    = EXCLUDED.starting_price,
         is_approved       = 1,
         application_status= 'approved'`,
      [creator.profileId, actualUserId, creator.bio, creator.coverUrl,
       JSON.stringify(creator.tags), JSON.stringify(creator.tags),
       creator.subscriptionPrice, creator.startingPrice]
    );

    // Resolve actual profile id
    const profRow = await pool.query<{ id: string }>(
      'SELECT id FROM creator_profiles WHERE user_id = $1', [actualUserId]
    );
    const actualProfileId = profRow.rows[0].id;
    console.log(`  ✓ profile     subscription=$${creator.subscriptionPrice}  (id=${actualProfileId})`);

    // ── Content ─────────────────────────────────────────────────────────────
    for (const item of creator.content) {
      await pool.query(
        `INSERT INTO content
           (id, creator_id, title, description, content_type, access_type,
            preview_url, media_url, price, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, 'approved')
         ON CONFLICT (id) DO UPDATE SET
           creator_id   = EXCLUDED.creator_id,
           title        = EXCLUDED.title,
           description  = EXCLUDED.description,
           content_type = EXCLUDED.content_type,
           access_type  = EXCLUDED.access_type,
           preview_url  = EXCLUDED.preview_url,
           price        = EXCLUDED.price,
           status       = 'approved'`,
        [item.id, actualProfileId, item.title, item.desc,
         item.type, item.access, item.prev, item.price]
      );
      const lock = item.access === 'free' ? 'free    ' : item.access === 'subscribers' ? 'sub     ' : `$${item.price.toFixed(2)}  `;
      console.log(`  ✓ content     [${lock}] ${item.title}`);
    }
  }

  console.log('\n✅  Demo seed complete.\n');
  console.log('   Explore    → /explore');
  console.log('   Aria Luxe  → /creator/arialuxe');
  console.log('   Selena Noir→ /creator/selenanoir');
  console.log('   Elara Moon → /creator/elaramoon');
  console.log('\n   Demo login credentials (any creator):');
  console.log('   password: DemoPass123!\n');
}

seedDemo()
  .catch((err) => {
    console.error('\n❌  Seed failed:', err.message ?? err);
    process.exit(1);
  })
  .finally(() => pool.end());
