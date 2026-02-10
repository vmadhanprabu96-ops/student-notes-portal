import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const APP_NAME = "IV SEM Notes Hub";

function cx(...a){ return a.filter(Boolean).join(" "); }

export default function App() {
  const [tab, setTab] = useState("student"); // student | admin
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [files, setFiles] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("nameAsc"); // nameAsc | nameDesc | newest

  // admin
  const [adminKey, setAdminKey] = useState("");
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState("");

  useEffect(() => { loadSubjects(); }, []);

  async function loadSubjects(){
    setLoadingSubjects(true);
    try {
      const r = await fetch(`${API_BASE}/api/subjects`);
      const j = await r.json();
      const list = j.subjects || [];
      setSubjects(list);
      if (list.length) {
        setSubjectId(list[0].id);
        setUploadSubjectId(list[0].id);
      }
    } finally { setLoadingSubjects(false); }
  }

  useEffect(() => { if (subjectId) loadFiles(subjectId); }, [subjectId]);

  async function loadFiles(sid){
    setLoadingFiles(true);
    try{
      const r = await fetch(`${API_BASE}/api/files?subjectId=${encodeURIComponent(sid)}`);
      const j = await r.json();
      setFiles(j.files || []);
    } finally { setLoadingFiles(false); }
  }

  const onlyFiles = useMemo(()=> files.filter(f => !f.isFolder), [files]);

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = onlyFiles;
    if (q) arr = arr.filter(f => (f.name || "").toLowerCase().includes(q));

    arr = [...arr].sort((a,b)=>{
      if (sort === "newest") return new Date(b.modifiedTime||0) - new Date(a.modifiedTime||0);
      const an = (a.name||"").toLowerCase();
      const bn = (b.name||"").toLowerCase();
      const cmp = an.localeCompare(bn);
      return sort === "nameDesc" ? -cmp : cmp;
    });

    return arr;
  }, [onlyFiles, query, sort]);

  const stats = useMemo(() => {
    const totalSubjects = subjects.length;
    const totalFiles = onlyFiles.length;
    const types = {};
    for (const f of onlyFiles) {
      const t = prettyType(f.mimeType);
      types[t] = (types[t] || 0) + 1;
    }
    const topType = Object.entries(types).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—";
    return { totalSubjects, totalFiles, topType };
  }, [subjects, onlyFiles]);

  async function handleUpload(e){
    e.preventDefault();
    setUploadMsg("");
    if (!adminKey) return setUploadMsg("Enter Admin Key");
    if (!uploadFile) return setUploadMsg("Choose a file");

    const fd = new FormData();
    fd.append("subjectId", uploadSubjectId || "");
    fd.append("file", uploadFile);

    try{
      const r = await fetch(`${API_BASE}/api/admin/upload`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed");
      setUploadMsg(`✅ Uploaded: ${j.uploaded?.name || ""}`);
      setUploadFile(null);
      if (uploadSubjectId === subjectId) loadFiles(subjectId);
    } catch(err){
      setUploadMsg(`❌ ${err.message}`);
    }
  }

  const selectedSubjectName = subjects.find(s=>s.id===subjectId)?.name || "Subject";

  return (
    <div className="min-h-screen text-slate-100">
      <Background />
      <TopBar tab={tab} setTab={setTab} />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-6">
        <Hero tab={tab} selectedSubjectName={selectedSubjectName} />

        <StatsRow stats={stats} />

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <SidePanel
            tab={tab}
            subjects={subjects}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            loadingSubjects={loadingSubjects}
            query={query}
            setQuery={setQuery}
            sort={sort}
            setSort={setSort}
            onRefresh={() => subjectId && loadFiles(subjectId)}
          />

          {tab === "student" ? (
            <MainCard>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Files</h2>
                  <p className="text-sm text-slate-300">
                    View online or download full file anytime.
                  </p>
                </div>
                <div className="hidden md:block">
                  <Badge>{filteredFiles.length} items</Badge>
                </div>
              </div>

              <div className="mt-5">
                {loadingFiles ? (
                  <SkeletonList />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredFiles.map(f => <FileCard key={f.id} file={f} />)}
                    {!filteredFiles.length && (
                      <EmptyState />
                    )}
                  </div>
                )}
              </div>
            </MainCard>
          ) : (
            <MainCard>
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h2 className="text-lg font-semibold">Admin Upload</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Upload notes into Google Drive (selected subject folder).
                  </p>

                  <form onSubmit={handleUpload} className="mt-5 space-y-4">
                    <Field label="Admin Key">
                      <input
                        value={adminKey}
                        onChange={(e)=>setAdminKey(e.target.value)}
                        className="w-full rounded-2xl bg-white/8 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-white/20"
                        placeholder="Enter ADMIN_KEY"
                      />
                    </Field>

                    <Field label="Upload to Subject">
                      <select
                        className="w-full rounded-2xl bg-white/8 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-white/20"
                        value={uploadSubjectId}
                        onChange={(e)=>setUploadSubjectId(e.target.value)}
                        disabled={loadingSubjects}
                      >
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Choose File">
                      <input
                        type="file"
                        onChange={(e)=>setUploadFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-2xl file:border-0 file:bg-white/10 file:px-4 file:py-3 file:text-slate-100 hover:file:bg-white/15"
                      />
                    </Field>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-white/12 px-4 py-3 font-semibold ring-1 ring-white/10 hover:bg-white/16"
                    >
                      Upload
                    </button>

                    {uploadMsg && (
                      <p className="text-sm text-slate-200">{uploadMsg}</p>
                    )}
                  </form>
                </div>

                <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                  <h3 className="font-semibold">Admin tips</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
                    <li>Create subject folders in Drive (OS, SE, ML, etc.).</li>
                    <li>Upload PDFs/PPTs/Docs/ZIPs—students can download full files.</li>
                    <li>After deploying (Render + Netlify), the portal works 24/7 even if your PC is OFF.</li>
                  </ul>

                  <div className="mt-5 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                    <p className="text-sm text-slate-300">
                      If students see “You need access”, make the Drive folders: <b>Anyone with the link → Viewer</b>.
                    </p>
                  </div>
                </div>
              </div>
            </MainCard>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-slate-400">
          {APP_NAME} • Google Drive powered • View & Download anytime
        </footer>
      </div>
    </div>
  );
}

function TopBar({ tab, setTab }){
  return (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/45 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <span className="text-sm font-bold">IV</span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{APP_NAME}</div>
            <div className="text-xs text-slate-300">Student • Admin • Cloud</div>
          </div>
        </div>

        <div className="flex gap-2">
          <TabBtn active={tab==="student"} onClick={()=>setTab("student")}>Student</TabBtn>
          <TabBtn active={tab==="admin"} onClick={()=>setTab("admin")}>Admin</TabBtn>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, children, ...props }){
  return (
    <button
      {...props}
      className={cx(
        "rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ring-white/10 transition",
        active ? "bg-white/18" : "bg-white/8 hover:bg-white/12"
      )}
    >
      {children}
    </button>
  );
}

function Hero({ tab, selectedSubjectName }){
  return (
    <div className="rounded-[28px] bg-black/35 p-6 ring-1 ring-white/10 backdrop-blur-md md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Always Online (after deploy)
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Notes, Projects & Lab Files — <span className="text-white/85">{tab==="student" ? selectedSubjectName : "Admin Panel"}</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Clean “leaderboard” style UI. Students can view & download full files. Admin can upload to Google Drive.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <Pill title="Fast search" desc="Find files quickly" />
          <Pill title="Full download" desc="PDF/PPT/DOC/ZIP" />
        </div>
      </div>
    </div>
  );
}

function Pill({ title, desc }){
  return (
    <div className="rounded-3xl bg-white/6 p-4 ring-1 ring-white/10">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-slate-300">{desc}</div>
    </div>
  );
}

function StatsRow({ stats }){
  const items = [
    { label: "Subjects", value: String(stats.totalSubjects || 0) },
    { label: "Files in subject", value: String(stats.totalFiles || 0) },
    { label: "Top type", value: stats.topType || "—" },
  ];
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {items.map((it, idx)=>(
        <div key={idx} className="rounded-[22px] bg-white/6 p-4 ring-1 ring-white/10">
          <div className="text-xs text-slate-300">{it.label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function SidePanel({ tab, subjects, subjectId, setSubjectId, loadingSubjects, query, setQuery, sort, setSort, onRefresh }){
  return (
    <div className="rounded-[28px] bg-black/35 p-5 ring-1 ring-white/10 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Controls</div>
        <button
          onClick={onRefresh}
          className="rounded-xl bg-white/8 px-3 py-2 text-xs font-semibold ring-1 ring-white/10 hover:bg-white/12"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Select subject">
          <select
            className="w-full rounded-2xl bg-white/8 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-white/20"
            value={subjectId}
            onChange={(e)=>setSubjectId(e.target.value)}
            disabled={loadingSubjects}
          >
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label="Search file">
          <input
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            placeholder="Type file name…"
            className="w-full rounded-2xl bg-white/8 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-white/20"
          />
        </Field>

        <Field label="Sort">
          <select
            className="w-full rounded-2xl bg-white/8 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-white/20"
            value={sort}
            onChange={(e)=>setSort(e.target.value)}
          >
            <option value="nameAsc">Name (A → Z)</option>
            <option value="nameDesc">Name (Z → A)</option>
            <option value="newest">Recently updated</option>
          </select>
        </Field>

        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-sm font-semibold">{tab === "student" ? "Student mode" : "Admin mode"}</div>
          <p className="mt-1 text-xs text-slate-300">
            {tab === "student"
              ? "Open anytime and download full notes."
              : "Upload notes to Drive using Admin Key."}
          </p>
        </div>
      </div>
    </div>
  );
}

function MainCard({ children }) {
  return (
    <div className="rounded-[28px] bg-black/35 p-5 ring-1 ring-white/10 backdrop-blur-md md:p-7">
      {children}
    </div>
  );
}

function Badge({ children }){
  return (
    <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/10">
      {children}
    </div>
  );
}

function Field({ label, children }){
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-slate-300">{label}</div>
      {children}
    </div>
  );
}

function FileCard({ file }) {
  const type = prettyType(file.mimeType);
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white/6 p-4 ring-1 ring-white/10 transition hover:bg-white/10">
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-indigo-500/15 blur-2xl" />
        <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-cyan-400/12 blur-2xl" />
      </div>

      <div className="relative flex items-start gap-3">
        <img src={file.iconLink} alt="" className="h-8 w-8 opacity-95" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="mt-1 text-xs text-slate-400">{type}{file.size ? ` • ${prettySize(file.size)}` : ""}</p>
        </div>
      </div>

      <div className="relative mt-4 flex gap-2">
        {file.webViewLink && (
          <a
            className="flex-1 rounded-2xl bg-white/10 px-3 py-2 text-center text-sm font-semibold ring-1 ring-white/10 hover:bg-white/14"
            href={file.webViewLink}
            target="_blank"
            rel="noreferrer"
          >
            View
          </a>
        )}
        <a
          className="flex-1 rounded-2xl bg-white/10 px-3 py-2 text-center text-sm font-semibold ring-1 ring-white/10 hover:bg-white/14"
          href={`${API_BASE}/api/download/${file.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Download
        </a>
      </div>
    </div>
  );
}

function EmptyState(){
  return (
    <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
      <div className="text-sm font-semibold">No files found</div>
      <p className="mt-1 text-xs text-slate-300">Try a different subject or search keyword.</p>
    </div>
  );
}

function SkeletonList(){
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({length:9}).map((_,i)=>(
        <div key={i} className="h-32 animate-pulse rounded-3xl bg-white/6 ring-1 ring-white/10" />
      ))}
    </div>
  );
}

function prettyType(m) {
  if (!m) return "File";
  if (m.includes("pdf")) return "PDF";
  if (m.includes("presentation")) return "PPT";
  if (m.includes("spreadsheet")) return "Sheet";
  if (m.includes("document")) return "Doc";
  if (m.startsWith("image/")) return "Image";
  if (m.startsWith("video/")) return "Video";
  if (m.includes("zip")) return "ZIP";
  return m.split("/").pop();
}

function prettySize(bytes){
  const b = Number(bytes);
  if (!isFinite(b) || b <= 0) return "";
  const units = ["B","KB","MB","GB"];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length-1){ v /= 1024; i++; }
  return `${v.toFixed(v>=10 || i===0 ? 0 : 1)} ${units[i]}`;
}

function Background(){
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950" />
      <div className="absolute -left-48 -top-48 h-[620px] w-[620px] rounded-full bg-indigo-500/22 blur-3xl animate-pulse" />
      <div className="absolute -right-48 top-1/4 h-[620px] w-[620px] rounded-full bg-cyan-400/18 blur-3xl animate-pulse" />
      <div className="absolute left-1/3 -bottom-72 h-[720px] w-[720px] rounded-full bg-fuchsia-500/12 blur-3xl animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.10)_1px,transparent_0)] [background-size:22px_22px] opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
