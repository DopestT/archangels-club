import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Zap, Copy, Check, Edit2, Trash2, ChevronDown,
  Target, Users, TrendingUp, ClipboardCheck, BarChart2, BookOpen,
  Instagram, Youtube, Linkedin, Globe, CheckSquare, Square,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import StatCard from '../components/ui/StatCard';
import Tabs from '../components/ui/Tabs';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';

// ── Types ──────────────────────────────────────────────────────────────────────

type Platform = 'instagram' | 'tiktok' | 'twitter' | 'facebook' | 'youtube' | 'linkedin' | 'other';
type AudienceType = 'member' | 'creator' | 'general';
type PostType = 'post' | 'script' | 'countdown' | 'outreach';
type PostStatus = 'draft' | 'approved' | 'rejected' | 'posted' | 'archived';
type TabId = 'drafts' | 'tracking' | 'performance' | 'checklist';

interface PromoCampaign {
  id: string; name: string; goal: string; week: string;
  status: 'active' | 'paused' | 'completed';
  created_at: string; updated_at: string;
  total_posts: number; draft_count: number; approved_count: number; posted_count: number;
  creator_leads: number; waitlist_clicks: number;
}

interface PromoPost {
  id: string; campaign_id: string | null;
  post_type: PostType; platform: Platform; audience_type: AudienceType;
  hook: string; caption: string; hashtags: string; cta: string; asset_description: string;
  status: PostStatus; scheduled_for: string | null; posted_at: string | null; admin_notes: string;
  views: number; likes: number; comments: number; shares: number;
  clicks: number; creator_apps: number; waitlist_signups: number; tracking_notes: string;
  created_at: string; updated_at: string;
}

