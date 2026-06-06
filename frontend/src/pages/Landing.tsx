import { useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Cloud,
  Copy,
  Download,
  FileVideo,
  Filter,
  FolderOpen,
  Image,
  Link2,
  MessageSquareText,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UploadCloud,
  Users,
  Wand2,
} from 'lucide-react';
import './StudioPlatform.css';

type ProjectStatus = 'Shooting' | 'Editing' | 'Client review' | 'Delivered';
type AssetKind = 'Photo' | 'Video';
type AssetStatus = 'Selected' | 'Pending' | 'Rejected';

type Project = {
  id: number;
  client: string;
  title: string;
  date: string;
  status: ProjectStatus;
  cover: string;
  files: number;
  size: string;
  due: string;
  progress: number;
  budget: string;
};

type Asset = {
  id: number;
  name: string;
  kind: AssetKind;
  status: AssetStatus;
  rating: number;
  project: string;
  src: string;
};

type Task = {
  id: number;
  title: string;
  project: string;
  owner: string;
  due: string;
  done: boolean;
};

const projects: Project[] = [
  {
    id: 1,
    client: 'Amina & Khalid',
    title: 'Wedding film and gallery',
    date: 'May 18',
    status: 'Editing',
    cover: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=80',
    files: 842,
    size: '318 GB',
    due: 'Final cut in 4 days',
    progress: 68,
    budget: 'QAR 8,400',
  },
  {
    id: 2,
    client: 'Luma Studio',
    title: 'Product launch campaign',
    date: 'May 22',
    status: 'Client review',
    cover: 'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1000&q=80',
    files: 214,
    size: '96 GB',
    due: 'Approval today',
    progress: 84,
    budget: 'QAR 5,900',
  },
  {
    id: 3,
    client: 'Doha Drift Club',
    title: 'Track day recap',
    date: 'May 26',
    status: 'Shooting',
    cover: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=1000&q=80',
    files: 126,
    size: '74 GB',
    due: 'Shot list open',
    progress: 32,
    budget: 'QAR 3,200',
  },
];

const initialAssets: Asset[] = [
  {
    id: 101,
    name: 'AK_WED_0342.CR3',
    kind: 'Photo',
    status: 'Selected',
    rating: 5,
    project: 'Wedding film and gallery',
    src: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 102,
    name: 'AK_FIRST_DANCE.mov',
    kind: 'Video',
    status: 'Pending',
    rating: 4,
    project: 'Wedding film and gallery',
    src: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 103,
    name: 'LUMA_HERO_012.jpg',
    kind: 'Photo',
    status: 'Selected',
    rating: 5,
    project: 'Product launch campaign',
    src: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 104,
    name: 'DRIFT_REEL_A001.mp4',
    kind: 'Video',
    status: 'Pending',
    rating: 3,
    project: 'Track day recap',
    src: 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=700&q=80',
  },
];

const initialTasks: Task[] = [
  { id: 1, title: 'Cull ceremony photos', project: 'Wedding film and gallery', owner: 'You', due: '10:30 AM', done: false },
  { id: 2, title: 'Upload proxy clips for client notes', project: 'Wedding film and gallery', owner: 'Assistant', due: '1:00 PM', done: true },
  { id: 3, title: 'Send product gallery password', project: 'Product launch campaign', owner: 'You', due: '3:15 PM', done: false },
  { id: 4, title: 'Prepare drone battery checklist', project: 'Track day recap', owner: 'You', due: 'Tomorrow', done: false },
];

const workflow = [
  { label: 'Ingest', value: '1.2 TB', icon: UploadCloud },
  { label: 'Selects', value: '386 picked', icon: Star },
  { label: 'Transfers', value: '4 active', icon: Cloud },
  { label: 'Approvals', value: '12 notes', icon: MessageSquareText },
];

const filters: Array<'All' | AssetKind | AssetStatus> = ['All', 'Photo', 'Video', 'Selected', 'Pending'];

