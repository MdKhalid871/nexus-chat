import { Hash, MessageCircle, LogOut, Plus, ChevronDown, Search, X, Lock, Globe, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { useState, useRef, useEffect } from 'react';

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 'sm' }) {
  const s = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  const colors = ['from-sky-400 to-blue-500', 'from-violet-400 to-purple-500', 'from-emerald-400 to-teal-500', 'from-rose-400 to-pink-500', 'from-amber-400 to-orange-500'];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ── Modal Shell ────────────────────────────────────────────────────────────────
function ModalShell({ children, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Group Modal ────────────────────────────────────────────────────────────────
function GroupModal({ onClose }) {
  const { createGroup, joinGroupByCode, joinRoom } = useChat();
  const [tab, setTab]             = useState('create');
  const [name, setName]           = useState('');
  const [desc, setDesc]           = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [code, setCode]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [newGroupCode, setNewGroupCode] = useState('');
  const [copied, setCopied]       = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const group = await createGroup(name.trim(), desc.trim(), isPrivate);
      if (isPrivate && group.inviteCode) {
        setNewGroupCode(group.inviteCode);
      } else {
        joinRoom(group);
        onClose();
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      await joinGroupByCode(code.trim());
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function copyCode() {
    navigator.clipboard.writeText(newGroupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (newGroupCode) {
    return (
      <ModalShell onClose={onClose} title="Group Created!">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-sky-500" />
          </div>
          <p className="text-slate-500 text-sm">Share this invite code with people you want to add:</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <code className="flex-1 text-sky-600 font-mono text-lg font-bold tracking-widest text-center">
              {newGroupCode}
            </code>
            <button onClick={copyCode} className="text-slate-400 hover:text-sky-500 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-slate-400">⚠️ Save this code — it won't be shown again.</p>
          <button
            onClick={() => { joinRoom({ $id: newGroupCode, name }); onClose(); }}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 transition-all"
          >
            Go to Group
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title="Groups">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
        {['create', 'join'].map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'create' ? 'Create Group' : 'Join with Code'}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            type="text" placeholder="Group name" required maxLength={50}
            value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
          />
          <textarea
            placeholder="Description (optional)" maxLength={200} rows={2}
            value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all resize-none"
          />
          <div className="flex gap-2">
            {[{ v: false, icon: Globe,  label: 'Public',  sub: 'Visible to everyone' },
              { v: true,  icon: Lock,   label: 'Private', sub: 'Invite code only'    }].map(opt => (
              <button key={String(opt.v)} type="button" onClick={() => setIsPrivate(opt.v)}
                className={`flex-1 flex items-center gap-2 p-2.5 rounded-xl border transition-all text-left ${
                  isPrivate === opt.v
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}>
                <opt.icon className={`w-4 h-4 flex-shrink-0 ${isPrivate === opt.v ? 'text-sky-500' : 'text-slate-400'}`} />
                <div>
                  <p className={`text-xs font-medium ${isPrivate === opt.v ? 'text-sky-700' : 'text-slate-600'}`}>{opt.label}</p>
                  <p className="text-[10px] text-slate-400">{opt.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading || !name.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Group'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text" placeholder="Enter invite code (e.g. A1B2C3D4)" required
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 font-mono placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all tracking-wider"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading || !code.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join Group'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────
export default function Sidebar() {
  const {
    rooms, joinedGroups, onlineUsers, activeRoom, activeDM,
    joinRoom, openDM, searchUsers,
    dmContacts, removeDMContact,
  } = useChat();
  const { user, logout } = useAuth();

  const [showRooms,      setShowRooms]      = useState(true);
  const [showDMs,        setShowDMs]        = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Search state
  const [dmSearch,      setDmSearch]      = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const searchTimer = useRef(null);

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!dmSearch.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const results = await searchUsers(dmSearch);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [dmSearch]);

  // All channels: public rooms + private groups user has joined
  const allGroups = [
    ...rooms,
    ...joinedGroups.filter(g => !rooms.find(r => r.$id === g.$id)),
  ];

  function handleOpenDM(u) {
    openDM({ ...u, userId: u.$id });
    setDmSearch('');
    setSearchResults([]);
  }

  return (
    <>
      <aside className="w-64 flex flex-col sidebar-bg border-r border-slate-200 flex-shrink-0">

        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-500 shadow-sm">
              <span className="text-white font-display font-bold text-sm">N</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-sm text-slate-800">Nexus Chat</h1>
              <p className="text-xs text-slate-400">{onlineUsers.length} online now</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">

          {/* ── Channels ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                onClick={() => setShowRooms(v => !v)}>
                <ChevronDown className={`w-3 h-3 transition-transform ${showRooms ? '' : '-rotate-90'}`} />
                Channels
              </button>
              <button
                onClick={() => setShowGroupModal(true)}
                title="Create or join a group"
                className="text-slate-400 hover:text-sky-500 transition-colors p-0.5 rounded">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showRooms && allGroups.map(room => (
              <button key={room.$id} onClick={() => joinRoom(room)}
                className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 text-left ${activeRoom?.$id === room.$id ? 'active' : ''}`}>
                {room.isPrivate
                  ? <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  : <Hash className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{room.name}</p>
                  {room.description && (
                    <p className="text-xs text-slate-400 truncate">{room.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* ── Direct Messages ───────────────────────────────────────── */}
          <div>
            <button
              className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 px-1 hover:text-slate-600 transition-colors w-full"
              onClick={() => setShowDMs(v => !v)}>
              <ChevronDown className={`w-3 h-3 transition-transform ${showDMs ? '' : '-rotate-90'}`} />
              Direct Messages
            </button>

            {showDMs && (
              <>
                {/* Search bar */}
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Find a user…"
                    value={dmSearch}
                    onChange={e => setDmSearch(e.target.value)}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                  {dmSearch && (
                    <button onClick={() => { setDmSearch(''); setSearchResults([]); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Search results (shown while typing) */}
                {dmSearch && (
                  searching ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="mb-2">
                      {searchResults.map(u => (
                        <button key={u.$id}
                          onClick={() => handleOpenDM(u)}
                          className={`sidebar-item w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 text-left ${activeDM?.userId === u.$id ? 'active' : ''}`}>
                          <div className="relative flex-shrink-0">
                            <Avatar name={u.name} />
                            {onlineUsers.some(ou => ou.userId === u.$id) && (
                              <div className="absolute -bottom-0.5 -right-0.5 online-dot" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-700 truncate">{u.name}</p>
                            <p className="text-xs text-slate-400 truncate">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 px-3 py-2">No users found for "{dmSearch}"</p>
                  )
                )}

                {/* Persistent DM contacts (shown when not searching) */}
                {!dmSearch && dmContacts.length === 0 && (
                  <p className="text-xs text-slate-400 px-3 py-2">Search to find and message anyone</p>
                )}

                {!dmSearch && dmContacts.map(contact => {
                  const contactId = contact.$id || contact.userId;
                  const isActive = activeDM?.userId === contactId || activeDM?.$id === contactId;
                  const isOnline = onlineUsers.some(u => u.userId === contactId);
                  return (
                    <div key={contactId}
                      className={`sidebar-item group flex items-center gap-2.5 px-3 py-2 mb-0.5 ${isActive ? 'active' : ''}`}>
                      <button
                        onClick={() => openDM(contact)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                        <div className="relative flex-shrink-0">
                          <Avatar name={contact.name || contact.username} />
                          {isOnline && <div className="absolute -bottom-0.5 -right-0.5 online-dot" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700 truncate">{contact.name || contact.username}</p>
                          {contact.email && <p className="text-xs text-slate-400 truncate">{contact.email}</p>}
                        </div>
                      </button>
                      {/* Remove contact button */}
                      <button
                        onClick={() => removeDMContact(contactId)}
                        title="Remove contact"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400 flex-shrink-0 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Footer — current user */}
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-100 transition-all group">
            <Avatar name={user?.name} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button onClick={logout}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {showGroupModal && <GroupModal onClose={() => setShowGroupModal(false)} />}
    </>
  );
}