interface PerformanceSummary {
  best_hook: { hook: string; clicks: number; post_id: string } | null;
  best_platform: { platform: string; total_engagement: number } | null;
  best_audience: { audience_type: string; total_engagement: number } | null;
  highest_click_post: PromoPost | null;
  highest_creator_app_post: PromoPost | null;
  follow_up_needed: PromoPost[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'twitter', 'facebook', 'youtube', 'linkedin', 'other'];
const AUDIENCE_TYPES: AudienceType[] = ['member', 'creator', 'general'];
const POST_TYPES: PostType[] = ['post', 'script', 'countdown', 'outreach'];
const POST_STATUSES: PostStatus[] = ['draft', 'approved', 'rejected', 'posted', 'archived'];

const TODAY = new Date().toISOString().slice(0, 10);
const CHECKLIST_KEY = `claw_checklist_${TODAY}`;

const DAILY_CHECKLIST = [
  { id: '1', label: 'Post morning member hook on primary platform' },
  { id: '2', label: 'Post creator outreach content' },
  { id: '3', label: 'Review and approve pending drafts' },
  { id: '4', label: "Check performance stats from yesterday's posts" },
  { id: '5', label: 'Update tracking on posted content' },
  { id: '6', label: 'Send 3 personalized outreach messages' },
  { id: '7', label: 'Review follow-up needed items in Performance tab' },
  { id: '8', label: "Draft tomorrow's posts or approve generated content" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function platformIcon(p: Platform) {
  if (p === 'instagram') return <Instagram className="w-3.5 h-3.5" />;
  if (p === 'youtube')   return <Youtube className="w-3.5 h-3.5" />;
  if (p === 'linkedin')  return <Linkedin className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function statusColor(s: PostStatus) {
  switch (s) {
    case 'draft':    return 'bg-white/8 text-arc-secondary';
    case 'approved': return 'bg-arc-success/15 text-arc-success';
    case 'rejected': return 'bg-arc-error/15 text-arc-error';
    case 'posted':   return 'bg-gold/15 text-gold';
    case 'archived': return 'bg-white/5 text-arc-muted';
  }
}

function audienceColor(a: AudienceType) {
  switch (a) {
    case 'member':  return 'bg-blue-500/15 text-blue-400';
    case 'creator': return 'bg-purple-500/15 text-purple-400';
    case 'general': return 'bg-white/8 text-arc-secondary';
  }
}

function postTypeLabel(t: PostType) {
  switch (t) {
    case 'post':      return 'Post';
    case 'script':    return 'Script';
    case 'countdown': return 'Countdown';
    case 'outreach':  return 'Outreach';
  }
}

const BLANK_POST_FORM = {
  post_type: 'post' as PostType, platform: 'instagram' as Platform,
  audience_type: 'member' as AudienceType, hook: '', caption: '', hashtags: '',
  cta: '', asset_description: '', admin_notes: '', status: 'draft' as PostStatus,
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ClawPromotionPage() {
  const toast = useToast();

  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [posts, setPosts] = useState<PromoPost[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('drafts');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', goal: '', week: '' });
  const [savingCampaign, setSavingCampaign] = useState(false);

  const [editPost, setEditPost] = useState<PromoPost | null>(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [postForm, setPostForm] = useState({ ...BLANK_POST_FORM });
  const [savingPost, setSavingPost] = useState(false);
  const [editTab, setEditTab] = useState<'content' | 'tracking'>('content');

  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterAudience, setFilterAudience] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [trackingForm, setTrackingForm] = useState<Record<string, Partial<PromoPost>>>({});
  const [savingTracking, setSavingTracking] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) ?? '{}'); } catch { return {}; }
  });

  const [copied, setCopied] = useState<string | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadCampaigns = useCallback(async () => {
    const data = await apiFetch('/api/admin/promotion/campaigns');
    if (Array.isArray(data)) {
      setCampaigns(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    }
  }, [selectedId]);

  const loadPosts = useCallback(async (campaignId: string) => {
    if (!campaignId) { setPosts([]); return; }
    const qs = `?campaign_id=${campaignId}`;
    const data = await apiFetch(`/api/admin/promotion/posts${qs}`);
    if (Array.isArray(data)) setPosts(data);
  }, []);

  const loadSummary = useCallback(async (campaignId: string) => {
    const qs = campaignId ? `?campaign_id=${campaignId}` : '';
    const data = await apiFetch(`/api/admin/promotion/summary${qs}`);
    if (data && !data.error) setSummary(data as PerformanceSummary);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadCampaigns().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadPosts(selectedId);
      loadSummary(selectedId);
    }
  }, [selectedId]);

  // ── Campaign actions ──────────────────────────────────────────────────────

  async function createCampaign() {
    if (!campaignForm.name.trim()) { toast.error('Campaign name is required'); return; }
    setSavingCampaign(true);
    try {
      const data = await apiFetch('/api/admin/promotion/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignForm),
      });
      if (data?.error) { toast.error(data.error); return; }
      toast.success('Campaign created');
      setNewCampaignOpen(false);
      setCampaignForm({ name: '', goal: '', week: '' });
      await loadCampaigns();
      if (data?.id) setSelectedId(data.id);
    } catch { toast.error('Failed to create campaign'); }
    finally { setSavingCampaign(false); }
  }

  // ── Post actions ──────────────────────────────────────────────────────────