export function Landing() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set([101, 103]));
  const [shareLink, setShareLink] = useState('fikisha.studio/share/amina-khalid-final');
  const [copyState, setCopyState] = useState('Copy');

  const visibleAssets = useMemo(() => {
    if (filter === 'All') return assets;
    return assets.filter((asset) => asset.kind === filter || asset.status === filter);
  }, [assets, filter]);

  const selectedCount = selectedAssets.size;
  const completedTasks = tasks.filter((task) => task.done).length;

  const handleAssetToggle = (id: number) => {
    setSelectedAssets((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTaskToggle = (id: number) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  };

  const handleFilesAdded = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const newAssets: Asset[] = files.slice(0, 6).map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      kind: file.type.startsWith('video') ? 'Video' : 'Photo',
      status: 'Pending',
      rating: 0,
      project: 'New import',
      src: file.type.startsWith('image')
        ? URL.createObjectURL(file)
        : 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=700&q=80',
    }));

    setAssets((current) => [...newAssets, ...current]);
    event.target.value = '';
  };

  const handleGenerateLink = () => {
    const token = Math.random().toString(36).slice(2, 8);
    setShareLink(`fikisha.studio/share/client-selects-${token}`);
    setCopyState('Ready');
  };

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(`https://${shareLink}`);
    setCopyState('Copied');
    window.setTimeout(() => setCopyState('Copy'), 1400);
  };

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar" aria-label="Studio navigation">
        <div className="studio-brand">
          <div className="studio-brand-mark">FS</div>
          <div>
            <strong>Fikisha Studio</strong>
            <span>Creative delivery hub</span>
          </div>
        </div>

        <nav className="studio-nav">
          {[
            ['Dashboard', FolderOpen],
            ['Upload', UploadCloud],
            ['Client selects', Star],
            ['Transfers', Cloud],
            ['Invoices', CircleDollarSign],
          ].map(([label, Icon], index) => (
            <button className={index === 0 ? 'active' : ''} key={label as string} type="button">
              <Icon size={18} />
              <span>{label as string}</span>
            </button>
          ))}
        </nav>

        <div className="storage-panel">
          <div className="storage-top">
            <Cloud size={18} />
            <span>Studio storage</span>
          </div>
          <strong>1.8 TB / 3 TB</strong>
          <div className="storage-bar">
            <span />
          </div>
          <p>RAW, proxy, and final delivery files organized by client.</p>
        </div>
      </aside>

      <section className="studio-main">
        <header className="studio-topbar">
          <div className="search-box">
            <Search size={18} />
            <input aria-label="Search shoots, clients, or files" placeholder="Search shoots, clients, files" />
          </div>
          <div className="topbar-actions">
            <button type="button" title="Notifications">
              <Bell size={18} />
            </button>
            <button type="button" title="Workspace settings">
              <SlidersHorizontal size={18} />
            </button>
            <div className="avatar">YK</div>
          </div>
        </header>

        <section className="studio-hero" aria-label="Studio overview">
          <div className="hero-copy">
            <span className="eyebrow">Today in the studio</span>
            <h1>Manage shoots, selects, transfers, approvals, and delivery in one workspace.</h1>
            <div className="hero-actions">
              <label className="primary-action">
                <UploadCloud size={18} />
                Import media
                <input multiple onChange={handleFilesAdded} type="file" accept="image/*,video/*" />
              </label>
              <button className="secondary-action" onClick={handleGenerateLink} type="button">
                <Share2 size={18} />
                Create client link
              </button>
            </div>
          </div>
          <div className="hero-preview" aria-label="Featured project preview">
            <img alt="Wedding couple gallery preview" src={projects[0].cover} />
            <div className="preview-overlay">
              <button type="button" title="Play preview">
                <Play size={18} fill="currentColor" />
              </button>
              <div>
                <strong>Wedding film cut 03</strong>
                <span>8 min 42 sec ready for notes</span>
              </div>
            </div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Workflow summary">
          {workflow.map(({ label, value, icon: Icon }) => (
            <article className="metric-card" key={label}>
              <Icon size={20} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="content-grid">
          <div className="projects-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Live work</span>
                <h2>Current productions</h2>
              </div>
              <button type="button">
                <Plus size={18} />
                New shoot
              </button>
            </div>

            <div className="project-list">
              {projects.map((project) => (
                <article className="project-row" key={project.id}>
                  <img alt={`${project.title} cover`} src={project.cover} />
                  <div className="project-info">
                    <span className={`status-pill ${project.status.toLowerCase().replace(' ', '-')}`}>
                      {project.status}
                    </span>
                    <h3>{project.title}</h3>
                    <p>{project.client} • {project.files} files • {project.size}</p>
                    <div className="progress-track">
                      <span style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                  <div className="project-meta">
                    <strong>{project.budget}</strong>
                    <span>{project.due}</span>
                    <button type="button" title="Open project">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="side-stack">
            <section className="share-panel">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Sharing</span>
                  <h2>Client delivery link</h2>
                </div>
                <ShieldCheck size={20} />
              </div>
              <p>Watermarked preview, download permissions, expiry date, and approval comments are ready.</p>
              <div className="share-link">
                <Link2 size={16} />
                <span>{shareLink}</span>
              </div>
              <div className="share-actions">
                <button onClick={handleCopy} type="button">
                  <Copy size={16} />
                  {copyState}
                </button>
                <button type="button">
                  <Send size={16} />
                  Send
                </button>
              </div>
            </section>

            <section className="transfer-panel">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Transfer</span>
                  <h2>Delivery queue</h2>
                </div>
                <Download size={20} />
              </div>
              {[
                ['Amina selects ZIP', '72%', 'Uploading'],
                ['Luma finals', '100%', 'Delivered'],
                ['Track proxies', '41%', 'Encoding'],
              ].map(([name, progress, state]) => (
                <div className="transfer-row" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{state}</span>
                  </div>
                  <p>{progress}</p>
                </div>
              ))}
            </section>
          </aside>
        </section>

        <section className="workspace-grid">
          <div className="assets-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Selects</span>
                <h2>Media review board</h2>
              </div>
              <div className="filter-row">
                <Filter size={16} />
                {filters.map((item) => (
                  <button
                    className={filter === item ? 'active' : ''}
                    key={item}
                    onClick={() => setFilter(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="asset-grid">
              {visibleAssets.map((asset) => (
                <article
                  className={selectedAssets.has(asset.id) ? 'asset-card selected' : 'asset-card'}
                  key={asset.id}
                >
                  <button onClick={() => handleAssetToggle(asset.id)} type="button">
                    <img alt={`${asset.name} preview`} src={asset.src} />
                    <span className="asset-check">
                      <Check size={16} />
                    </span>
                    <span className="asset-kind">
                      {asset.kind === 'Video' ? <FileVideo size={14} /> : <Image size={14} />}
                      {asset.kind}
                    </span>
                  </button>
                  <div className="asset-details">
                    <strong>{asset.name}</strong>
                    <span>{asset.project}</span>
                    <div className="rating-row">
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star
                          fill={index < asset.rating ? 'currentColor' : 'none'}
                          key={index}
                          size={14}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="task-panel">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Tasks</span>
                <h2>Production checklist</h2>
              </div>
              <span className="task-count">{completedTasks}/{tasks.length}</span>
            </div>
            <div className="task-list">
              {tasks.map((task) => (
                <button
                  className={task.done ? 'task-row done' : 'task-row'}
                  key={task.id}
                  onClick={() => handleTaskToggle(task.id)}
                  type="button"
                >
                  <span className="task-check">
                    <Check size={14} />
                  </span>
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.project} • {task.owner}</small>
                  </span>
                  <em>{task.due}</em>
                </button>
              ))}
            </div>

            <div className="ai-panel">
              <Wand2 size={20} />
              <div>
                <strong>Smart next step</strong>
                <p>{selectedCount} assets selected. Build a proofing gallery and notify the client.</p>
              </div>
              <button type="button">
                <Sparkles size={16} />
                Prepare
              </button>
            </div>
          </aside>
        </section>

        <section className="bottom-grid">
          <article className="client-panel">
            <div>
              <Users size={20} />
              <span className="eyebrow">Client portal</span>
              <h2>Approvals without messy message threads.</h2>
              <p>Clients can mark favorites, request changes, approve videos, download finals, and see invoice status from the same link.</p>
            </div>
            <button type="button">
              Open portal preview
              <ChevronRight size={18} />
            </button>
          </article>

          <article className="archive-panel">
            <Archive size={20} />
            <div>
              <span className="eyebrow">Archive rules</span>
              <h2>Auto-sort final projects</h2>
              <p>Move delivered work into year, client, and project folders after 30 days.</p>
            </div>
            <button type="button" title="More archive options">
              <MoreHorizontal size={18} />
            </button>
          </article>

          <article className="booking-panel">
            <Clock3 size={20} />
            <div>
              <span className="eyebrow">Next booking</span>
              <h2>Brand portraits</h2>
              <p>May 29 • call sheet pending • deposit received</p>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
