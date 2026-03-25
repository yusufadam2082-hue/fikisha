import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  CalendarRange,
  Clock3,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';

interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string | null;
  bgColor: string;
  image: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

type FormState = {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  bgColor: string;
  image: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

type StatusFilter = 'all' | 'live' | 'scheduled' | 'expired' | 'inactive';

const DEFAULT_PROMOTION_COLOR = '#FF5A5F';

const emptyForm: FormState = {
  title: '',
  subtitle: '',
  ctaText: 'Order now',
  ctaLink: '',
  bgColor: DEFAULT_PROMOTION_COLOR,
  image: '',
  active: true,
  startsAt: '',
  endsAt: '',
};

const colorPresets = ['#FF5A5F', '#F97316', '#14B8A6', '#0EA5E9', '#111827'];

function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value.trim());
}

function getSafeColorValue(value: string): string {
  return isValidHexColor(value) ? value.trim() : DEFAULT_PROMOTION_COLOR;
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string | null {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateLabel(value: string | null): string {
  if (!value) {
    return 'Any time';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getPromotionState(promotion: Promotion, currentTime = new Date()): Exclude<StatusFilter, 'all'> {
  if (!promotion.active) {
    return 'inactive';
  }

  const startsAt = promotion.startsAt ? new Date(promotion.startsAt) : null;
  const endsAt = promotion.endsAt ? new Date(promotion.endsAt) : null;

  if (startsAt && startsAt > currentTime) {
    return 'scheduled';
  }

  if (endsAt && endsAt < currentTime) {
    return 'expired';
  }

  return 'live';
}

function getPromotionStateTheme(promotion: Promotion) {
  const state = getPromotionState(promotion);

  if (state === 'inactive') {
    return {
      state,
      label: 'Inactive',
      textColor: 'var(--text-muted)',
      background: 'var(--surface-hover)',
    };
  }

  if (state === 'scheduled') {
    return {
      state,
      label: 'Scheduled',
      textColor: '#0EA5E9',
      background: 'rgba(14, 165, 233, 0.12)',
    };
  }

  if (state === 'expired') {
    return {
      state,
      label: 'Expired',
      textColor: 'var(--error)',
      background: 'rgba(220, 38, 38, 0.10)',
    };
  }

  return {
    state,
    label: 'Live',
    textColor: '#15803D',
    background: 'rgba(34, 197, 94, 0.12)',
  };
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null) as
    | { error?: string; message?: string; errors?: Array<{ msg?: string }> }
    | null;

  if (payload?.error) {
    return payload.error;
  }

  if (payload?.message) {
    return payload.message;
  }

  if (payload?.errors?.length) {
    return payload.errors.map((item) => item.msg).filter(Boolean).join(', ');
  }

  return fallback;
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

export function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const previewPromotion: Promotion = {
    id: editingId || 'preview',
    title: form.title || 'Your promotion headline appears here',
    subtitle: form.subtitle || 'Add a supporting message to explain the offer, timing, or incentive.',
    ctaText: form.ctaText || 'Order now',
    ctaLink: form.ctaLink.trim() || null,
    bgColor: getSafeColorValue(form.bgColor),
    image: form.image.trim() || null,
    active: form.active,
    startsAt: toIsoDateTime(form.startsAt),
    endsAt: toIsoDateTime(form.endsAt),
    createdAt: new Date().toISOString(),
  };

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/promotions', { headers: getAuthHeaders() });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to load promotions'));
      }

      setPromotions(await response.json());
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load promotions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPromotions();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (promotion: Promotion) => {
    setForm({
      title: promotion.title,
      subtitle: promotion.subtitle,
      ctaText: promotion.ctaText,
      ctaLink: promotion.ctaLink ?? '',
      bgColor: promotion.bgColor || DEFAULT_PROMOTION_COLOR,
      image: promotion.image ?? '',
      active: promotion.active,
      startsAt: toDateTimeLocalValue(promotion.startsAt),
      endsAt: toDateTimeLocalValue(promotion.endsAt),
    });
    setEditingId(promotion.id);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.subtitle.trim()) {
      setFormError('Title and subtitle are required.');
      return;
    }

    if (!isValidHexColor(form.bgColor)) {
      setFormError('Background color must be a valid 6-digit hex value like #FF5A5F.');
      return;
    }

    const startsAt = toIsoDateTime(form.startsAt);
    const endsAt = toIsoDateTime(form.endsAt);

    if (form.startsAt && !startsAt) {
      setFormError('Start date is invalid.');
      return;
    }

    if (form.endsAt && !endsAt) {
      setFormError('End date is invalid.');
      return;
    }

    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setFormError('End date must be later than the start date.');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        ctaText: form.ctaText.trim() || 'Order now',
        ctaLink: form.ctaLink.trim() || null,
        bgColor: getSafeColorValue(form.bgColor),
        image: form.image.trim() || null,
        active: form.active,
        startsAt,
        endsAt,
      };

      const url = editingId ? `/api/admin/promotions/${editingId}` : '/api/admin/promotions';
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Save failed'));
      }

      await fetchPromotions();
      closeForm();
    } catch (caughtError) {
      setFormError(caughtError instanceof Error ? caughtError.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promotion: Promotion) => {
    try {
      const response = await fetch(`/api/admin/promotions/${promotion.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ active: !promotion.active }),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to update promotion'));
      }

      setPromotions((currentPromotions) =>
        currentPromotions.map((item) =>
          item.id === promotion.id ? { ...item, active: !item.active } : item,
        ),
      );
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update promotion');
    }
  };

  const handleDelete = async (promotionId: string) => {
    if (!window.confirm('Delete this promotion?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/promotions/${promotionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Failed to delete promotion'));
      }

      setPromotions((currentPromotions) => currentPromotions.filter((item) => item.id !== promotionId));
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete promotion');
    }
  };

  const field = (label: string, node: ReactNode, hint?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <label className="text-sm" style={{ fontWeight: 700, display: 'block', marginBottom: '2px' }}>{label}</label>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {node}
    </div>
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: promotions.length,
      live: 0,
      scheduled: 0,
      expired: 0,
      inactive: 0,
    };

    for (const promotion of promotions) {
      counts[getPromotionState(promotion)] += 1;
    }

    return counts;
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return promotions.filter((promotion) => {
      const matchesStatus = statusFilter === 'all' || getPromotionState(promotion) === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        promotion.title.toLowerCase().includes(normalizedQuery) ||
        promotion.subtitle.toLowerCase().includes(normalizedQuery) ||
        promotion.ctaText.toLowerCase().includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [promotions, searchQuery, statusFilter]);

  const summaryCards = [
    {
      title: 'Total campaigns',
      value: promotions.length,
      subtitle: 'Everything in your banner library',
      icon: Megaphone,
      color: 'var(--primary)',
    },
    {
      title: 'Live now',
      value: statusCounts.live,
      subtitle: 'Visible in the customer hero area',
      icon: Sparkles,
      color: '#15803D',
    },
    {
      title: 'Scheduled',
      value: statusCounts.scheduled,
      subtitle: 'Ready to launch automatically',
      icon: Clock3,
      color: '#0EA5E9',
    },
    {
      title: 'Expired or off',
      value: statusCounts.expired + statusCounts.inactive,
      subtitle: 'Need review or reactivation',
      icon: CalendarRange,
      color: 'var(--secondary)',
    },
  ];

  const filterOptions: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'expired', label: 'Expired' },
    { key: 'inactive', label: 'Inactive' },
  ];

  const previewTheme = getPromotionStateTheme(previewPromotion);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(255, 90, 95, 0.12) 0%, rgba(249, 115, 22, 0.12) 100%)',
          border: '1px solid rgba(255, 90, 95, 0.16)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 30px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ maxWidth: '720px' }}>
            <p className="text-sm" style={{ color: 'var(--primary)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Promotions Control
            </p>
            <h1 className="text-h1" style={{ marginBottom: '8px' }}>Design what customers see first</h1>
            <p className="text-body text-muted">
              Launch timed offers, featured campaigns, and hero banners without touching the customer homepage layout.
            </p>
          </div>
          <Button onClick={openCreate} size="lg">
            <Plus size={18} /> New Promotion
          </Button>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {summaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} hoverable={false} style={{ padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>{item.title}</p>
                  <p className="text-h2" style={{ marginBottom: '4px' }}>{item.value}</p>
                  <p className="text-sm text-muted">{item.subtitle}</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '16px', background: `${item.color}15`, color: item.color }}>
                  <Icon size={22} />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <Card hoverable={false} style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 className="text-h2" style={{ fontSize: '1.4rem', marginBottom: '4px' }}>Campaign library</h2>
              <p className="text-sm text-muted">Search, filter, and manage your promotion inventory.</p>
            </div>
            <div className="input-wrapper" style={{ maxWidth: '360px', width: '100%' }}>
              <Search size={18} className="input-icon" />
              <input
                className="input-field"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title, subtitle, or CTA"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {filterOptions.map((option) => {
              const isActive = statusFilter === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setStatusFilter(option.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    borderRadius: '999px',
                    border: isActive ? '1px solid rgba(255, 90, 95, 0.2)' : '1px solid var(--border)',
                    background: isActive ? 'rgba(255, 90, 95, 0.10)' : 'var(--surface)',
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: 700,
                    boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  }}
                >
                  <span>{option.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{statusCounts[option.key]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {showForm ? (
        <div
          onClick={closeForm}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '40px 20px 24px',
            overflowY: 'auto',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Card
            hoverable={false}
            style={{
              width: '100%',
              maxWidth: '1080px',
              padding: '0',
              overflow: 'hidden',
              maxHeight: 'calc(100vh - 64px)',
              margin: '0 auto',
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', minHeight: '100%' }}
            >
              <div style={{ padding: '28px', borderRight: '1px solid var(--border)', overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
                <div className="flex-between" style={{ marginBottom: '24px', gap: '16px', alignItems: 'flex-start' }}>
                  <div>
                    <p className="text-sm" style={{ color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                      {editingId ? 'Update campaign' : 'Create campaign'}
                    </p>
                    <h2 className="text-h2" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
                      {editingId ? 'Edit promotion' : 'New promotion'}
                    </h2>
                    <p className="text-sm text-muted">Everything you change here updates the homepage hero presentation.</p>
                  </div>
                  <button onClick={closeForm} style={{ color: 'var(--text-muted)' }}>
                    <X size={20} />
                  </button>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSave();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
                >
                  <div style={{ display: 'grid', gap: '18px' }}>
                    {field(
                      'Title *',
                      <input
                        className="input-field"
                        value={form.title}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, title: event.target.value }))}
                        placeholder="Fresh lunch deals for office hours"
                      />,
                      'Keep it short enough to scan quickly in the hero banner.',
                    )}

                    {field(
                      'Subtitle *',
                      <textarea
                        value={form.subtitle}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, subtitle: event.target.value }))}
                        placeholder="Free delivery on selected restaurants between 11:00 AM and 2:00 PM."
                        style={{
                          minHeight: '110px',
                          width: '100%',
                          padding: '16px 20px',
                          borderRadius: '20px',
                          border: '2px solid transparent',
                          background: 'var(--surface)',
                          color: 'var(--text-main)',
                          boxShadow: 'var(--shadow-sm)',
                          outline: 'none',
                          resize: 'vertical',
                          font: 'inherit',
                        }}
                      />,
                      'Use one strong supporting line that explains the offer.',
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {field(
                      'Button text',
                      <input
                        className="input-field"
                        value={form.ctaText}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, ctaText: event.target.value }))}
                        placeholder="Order now"
                      />,
                      'The call to action customers will click.',
                    )}

                    {field(
                      'Button link',
                      <input
                        className="input-field"
                        type="url"
                        value={form.ctaLink}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, ctaLink: event.target.value }))}
                        placeholder="Optional external URL"
                      />,
                      'Leave blank to scroll customers to the store list.',
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {field(
                      'Background color',
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="color"
                          value={getSafeColorValue(form.bgColor)}
                          onChange={(event) => setForm((currentForm) => ({ ...currentForm, bgColor: event.target.value }))}
                          style={{ width: '52px', height: '48px', border: 'none', borderRadius: '12px', cursor: 'pointer', padding: '2px' }}
                        />
                        <input
                          className="input-field"
                          value={form.bgColor}
                          onChange={(event) => setForm((currentForm) => ({ ...currentForm, bgColor: event.target.value.toUpperCase() }))}
                          style={{ flex: 1 }}
                          placeholder="#FF5A5F"
                        />
                      </div>,
                      'Used when no background image is provided.',
                    )}

                    {field(
                      'Background image URL',
                      <input
                        className="input-field"
                        type="url"
                        value={form.image}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, image: event.target.value }))}
                        placeholder="https://example.com/promo.jpg"
                      />,
                      'Optional. A strong image usually performs better than solid color alone.',
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {colorPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setForm((currentForm) => ({ ...currentForm, bgColor: preset }))}
                        title={`Use ${preset}`}
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: preset,
                          border: form.bgColor === preset ? '3px solid var(--text-main)' : '2px solid rgba(15, 23, 42, 0.12)',
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    {field(
                      'Start date',
                      <input
                        type="datetime-local"
                        className="input-field"
                        value={form.startsAt}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, startsAt: event.target.value }))}
                      />,
                      'Optional. Leave blank to make it eligible immediately.',
                    )}

                    {field(
                      'End date',
                      <input
                        type="datetime-local"
                        className="input-field"
                        value={form.endsAt}
                        onChange={(event) => setForm((currentForm) => ({ ...currentForm, endsAt: event.target.value }))}
                      />,
                      'Optional. Useful for flash sales and seasonal campaigns.',
                    )}
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: '16px',
                      background: 'var(--surface-hover)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((currentForm) => ({ ...currentForm, active: event.target.checked }))}
                    />
                    <div>
                      <p className="text-sm" style={{ fontWeight: 700 }}>Visible to customers</p>
                      <p className="text-sm text-muted">Turn this off to keep the campaign in your library without showing it live.</p>
                    </div>
                  </label>

                  {formError ? (
                    <div style={{ padding: '14px 16px', borderRadius: '16px', background: 'rgba(220, 38, 38, 0.08)', color: 'var(--error)', border: '1px solid rgba(220, 38, 38, 0.14)' }}>
                      <p className="text-sm" style={{ fontWeight: 700, marginBottom: '2px' }}>Could not save promotion</p>
                      <p className="text-sm">{formError}</p>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px', flexWrap: 'wrap' }}>
                    <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create promotion'}
                    </Button>
                  </div>
                </form>
              </div>

              <div style={{ padding: '28px', background: 'linear-gradient(180deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.8) 100%)', overflowY: 'auto', maxHeight: 'calc(100vh - 64px)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <p className="text-sm" style={{ color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Live preview
                  </p>
                  <h3 className="text-h2" style={{ fontSize: '1.4rem', marginBottom: '6px' }}>How customers will experience it</h3>
                  <p className="text-sm text-muted">Use this panel to balance message length, timing, and visual weight before publishing.</p>
                </div>

                <div
                  style={{
                    borderRadius: '28px',
                    overflow: 'hidden',
                    minHeight: '280px',
                    padding: '32px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    position: 'relative',
                    color: '#fff',
                    background: previewPromotion.image
                      ? `linear-gradient(rgba(15, 23, 42, 0.42), rgba(15, 23, 42, 0.60)), url(${previewPromotion.image}) center/cover`
                      : `linear-gradient(135deg, ${previewPromotion.bgColor} 0%, rgba(15, 23, 42, 0.92) 100%)`,
                    boxShadow: '0 18px 38px rgba(15, 23, 42, 0.18)',
                  }}
                >
                  <div style={{ maxWidth: '440px', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'inline-flex', padding: '7px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', marginBottom: '14px', fontWeight: 700, fontSize: '0.82rem' }}>
                      Hero banner preview
                    </div>
                    <h2 style={{ fontSize: '2rem', lineHeight: 1.1, marginBottom: '12px', fontWeight: 800 }}>
                      {previewPromotion.title}
                    </h2>
                    <p style={{ fontSize: '1rem', opacity: 0.92, marginBottom: '20px', maxWidth: '38ch' }}>
                      {previewPromotion.subtitle}
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 22px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', fontWeight: 800 }}>
                      {previewPromotion.ctaText}
                    </div>
                  </div>
                  <div style={{ position: 'absolute', right: '-30px', top: '-30px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '18px' }}>
                  <Card hoverable={false} style={{ padding: '16px' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>State</p>
                    <p className="text-sm" style={{ fontWeight: 800, color: previewTheme.textColor }}>
                      {previewTheme.label}
                    </p>
                  </Card>
                  <Card hoverable={false} style={{ padding: '16px' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>Start</p>
                    <p className="text-sm" style={{ fontWeight: 700 }}>{formatDateLabel(previewPromotion.startsAt)}</p>
                  </Card>
                  <Card hoverable={false} style={{ padding: '16px' }}>
                    <p className="text-sm text-muted" style={{ marginBottom: '6px' }}>End</p>
                    <p className="text-sm" style={{ fontWeight: 700 }}>{formatDateLabel(previewPromotion.endsAt)}</p>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {error ? (
        <Card hoverable={false} style={{ padding: '18px 20px', background: 'rgba(220, 38, 38, 0.06)', borderColor: 'rgba(220, 38, 38, 0.15)' }}>
          <div className="flex-between" style={{ gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <p className="text-sm" style={{ color: 'var(--error)', fontWeight: 800, marginBottom: '4px' }}>Promotion action failed</p>
              <p className="text-sm text-muted">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void fetchPromotions()}>Retry</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Card hoverable={false} style={{ padding: '40px', textAlign: 'center' }}>
          <p className="text-h3" style={{ marginBottom: '8px' }}>Loading promotions...</p>
          <p className="text-sm text-muted">Fetching campaign status and banner content.</p>
        </Card>
      ) : promotions.length === 0 ? (
        <Card hoverable={false} style={{ padding: '56px 40px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', margin: '0 auto 16px', background: 'rgba(255, 90, 95, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Megaphone size={28} />
          </div>
          <p className="text-h3" style={{ marginBottom: '8px' }}>No promotions yet</p>
          <p className="text-muted" style={{ maxWidth: '560px', margin: '0 auto 24px' }}>
            Build your first hero campaign to spotlight offers, event-based sales, or category pushes right at the top of the customer portal.
          </p>
          <Button onClick={openCreate}><Plus size={18} /> Create Promotion</Button>
        </Card>
      ) : filteredPromotions.length === 0 ? (
        <Card hoverable={false} style={{ padding: '48px 40px', textAlign: 'center' }}>
          <p className="text-h3" style={{ marginBottom: '8px' }}>No matching campaigns</p>
          <p className="text-muted" style={{ marginBottom: '20px' }}>Try a different search term or switch the status filter.</p>
          <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>Clear filters</Button>
        </Card>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
          {filteredPromotions.map((promotion) => {
            const theme = getPromotionStateTheme(promotion);

            return (
              <Card key={promotion.id} style={{ padding: '0', height: '100%' }}>
                <div
                  style={{
                    minHeight: '190px',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    color: '#fff',
                    background: promotion.image
                      ? `linear-gradient(rgba(15, 23, 42, 0.30), rgba(15, 23, 42, 0.65)), url(${promotion.image}) center/cover`
                      : `linear-gradient(135deg, ${promotion.bgColor || DEFAULT_PROMOTION_COLOR} 0%, rgba(15, 23, 42, 0.92) 100%)`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ padding: '7px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(8px)', fontWeight: 800, fontSize: '0.8rem' }}>
                      {theme.label}
                    </span>
                    <span style={{ padding: '7px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.16)', fontWeight: 700, fontSize: '0.8rem' }}>
                      {promotion.ctaText}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-h2" style={{ fontSize: '1.45rem', color: '#fff', marginBottom: '8px' }}>{promotion.title}</h3>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.9)', maxWidth: '34ch' }}>{promotion.subtitle}</p>
                  </div>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '6px 10px', borderRadius: '999px', background: theme.background, color: theme.textColor, fontWeight: 700, fontSize: '0.82rem' }}>
                      {theme.label}
                    </span>
                    <span style={{ padding: '6px 10px', borderRadius: '999px', background: 'var(--surface-hover)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.82rem' }}>
                      Created {formatDateLabel(promotion.createdAt)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <CalendarRange size={16} style={{ marginTop: '2px', color: 'var(--text-muted)' }} />
                      <div>
                        <p className="text-sm" style={{ fontWeight: 700, marginBottom: '2px' }}>Campaign window</p>
                        <p className="text-sm text-muted">{formatDateLabel(promotion.startsAt)} to {formatDateLabel(promotion.endsAt)}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <LinkIcon size={16} style={{ marginTop: '2px', color: 'var(--text-muted)' }} />
                      <div>
                        <p className="text-sm" style={{ fontWeight: 700, marginBottom: '2px' }}>CTA destination</p>
                        <p className="text-sm text-muted">{promotion.ctaLink || 'Scroll to store list in customer portal'}</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void handleToggleActive(promotion)}>
                      {promotion.active ? <EyeOff size={16} /> : <Eye size={16} />}
                      {promotion.active ? 'Pause' : 'Activate'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(promotion)}>
                      <Pencil size={16} /> Edit
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleDelete(promotion.id)} style={{ color: 'var(--error)', borderColor: 'rgba(220, 38, 38, 0.16)' }}>
                      <Trash2 size={16} /> Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