  async function quickStatus(postId: string, status: PostStatus) {
    const data = await apiFetch(`/api/admin/promotion/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (data?.error) { toast.error(data.error); return; }
    toast.success(`Post marked as ${status}`);
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...data } : p));
  }

  async function deletePost(postId: string) {
    if (!confirm('Delete this post?')) return;
    const data = await apiFetch(`/api/admin/promotion/posts/${postId}`, { method: 'DELETE' });
    if (data?.error) { toast.error(data.error); return; }
    toast.success('Post deleted');
    setPosts(prev => prev.filter(p => p.id !== postId));
  }

  async function savePost() {
    setSavingPost(true);
    try {
      if (editPost) {
        const data = await apiFetch(`/api/admin/promotion/posts/${editPost.id}`, {
          method: 'PATCH',
          body: JSON.stringify(postForm),
        });
        if (data?.error) { toast.error(data.error); return; }
        toast.success('Post updated');
        setPosts(prev => prev.map(p => p.id === editPost.id ? { ...p, ...data } : p));
      } else {
        const data = await apiFetch('/api/admin/promotion/posts', {
          method: 'POST',
          body: JSON.stringify({ ...postForm, campaign_id: selectedId }),
        });
        if (data?.error) { toast.error(data.error); return; }
        toast.success('Post created');
        setPosts(prev => [data, ...prev]);
      }
      setEditPost(null);
      setNewPostOpen(false);
      setPostForm({ ...BLANK_POST_FORM });
    } catch { toast.error('Failed to save post'); }
    finally { setSavingPost(false); }
  }

  function openEdit(post: PromoPost) {
    setEditPost(post);
    setPostForm({
      post_type: post.post_type, platform: post.platform,
      audience_type: post.audience_type, hook: post.hook,
      caption: post.caption, hashtags: post.hashtags, cta: post.cta,
      asset_description: post.asset_description, admin_notes: post.admin_notes,
      status: post.status,
    });
    setEditTab('content');
  }

  async function saveTracking(postId: string) {
    setSavingTracking(postId);
    try {
      const updates = trackingForm[postId] ?? {};
      const data = await apiFetch(`/api/admin/promotion/posts/${postId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (data?.error) { toast.error(data.error); return; }
      toast.success('Tracking updated');
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...data } : p));
      setTrackingForm(prev => { const n = { ...prev }; delete n[postId]; return n; });
    } catch { toast.error('Failed to save tracking'); }
    finally { setSavingTracking(null); }
  }

  // ── Generate pack ─────────────────────────────────────────────────────────

  async function generatePack() {
    if (!selectedId) { toast.error('Select a campaign first'); return; }
    setGenerating(true);
    try {
      const data = await apiFetch('/api/admin/promotion/generate', {
        method: 'POST',
        body: JSON.stringify({ campaign_id: selectedId }),
      });
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`Generated ${data.generated} posts`);
      await Promise.all([loadPosts(selectedId), loadCampaigns()]);
    } catch { toast.error('Generation failed'); }
    finally { setGenerating(false); }
  }

  // ── Copy ──────────────────────────────────────────────────────────────────

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  function copyFull(post: PromoPost) {
    const full = [post.hook, '', post.caption, '', post.hashtags, '', post.cta].join('\n').trim();
    copyText(full, `full-${post.id}`);
  }

  // ── Checklist ─────────────────────────────────────────────────────────────

  function toggleCheck(id: string) {
    const next = { ...checklist, [id]: !checklist[id] };
    setChecklist(next);
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next));
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const selectedCampaign = campaigns.find(c => c.id === selectedId);

  const filteredPosts = posts.filter(p => {
    if (filterPlatform && p.platform !== filterPlatform) return false;
    if (filterAudience && p.audience_type !== filterAudience) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  const draftCount = posts.filter(p => p.status === 'draft').length;
  const postedPosts = posts.filter(p => p.status === 'posted');
  const checkDone = DAILY_CHECKLIST.filter(i => checklist[i.id]).length;

  const tabs = [
    { id: 'drafts' as TabId, label: 'Drafts', badge: draftCount },
    { id: 'tracking' as TabId, label: 'Tracking', badge: postedPosts.length },
    { id: 'performance' as TabId, label: 'Performance' },
    { id: 'checklist' as TabId, label: 'Checklist', badge: DAILY_CHECKLIST.length - checkDone },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-arc-secondary text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gold/10 border border-gold-border">
              <Megaphone className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-white">Claw Promotion Command Center</h1>
              <p className="text-xs text-arc-secondary font-sans mt-0.5">Admin-only · Archangels Club launch toolkit</p>
            </div>
          </div>
          <button
            onClick={() => setNewCampaignOpen(true)}
            className="btn-gold text-sm px-4 py-2 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>

        {/* ── Campaign selector ────────────────────────────────────────────── */}
        {campaigns.length === 0 ? (
          <div className="card-surface p-12 text-center mb-8">
            <Megaphone className="w-10 h-10 text-arc-muted mx-auto mb-4" />
            <p className="text-white font-medium mb-1">No campaigns yet</p>
            <p className="text-arc-secondary text-sm mb-6">Create your first promotion campaign to get started.</p>
            <button onClick={() => setNewCampaignOpen(true)} className="btn-gold text-sm px-5 py-2.5">
              Create Campaign
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <select
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2.5 bg-bg-surface border border-gold-border/50 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-gold transition-colors cursor-pointer"
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-arc-secondary pointer-events-none" />
              </div>
              {selectedCampaign && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  selectedCampaign.status === 'active'    ? 'bg-arc-success/15 text-arc-success' :
                  selectedCampaign.status === 'paused'    ? 'bg-amber-500/15 text-amber-400' :
                  'bg-white/8 text-arc-secondary'
                }`}>
                  {selectedCampaign.status}
                </span>
              )}
              {selectedCampaign?.goal && (
                <span className="text-xs text-arc-secondary hidden sm:block">
                  Goal: {selectedCampaign.goal}
                </span>
              )}
              {selectedCampaign?.week && (
                <span className="text-xs text-arc-secondary hidden sm:block">
                  Week: {selectedCampaign.week}
                </span>
              )}
            </div>

            {/* ── Campaign stats ─────────────────────────────────────────── */}
            {selectedCampaign && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <StatCard label="Drafts"    value={selectedCampaign.draft_count}    icon={<BookOpen className="w-4 h-4" />} />
                <StatCard label="Approved"  value={selectedCampaign.approved_count} icon={<Check className="w-4 h-4" />} trend="up" />
                <StatCard label="Posted"    value={selectedCampaign.posted_count}   icon={<Megaphone className="w-4 h-4" />} trend="up" />
                <StatCard label="Creator Leads"   value={selectedCampaign.creator_leads}   icon={<Users className="w-4 h-4" />} trend="up" />
                <StatCard label="Waitlist Clicks" value={selectedCampaign.waitlist_clicks} icon={<Target className="w-4 h-4" />} trend="up" />
                <StatCard label="Total Posts" value={selectedCampaign.total_posts} icon={<BarChart2 className="w-4 h-4" />} />
              </div>
            )}

            {/* ── Generate Pack ───────────────────────────────────────────── */}
            <div className="card-surface p-4 mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Generate Promotion Pack</p>
                <p className="text-xs text-arc-secondary mt-0.5">
                  Creates 19 draft posts: 5 member · 5 creator · 3 TikTok scripts · 3 countdown · 3 outreach
                </p>
              </div>
              <button
                onClick={generatePack}
                disabled={generating || !selectedId}
                className="btn-gold text-sm px-5 py-2.5 flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
              >
                <Zap className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} />
                {generating ? 'Generating…' : 'Generate Pack'}
              </button>
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="mb-6">
              <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} variant="pill" />
            </div>

            {/* ────────────────── DRAFTS TAB ──────────────────────────────── */}
            {activeTab === 'drafts' && (
              <div>
                {/* Filters + New Post */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <select
                    value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
                    className="text-xs px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-arc-secondary focus:outline-none focus:border-gold/50"
                  >
                    <option value="">All Platforms</option>
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select
                    value={filterAudience} onChange={e => setFilterAudience(e.target.value)}
                    className="text-xs px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-arc-secondary focus:outline-none focus:border-gold/50"
                  >
                    <option value="">All Audiences</option>
                    {AUDIENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select
                    value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="text-xs px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-arc-secondary focus:outline-none focus:border-gold/50"
                  >
                    <option value="">All Statuses</option>
                    {POST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex-1" />
                  <button
                    onClick={() => { setEditPost(null); setPostForm({ ...BLANK_POST_FORM }); setNewPostOpen(true); }}
                    className="text-xs px-3 py-2 bg-bg-surface border border-gold-border/50 text-gold rounded-lg hover:bg-gold/5 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Post
                  </button>
                </div>

                {filteredPosts.length === 0 ? (
                  <div className="card-surface p-10 text-center">
                    <Megaphone className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                    <p className="text-arc-secondary text-sm">No posts yet. Generate a pack or add one manually.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredPosts.map(post => (
                      <PostRow
                        key={post.id}
                        post={post}
                        copied={copied}
                        onEdit={() => openEdit(post)}
                        onDelete={() => deletePost(post.id)}
                        onStatusChange={s => quickStatus(post.id, s)}
                        onCopyCaption={() => copyText(post.caption, `cap-${post.id}`)}
                        onCopyHashtags={() => copyText(post.hashtags, `hash-${post.id}`)}
                        onCopyFull={() => copyFull(post)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─────────────────── TRACKING TAB ───────────────────────────── */}
            {activeTab === 'tracking' && (
              <div className="space-y-4">
                {postedPosts.length === 0 ? (
                  <div className="card-surface p-10 text-center">
                    <TrendingUp className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                    <p className="text-arc-secondary text-sm">No posted items yet. Post content to track performance.</p>
                  </div>
                ) : postedPosts.map(post => {
                  const tf = trackingForm[post.id] ?? {};
                  const get = (key: keyof PromoPost) =>
                    (tf as Record<string, unknown>)[key] !== undefined
                      ? String((tf as Record<string, unknown>)[key])
                      : String(post[key] ?? '');
                  const setField = (key: keyof PromoPost, val: string) =>
                    setTrackingForm(prev => ({
                      ...prev,
                      [post.id]: { ...prev[post.id], [key]: key === 'tracking_notes' ? val : Number(val) },
                    }));

                  return (
                    <div key={post.id} className="card-surface p-5">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-arc-secondary flex items-center gap-1">
                              {platformIcon(post.platform)} {post.platform}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${audienceColor(post.audience_type)}`}>
                              {post.audience_type}
                            </span>
                            {post.posted_at && (
                              <span className="text-xs text-arc-muted">
                                Posted {new Date(post.posted_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-white font-medium truncate">{post.hook}</p>
                        </div>
                        <button
                          onClick={() => saveTracking(post.id)}
                          disabled={savingTracking === post.id}
                          className="text-xs px-3 py-1.5 btn-gold disabled:opacity-50"
                        >
                          {savingTracking === post.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>

                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mb-3">
                        {(['views','likes','comments','shares','clicks','creator_apps','waitlist_signups'] as (keyof PromoPost)[]).map(key => (
                          <div key={key}>
                            <label className="text-xs text-arc-muted block mb-1 capitalize">{key.replace('_',' ')}</label>
                            <input
                              type="number" min="0"
                              value={get(key)}
                              onChange={e => setField(key, e.target.value)}
                              className="w-full px-2 py-1.5 bg-bg-hover border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:border-gold/50"
                            />
                          </div>
                        ))}
                      </div>

                      <div>
                        <label className="text-xs text-arc-muted block mb-1">Tracking Notes</label>
                        <textarea
                          rows={2}
                          value={get('tracking_notes')}
                          onChange={e => setField('tracking_notes', e.target.value)}
                          placeholder="Add notes about this post's performance…"
                          className="w-full px-3 py-2 bg-bg-hover border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:border-gold/50 resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ──────────────── PERFORMANCE TAB ───────────────────────────── */}
            {activeTab === 'performance' && (
              <div className="space-y-6">
                {!summary ? (
                  <div className="card-surface p-10 text-center">
                    <BarChart2 className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                    <p className="text-arc-secondary text-sm">No performance data yet. Post content and add tracking.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-2">Best Hook</p>
                        {summary.best_hook ? (
                          <>
                            <p className="text-white text-sm font-medium leading-snug mb-2">"{summary.best_hook.hook}"</p>
                            <p className="text-gold text-xs">{summary.best_hook.clicks} clicks</p>
                          </>
                        ) : <p className="text-arc-muted text-sm">No data yet</p>}
                      </div>
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-2">Best Platform</p>
                        {summary.best_platform ? (
                          <>
                            <p className="text-white text-sm font-medium capitalize mb-2">{summary.best_platform.platform}</p>
                            <p className="text-gold text-xs">{summary.best_platform.total_engagement} total engagement</p>
                          </>
                        ) : <p className="text-arc-muted text-sm">No data yet</p>}
                      </div>
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-2">Best Audience</p>
                        {summary.best_audience ? (
                          <>
                            <p className="text-white text-sm font-medium capitalize mb-2">{summary.best_audience.audience_type}</p>
                            <p className="text-gold text-xs">{summary.best_audience.total_engagement} total engagement</p>
                          </>
                        ) : <p className="text-arc-muted text-sm">No data yet</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-3">Highest Click Post</p>
                        {summary.highest_click_post ? (
                          <SummaryPostCard post={summary.highest_click_post} metric="clicks" />
                        ) : <p className="text-arc-muted text-sm">No data yet</p>}
                      </div>
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-3">Highest Creator Apps</p>
                        {summary.highest_creator_app_post ? (
                          <SummaryPostCard post={summary.highest_creator_app_post} metric="creator_apps" />
                        ) : <p className="text-arc-muted text-sm">No data yet</p>}
                      </div>
                    </div>

                    {summary.follow_up_needed.length > 0 && (
                      <div className="card-surface p-5">
                        <p className="text-xs text-arc-secondary uppercase tracking-wider mb-3">Follow-up Needed</p>
                        <div className="space-y-2">
                          {summary.follow_up_needed.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-3 bg-bg-hover rounded-lg">
                              <span className="text-xs text-arc-secondary flex items-center gap-1">
                                {platformIcon(p.platform)} {p.platform}
                              </span>
                              <p className="text-sm text-white flex-1 truncate">{p.hook}</p>
                              <span className="text-xs text-gold">{p.clicks} clicks</span>
                              <button
                                onClick={() => { openEdit(p); setEditTab('tracking'); }}
                                className="text-xs text-arc-secondary hover:text-white"
                              >
                                Add notes
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ──────────────── CHECKLIST TAB ─────────────────────────────── */}
            {activeTab === 'checklist' && (
              <div className="max-w-2xl">
                <div className="card-surface p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-white font-medium">Claw Daily Checklist</p>
                      <p className="text-xs text-arc-secondary mt-0.5">{TODAY} · {checkDone}/{DAILY_CHECKLIST.length} complete</p>
                    </div>
                    <ClipboardCheck className="w-5 h-5 text-gold" />
                  </div>

                  <div className="w-full h-1.5 bg-bg-hover rounded-full mb-6 overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all duration-500"
                      style={{ width: `${(checkDone / DAILY_CHECKLIST.length) * 100}%` }}
                    />
                  </div>

                  <div className="space-y-2">
                    {DAILY_CHECKLIST.map(item => (
                      <button
                        key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-bg-hover transition-colors text-left group"
                      >
                        {checklist[item.id]
                          ? <CheckSquare className="w-5 h-5 text-gold flex-shrink-0" />
                          : <Square className="w-5 h-5 text-arc-muted flex-shrink-0 group-hover:text-arc-secondary transition-colors" />
                        }
                        <span className={`text-sm transition-colors ${checklist[item.id] ? 'text-arc-muted line-through' : 'text-white'}`}>
                          {item.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {checkDone === DAILY_CHECKLIST.length && (
                    <div className="mt-6 p-4 bg-gold/8 border border-gold-border rounded-xl text-center">
                      <p className="text-gold text-sm font-medium">All done for today. 🎯</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── New Campaign Modal ─────────────────────────────────────────────── */}
      <Modal open={newCampaignOpen} onClose={() => setNewCampaignOpen(false)} title="New Campaign" size="sm">
        <div className="space-y-4 p-1">
          <Input
            label="Campaign Name"
            value={campaignForm.name}
            onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. June Launch Push"
          />
          <Input
            label="Goal"
            value={campaignForm.goal}
            onChange={e => setCampaignForm(f => ({ ...f, goal: e.target.value }))}
            placeholder="e.g. 50 creator leads, 200 waitlist signups"
          />
          <Input
            label="Week"
            value={campaignForm.week}
            onChange={e => setCampaignForm(f => ({ ...f, week: e.target.value }))}
            placeholder="e.g. Jun 23 – Jun 29"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setNewCampaignOpen(false)} className="btn-ghost text-sm">Cancel</button>
            <button onClick={createCampaign} disabled={savingCampaign} className="btn-gold text-sm px-5 py-2.5">
              {savingCampaign ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Edit / New Post Modal ──────────────────────────────────────────── */}
      <Modal
        open={newPostOpen || editPost !== null}
        onClose={() => { setEditPost(null); setNewPostOpen(false); }}
        title={editPost ? 'Edit Post' : 'New Post'}
        size="lg"
      >
        <div className="p-1">
          {/* Sub-tabs for edit modal */}
          <div className="flex gap-1 p-1 rounded-lg bg-bg-hover w-fit mb-5">
            {(['content', 'tracking'] as const).map(t => (
              <button
                key={t}
                onClick={() => setEditTab(t)}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${editTab === t ? 'bg-gold text-bg-primary' : 'text-arc-secondary hover:text-white'}`}
              >
                {t === 'content' ? 'Content' : 'Tracking'}
              </button>
            ))}
          </div>

          {editTab === 'content' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-arc-secondary block mb-1.5">Type</label>
                  <select
                    value={postForm.post_type}
                    onChange={e => setPostForm(f => ({ ...f, post_type: e.target.value as PostType }))}
                    className="w-full px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-gold/50"
                  >
                    {POST_TYPES.map(t => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-arc-secondary block mb-1.5">Platform</label>
                  <select
                    value={postForm.platform}
                    onChange={e => setPostForm(f => ({ ...f, platform: e.target.value as Platform }))}
                    className="w-full px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-gold/50"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-arc-secondary block mb-1.5">Audience</label>
                  <select
                    value={postForm.audience_type}
                    onChange={e => setPostForm(f => ({ ...f, audience_type: e.target.value as AudienceType }))}
                    className="w-full px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-gold/50"
                  >
                    {AUDIENCE_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <Input
                label="Hook"
                value={postForm.hook}
                onChange={e => setPostForm(f => ({ ...f, hook: e.target.value }))}
                placeholder="Opening line that grabs attention"
              />
              <Textarea
                label="Caption"
                value={postForm.caption}
                onChange={e => setPostForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="Full post body…"
                rows={5}
              />
              <Input
                label="Hashtags"
                value={postForm.hashtags}
                onChange={e => setPostForm(f => ({ ...f, hashtags: e.target.value }))}
                placeholder="#ArchangelsClub #InviteOnly"
              />
              <Input
                label="CTA"
                value={postForm.cta}
                onChange={e => setPostForm(f => ({ ...f, cta: e.target.value }))}
                placeholder="Apply at archangelsclub.com"
              />
              <Input
                label="Asset Description"
                value={postForm.asset_description}
                onChange={e => setPostForm(f => ({ ...f, asset_description: e.target.value }))}
                placeholder="Describe the visual / video asset needed"
              />
              <div>
                <label className="text-xs text-arc-secondary block mb-1.5">Status</label>
                <select
                  value={postForm.status}
                  onChange={e => setPostForm(f => ({ ...f, status: e.target.value as PostStatus }))}
                  className="w-full px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-gold/50"
                >
                  {POST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Textarea
                label="Admin Notes"
                value={postForm.admin_notes}
                onChange={e => setPostForm(f => ({ ...f, admin_notes: e.target.value }))}
                placeholder="Internal notes…"
                rows={2}
              />
            </div>
          )}

          {editTab === 'tracking' && editPost && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {(['views','likes','comments','shares','clicks','creator_apps','waitlist_signups'] as (keyof PromoPost)[]).map(key => {
                  const tf = trackingForm[editPost.id] ?? {};
                  const val = (tf as Record<string, unknown>)[key] !== undefined
                    ? String((tf as Record<string, unknown>)[key])
                    : String(editPost[key] ?? 0);
                  return (
                    <div key={key}>
                      <label className="text-xs text-arc-muted block mb-1 capitalize">{key.replace(/_/g,' ')}</label>
                      <input
                        type="number" min="0" value={val}
                        onChange={e => setTrackingForm(prev => ({
                          ...prev,
                          [editPost.id]: { ...prev[editPost.id], [key]: Number(e.target.value) },
                        }))}
                        className="w-full px-3 py-2 bg-bg-surface border border-white/8 rounded-lg text-white text-sm focus:outline-none focus:border-gold/50"
                      />
                    </div>
                  );
                })}
              </div>
              <Textarea
                label="Tracking Notes"
                value={
                  (trackingForm[editPost.id] as Record<string, unknown>)?.tracking_notes !== undefined
                    ? String((trackingForm[editPost.id] as Record<string, unknown>).tracking_notes)
                    : editPost.tracking_notes
                }
                onChange={e => setTrackingForm(prev => ({
                  ...prev,
                  [editPost.id]: { ...prev[editPost.id], tracking_notes: e.target.value },
                }))}
                placeholder="Notes on performance…"
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-5">
            <button onClick={() => { setEditPost(null); setNewPostOpen(false); }} className="btn-ghost text-sm">Cancel</button>
            <button
              onClick={editTab === 'tracking' && editPost ? () => { void saveTracking(editPost.id).then(() => { setEditPost(null); }); } : savePost}
              disabled={savingPost || savingTracking !== null}
              className="btn-gold text-sm px-5 py-2.5"
            >
              {(savingPost || savingTracking !== null) ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PostRow({
  post, copied, onEdit, onDelete, onStatusChange, onCopyCaption, onCopyHashtags, onCopyFull,
}: {
  post: PromoPost;
  copied: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: PostStatus) => void;
  onCopyCaption: () => void;
  onCopyHashtags: () => void;
  onCopyFull: () => void;
}) {
  return (
    <div className="card-surface p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      {/* Left: meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-arc-secondary flex items-center gap-1 w-24">
          {platformIcon(post.platform)} {post.platform}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${audienceColor(post.audience_type)}`}>
          {post.audience_type}
        </span>
        <span className="text-xs text-arc-muted">{postTypeLabel(post.post_type)}</span>
      </div>

      {/* Hook */}
      <p className="text-sm text-white flex-1 truncate min-w-0">{post.hook}</p>

      {/* Status */}
      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor(post.status)}`}>
        {post.status}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Workflow buttons */}
        {post.status === 'draft' && (
          <>
            <ActionBtn onClick={() => onStatusChange('approved')} label="Approve" color="success" />
            <ActionBtn onClick={() => onStatusChange('rejected')} label="Reject" color="error" />
          </>
        )}
        {post.status === 'approved' && (
          <ActionBtn onClick={() => onStatusChange('posted')} label="Posted" color="gold" />
        )}
        {post.status === 'rejected' && (
          <ActionBtn onClick={() => onStatusChange('draft')} label="Reset" color="muted" />
        )}
        {post.status === 'posted' && (
          <ActionBtn onClick={() => onStatusChange('archived')} label="Archive" color="muted" />
        )}

        {/* Copy buttons */}
        <button onClick={onCopyCaption} className="p-1.5 text-arc-muted hover:text-white transition-colors" title="Copy Caption">
          {copied === `cap-${post.id}` ? <Check className="w-3.5 h-3.5 text-arc-success" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onCopyFull} className="p-1.5 text-arc-muted hover:text-white transition-colors" title="Copy Full Post">
          {copied === `full-${post.id}` ? <Check className="w-3.5 h-3.5 text-arc-success" /> : <BookOpen className="w-3.5 h-3.5" />}
        </button>

        {/* Edit + Delete */}
        <button onClick={onEdit} className="p-1.5 text-arc-muted hover:text-white transition-colors" title="Edit">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-arc-muted hover:text-arc-error transition-colors" title="Delete">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, label, color }: { onClick: () => void; label: string; color: 'success'|'error'|'gold'|'muted' }) {
  const cls = {
    success: 'bg-arc-success/10 text-arc-success hover:bg-arc-success/20',
    error:   'bg-arc-error/10 text-arc-error hover:bg-arc-error/20',
    gold:    'bg-gold/10 text-gold hover:bg-gold/20',
    muted:   'bg-white/5 text-arc-secondary hover:bg-white/10',
  }[color];
  return (
    <button onClick={onClick} className={`text-xs px-2 py-1 rounded-lg transition-colors ${cls}`}>
      {label}
    </button>
  );
}

function SummaryPostCard({ post, metric }: { post: PromoPost; metric: keyof PromoPost }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-arc-secondary flex items-center gap-1">
          {platformIcon(post.platform)} {post.platform}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${audienceColor(post.audience_type)}`}>
          {post.audience_type}
        </span>
      </div>
      <p className="text-sm text-white font-medium">{post.hook}</p>
      <p className="text-xs text-gold">{String(post[metric])} {String(metric).replace('_',' ')}</p>
    </div>
  );
}
