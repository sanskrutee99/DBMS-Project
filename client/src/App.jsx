import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const TERMS = ['Spring', 'Summer', 'Fall', 'Winter'];
const YEAR = new Date().getFullYear();
const YEARS = [YEAR + 1, YEAR, YEAR - 1, YEAR - 2];

// Each department gets its own spine colour, derived from the letters in the course code
const hue = (code) => [...code.replace(/\d/g, '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const Spine = ({ code }) => (
  <div className="spine" style={{ background: `hsl(${hue(code)} 42% 30%)` }}>
    <span>{code}</span>
  </div>
);

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [tab, setTab] = useState('browse');
  const [toast, setToast] = useState('');

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 3500); };
  const signIn = ({ token, user }) => {
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
    setUser(user); setTab('browse');
  };
  const signOut = () => { localStorage.clear(); setUser(null); setTab('browse'); };

  const tabs = [['browse', 'Find a book'], ...(user ? [['sell', 'List a book'], ['mine', 'My shelf'], ['requests', 'My requests']] : [])];

  return (
    <>
      <header className="top">
        <h1>Shelf Swap</h1>
        <nav>
          {tabs.map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="who">
          {user ? <><span>{user.name}</span><button className="link" onClick={signOut}>Sign out</button></>
                : <button className="link" onClick={() => setTab('auth')}>Sign in</button>}
        </div>
      </header>
      <main>
        {tab === 'browse' && <Browse user={user} notify={notify} goAuth={() => setTab('auth')} />}
        {tab === 'auth' && <Auth onDone={signIn} />}
        {tab === 'sell' && <Sell onDone={() => { notify('Book listed.'); setTab('mine'); }} />}
        {tab === 'mine' && <Mine notify={notify} />}
        {tab === 'requests' && <MyRequests notify={notify} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function Browse({ user, notify, goAuth }) {
  const [f, setF] = useState({ q: '', course: '', semester: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ books: [], total: 0, pages: 1 });
  const [facets, setFacets] = useState({ courses: [], semesters: [] });
  const [open, setOpen] = useState(null);
  const dq = useDebounced(f.q), dc = useDebounced(f.course);

  const load = useCallback(() => {
    const p = { page };
    if (dq) p.q = dq; if (dc) p.course = dc; if (f.semester) p.semester = f.semester;
    api.books(p).then(setData).catch((e) => notify(e.message));
  }, [dq, dc, f.semester, page, notify]);

  useEffect(load, [load]);
  useEffect(() => { api.facets().then(setFacets).catch(() => {}); }, []);
  useEffect(() => setPage(1), [dq, dc, f.semester]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <section className="filters">
        <label>Search<input placeholder="Title, author or keyword" value={f.q} onChange={set('q')} /></label>
        <label>Course code
          <input list="courses" placeholder="CS201 or just CS" value={f.course} onChange={set('course')} />
          <datalist id="courses">{facets.courses.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Semester
          <select value={f.semester} onChange={set('semester')}>
            <option value="">Any</option>
            {facets.semesters.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </section>

      <p className="count">{data.total} {data.total === 1 ? 'book' : 'books'} available</p>
      {data.books.length === 0 && <p className="empty">No books match. Try a shorter course code, or clear the semester.</p>}

      <ul className="books">
        {data.books.map((b) => (
          <li key={b._id} className="book">
            <Spine code={b.courseCode} />
            <div className="body">
              <h3>{b.title}</h3>
              <p className="meta">{b.author || 'Author unknown'} · {b.semester} · {b.condition}</p>
              {b.description && <p className="desc">{b.description}</p>}
              <p className="meta">Listed by {b.owner?.name}</p>
            </div>
            <div className="side">
              <strong className="price">{b.price ? `₹${b.price}` : 'Free'}</strong>
              {!user ? <button onClick={goAuth}>Sign in to request</button>
                : user.id === b.owner?._id ? <span className="tag">Yours</span>
                : <button onClick={() => setOpen(b)}>Request</button>}
            </div>
          </li>
        ))}
      </ul>

      {data.pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {open && <RequestDialog book={open} onClose={() => setOpen(null)}
        onSent={() => { setOpen(null); notify('Request sent. The owner will see it on their shelf.'); }} notify={notify} />}
    </>
  );
}

function RequestDialog({ book, onClose, onSent, notify }) {
  const [msg, setMsg] = useState('');
  const send = () => api.request(book._id, msg).then(onSent).catch((e) => { notify(e.message); onClose(); });
  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Request “{book.title}”</h2>
        <label>Message to {book.owner?.name} (optional)
          <textarea rows="3" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="When and where can you meet on campus?" />
        </label>
        <div className="row"><button onClick={send}>Send request</button><button className="ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault(); setErr('');
    api[mode](f).then(onDone).catch((x) => setErr(x.message));
  };
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
      {mode === 'register' && <label>Name<input required value={f.name} onChange={set('name')} /></label>}
      <label>University email<input type="email" required value={f.email} onChange={set('email')} /></label>
      <label>Password<input type="password" required minLength={6} value={f.password} onChange={set('password')} /></label>
      {err && <p className="err">{err}</p>}
      <button>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </form>
  );
}

function Sell({ onDone }) {
  const [f, setF] = useState({ title: '', author: '', courseCode: '', term: 'Fall', year: YEAR, condition: 'good', price: 0, description: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault(); setErr('');
    api.addBook({ ...f, semester: `${f.term} ${f.year}`, price: Number(f.price) }).then(onDone).catch((x) => setErr(x.message));
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2>List a textbook</h2>
      <div className="grid">
        <label>Title<input required value={f.title} onChange={set('title')} /></label>
        <label>Author<input value={f.author} onChange={set('author')} /></label>
        <label>Course code<input required placeholder="CS201" value={f.courseCode} onChange={set('courseCode')} /></label>
        <label>Semester used
          <span className="row">
            <select value={f.term} onChange={set('term')}>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
            <select value={f.year} onChange={set('year')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
          </span>
        </label>
        <label>Condition
          <select value={f.condition} onChange={set('condition')}>{['new', 'good', 'fair', 'worn'].map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label>Price in ₹ (0 for free)<input type="number" min="0" value={f.price} onChange={set('price')} /></label>
      </div>
      <label>Notes<textarea rows="3" placeholder="Highlighting, missing pages, edition…" value={f.description} onChange={set('description')} /></label>
      {err && <p className="err">{err}</p>}
      <button>List book</button>
    </form>
  );
}

const Status = ({ s }) => <span className={`status ${s}`}>{s}</span>;

function Mine({ notify }) {
  const [books, setBooks] = useState([]);
  const [reqs, setReqs] = useState([]);
  const load = useCallback(() => {
    Promise.all([api.mine(), api.incoming()]).then(([b, r]) => { setBooks(b); setReqs(r); }).catch((e) => notify(e.message));
  }, [notify]);
  useEffect(load, [load]);

  const run = (fn, msg) => fn().then(() => { notify(msg); load(); }).catch((e) => notify(e.message));

  if (!books.length) return <p className="empty">You haven’t listed anything yet. Use “List a book” to add your first textbook.</p>;
  return (
    <ul className="books">
      {books.map((b) => {
        const mine = reqs.filter((r) => r.book?._id === b._id);
        const pending = mine.filter((r) => r.status === 'pending');
        const accepted = mine.find((r) => r.status === 'accepted');
        return (
          <li key={b._id} className="book tall">
            <Spine code={b.courseCode} />
            <div className="body">
              <h3>{b.title} <Status s={b.status} /></h3>
              <p className="meta">{b.semester} · {b.price ? `₹${b.price}` : 'Free'}</p>

              {pending.map((r) => (
                <div key={r._id} className="req">
                  <div><strong>{r.requester.name}</strong> wants this{r.message && <>: “{r.message}”</>}</div>
                  <div className="row">
                    <button onClick={() => run(() => api.act(r._id, 'accept'), 'Accepted. Other requests were declined.')}>Accept</button>
                    <button className="ghost" onClick={() => run(() => api.act(r._id, 'reject'), 'Request declined.')}>Decline</button>
                  </div>
                </div>
              ))}
              {accepted && <p className="contact">Reserved for {accepted.requester.name}. Contact: <a href={`mailto:${accepted.requester.email}`}>{accepted.requester.email}</a></p>}
              {b.status === 'available' && !pending.length && <p className="meta">No requests yet.</p>}
            </div>
            <div className="side">
              {b.status === 'reserved' && <button onClick={() => run(() => api.complete(b._id), 'Marked as exchanged.')}>Mark exchanged</button>}
              {b.status !== 'reserved' && <button className="ghost" onClick={() => run(() => api.deleteBook(b._id), 'Listing removed.')}>Remove</button>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MyRequests({ notify }) {
  const [reqs, setReqs] = useState([]);
  const load = useCallback(() => api.outgoing().then(setReqs).catch((e) => notify(e.message)), [notify]);
  useEffect(() => { load(); }, [load]);
  if (!reqs.length) return <p className="empty">You haven’t requested any books. Find one under “Find a book”.</p>;
  return (
    <ul className="books">
      {reqs.map((r) => (
        <li key={r._id} className="book">
          <Spine code={r.book?.courseCode || '—'} />
          <div className="body">
            <h3>{r.book?.title} <Status s={r.status} /></h3>
            <p className="meta">Owner: {r.owner.name} · {r.book?.semester}</p>
            {r.status === 'accepted' && <p className="contact">Accepted. Arrange the hand-off: <a href={`mailto:${r.owner.email}`}>{r.owner.email}</a></p>}
          </div>
          <div className="side">
            {['pending', 'accepted'].includes(r.status) &&
              <button className="ghost" onClick={() => api.act(r._id, 'cancel').then(() => { notify('Request withdrawn.'); load(); }).catch((e) => notify(e.message))}>Withdraw</button>}
          </div>
        </li>
      ))}
    </ul>
  );
}
