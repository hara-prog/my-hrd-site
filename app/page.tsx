// ─────────────────────────────────────────────────────────
// これは「業務アプリの画面」です。宣伝ページ（LP）ではありません。
//
// 題材: 研修講師への依頼の管理（docs/03_spec.md）
//
// 画面の骨格（この形は崩さない）:
//   左メニュー（.side）＋ 上部バー（.topbar）＋ 本体（.content）
//   一覧 / 新規登録 / 設定 の3画面を view で切り替える
// ─────────────────────────────────────────────────────────
"use client";

import { useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════
//  画面の型 ── docs/03_spec.md の「0. 画面の型」のとおりに設定
// ═══════════════════════════════════════════════════════════

/** 色み。企業研修会社はクライアント企業向けのBtoB業態 */
const TONE = "indigo";

/** 密度。月10本前後で、1本あたりの情報量と金額が重い */
const DENSITY = "roomy";

/** 画面の型。依頼が「どの段階で止まっているか」を見たい */
const LAYOUT: "queue" | "stage" | "due" = "stage";

/** 数え方 */
const UNIT = "本";

/** 依頼の段階。この順に進む。最後まで進むと「実施済み」になる */
const CATEGORIES = ["未依頼", "依頼済み", "確定"];

/** 研修日がこの日数以内に迫っていて、まだ確定していないものを「要確認」とみなす */
const ALERT_DAYS = 14;

// ═══════════════════════════════════════════════════════════

/** 講師依頼1本ぶんのデータ */
type Record = {
  id: string;
  name: string;      // 講師名
  client: string;    // クライアント名
  category: string;  // いまの段階
  note: string;      // 研修テーマ・場所・集合時間・講師料などのメモ
  date: string;      // 研修日 YYYY-MM-DD
  done: boolean;     // 実施済みか
};

type View = "list" | "new" | "settings";
type Filter = "open" | "done" | "all";

const KEY = "hrd-instructor-requests";
const NAME_KEY = "hrd-instructor-appname";

/** 画面じゅうの文言。ここを直せば言葉が揃って変わる */
const TEXT = {
  sub: "どの段階で止まっている依頼かが分かります",
  open: "対応中",
  done: "実施済み",
  toBack: "対応中に戻す",
  toDone: "実施済みにする",
  dateLabel: "研修日",
  catLabel: "いまの段階",
  stat2: `研修${ALERT_DAYS}日以内・未確定`,
  headOpen: "対応中",
};

/** n日前の日付。マイナスを渡すとn日後 */
const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => ago(0);

/** 今日との差。0=今日、-3=3日過ぎている、+2=あと2日 */
const diff = (d: string) =>
  Math.round(
    (new Date(d + "T00:00:00").getTime() - new Date(today() + "T00:00:00").getTime()) / 86400000
  );

const LAST_STAGE = CATEGORIES[CATEGORIES.length - 1];

/**
 * 見本データ。すべて架空の講師名・会社名・研修内容です。
 */
const SAMPLE: Record[] = [
  { id: "s01", name: "青木先生", client: "みらい商事",         category: "未依頼",   note: "新入社員向けビジネスマナー／本社5F研修室／集合9:00／講師料8万円", date: ago(-2),  done: false },
  { id: "s02", name: "白石先生", client: "サンライズ精機",     category: "依頼済み", note: "管理職向けフィードバック研修／集合12:30／講師料12万円",         date: ago(-3),  done: false },
  { id: "s03", name: "岸本先生", client: "ひなた食品",         category: "確定",     note: "接客応対の基礎／2会場に分けて実施／講師料10万円",              date: ago(-1),  done: false },
  { id: "s04", name: "森尾先生", client: "北都テクノロジー",   category: "未依頼",   note: "ロジカルシンキング半日／会場未定／講師料の相談がまだ",           date: ago(-5),  done: false },
  { id: "s05", name: "堀内先生", client: "あおば建設",         category: "依頼済み", note: "安全衛生とハラスメント／現場事務所／集合8:30／講師料9万円",     date: ago(-7),  done: false },
  { id: "s06", name: "笹本先生", client: "みらい商事",         category: "確定",     note: "2年目フォローアップ／本社5F／集合13:00／講師料8万円",          date: ago(-6),  done: false },
  { id: "s07", name: "永田先生", client: "コーラルリテール",   category: "未依頼",   note: "店長向けマネジメント／全3回の1回目／日程だけ先に押さえたい",     date: ago(-9),  done: false },
  { id: "s08", name: "土屋先生", client: "セントラル物流",     category: "依頼済み", note: "リーダーシップ研修／集合10:00／講師料11万円／交通費別途",       date: ago(-12), done: false },
  { id: "s09", name: "宮下先生", client: "ひかりメディカル",   category: "確定",     note: "対人コミュニケーション／講師料10万円／資料は当日持参",          date: ago(-16), done: false },
  { id: "s10", name: "野々村先生", client: "アルテミス工業",   category: "未依頼",   note: "新任評価者研修／人事部と内容をすり合わせ中",                   date: ago(-21), done: false },
  { id: "s11", name: "青木先生", client: "セントラル物流",     category: "確定",     note: "新入社員研修 前半／集合9:00／講師料8万円",                     date: ago(3),   done: true  },
  { id: "s12", name: "岸本先生", client: "北都テクノロジー",   category: "確定",     note: "プレゼンテーション研修／講師料9万円／請求書受領済み",           date: ago(8),   done: true  },
  { id: "s13", name: "堀内先生", client: "あおば建設",         category: "確定",     note: "現場リーダー研修／講師料9万円／アンケート回収済み",             date: ago(14),  done: true  },
  { id: "s14", name: "笹本先生", client: "ひなた食品",         category: "確定",     note: "衛生管理の基礎／講師料7万円／次回の相談あり",                  date: ago(19),  done: true  },
  { id: "s15", name: "土屋先生", client: "コーラルリテール",   category: "確定",     note: "販売スタッフ向け接客／講師料10万円／実施報告書 提出済み",       date: ago(27),  done: true  },
];

/** 一覧をどう束ねるか。対応中は段階ごと、それ以外は1つの束 */
type Group = { key: string; label: string; mark?: "late" | "now"; items: Record[] };

function grouped(list: Record[], filter: Filter): Group[] {
  if (filter === "open") {
    return CATEGORIES.map((c) => ({
      key: c,
      label: c,
      items: list.filter((i) => i.category === c),
    })).filter((g) => g.items.length > 0);
  }
  const head = filter === "done" ? TEXT.done : "すべて";
  return [{ key: "all", label: head, items: list }];
}

/** 行の右に出す小さなバッジ。研修日までの残り日数を出す */
function rowBadge(r: Record): { text: string; kind: "warn" | "danger" } | null {
  if (r.done) return null;
  const d = diff(r.date);
  if (d < 0) return { text: `研修日 ${-d}日 経過`, kind: "danger" };
  if (r.category === LAST_STAGE) return null;
  if (d === 0) return { text: "本日", kind: "danger" };
  if (d <= ALERT_DAYS) return { text: `あと${d}日`, kind: "warn" };
  return null;
}

export default function Home() {
  const [items, setItems] = useState<Record[]>([]);
  const [appName, setAppName] = useState("講師依頼管理");
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Record | null>(null);

  const [form, setForm] = useState({
    name: "",
    client: "",
    category: CATEGORIES[0],
    note: "",
    date: today(),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? (JSON.parse(raw) as Record[]) : SAMPLE);
      const n = localStorage.getItem(NAME_KEY);
      if (n) setAppName(n);
    } catch {
      setItems(SAMPLE);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify(items));
    localStorage.setItem(NAME_KEY, appName);
  }, [items, appName, loaded]);

  // 見本データのまま触っていない状態か（1本でも足す・消すと false になる）
  const isSample = items.length === SAMPLE.length && items.every((i) => i.id.startsWith("s"));

  const counts = useMemo(
    () => ({
      open: items.filter((i) => !i.done).length,
      done: items.filter((i) => i.done).length,
      all: items.length,
    }),
    [items]
  );

  /** 研修日が迫っているのに、まだ確定していない依頼の数 */
  const attention = useMemo(
    () =>
      items.filter((i) => !i.done && i.category !== LAST_STAGE && diff(i.date) <= ALERT_DAYS).length,
    [items]
  );

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "open" ? !i.done : i.done))
      .filter((i) => !k || (i.name + i.client + i.note + i.category).toLowerCase().includes(k))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items, filter, q]);

  const groups = useMemo(() => grouped(shown, filter), [shown, filter]);

  function resetForm() {
    setForm({ name: "", client: "", category: CATEGORIES[0], note: "", date: today() });
    setEditing(null);
  }

  function save() {
    const name = form.name.trim();
    if (!name) return;
    if (editing) {
      setItems(items.map((i) => (i.id === editing.id ? { ...i, ...form, name } : i)));
    } else {
      setItems([...items, { id: String(Date.now()), ...form, name, done: false }]);
    }
    resetForm();
    setView("list");
  }

  function startEdit(r: Record) {
    setEditing(r);
    setForm({ name: r.name, client: r.client, category: r.category, note: r.note, date: r.date });
    setView("new");
  }

  /** 次のボタンを押したら、どの段階に進むか */
  function nextLabel(r: Record) {
    if (r.done) return TEXT.toBack;
    const idx = CATEGORIES.indexOf(r.category);
    return idx >= 0 && idx < CATEGORIES.length - 1 ? `${CATEGORIES[idx + 1]}にする` : TEXT.toDone;
  }

  /** 段階を1つ進める。最後の段階まで来ていたら実施済みにする */
  function advance(r: Record) {
    const idx = CATEGORIES.indexOf(r.category);
    const next =
      r.done
        ? { done: false }
        : idx >= 0 && idx < CATEGORIES.length - 1
        ? { category: CATEGORIES[idx + 1] }
        : { done: true };
    setItems(items.map((i) => (i.id === r.id ? { ...i, ...next } : i)));
  }

  const remove = (id: string) => setItems(items.filter((i) => i.id !== id));

  const NAV: { k: View; label: string; count?: number }[] = [
    { k: "list", label: "一覧", count: counts.open },
    { k: "new", label: "新規登録" },
    { k: "settings", label: "設定" },
  ];

  const titles: { [K in View]: [string, string] } = {
    list: ["一覧", TEXT.sub],
    new: [editing ? "編集" : "新規登録", "入力して保存すると、一覧に追加されます"],
    settings: ["設定", "表示名の変更と、データの初期化"],
  };

  return (
    <div className="shell" data-tone={TONE} data-density={DENSITY}>
      {/* ───────── 左メニュー ───────── */}
      <nav className="side">
        <div className="side-brand">
          <div className="n">{appName}</div>
          <div className="s">この端末に保存</div>
        </div>
        <div className="side-label">メニュー</div>
        <div className="side-nav">
          {NAV.map((n) => (
            <button
              key={n.k}
              className="side-item"
              aria-current={view === n.k ? "page" : undefined}
              onClick={() => { if (n.k !== "new") resetForm(); setView(n.k); }}
            >
              {n.label}
              {typeof n.count === "number" && <span className="c">{n.count}</span>}
            </button>
          ))}
        </div>
        <div className="side-foot">段階は {CATEGORIES.join(" → ")} → {TEXT.done} の順に進みます</div>
      </nav>

      {/* ───────── 本体 ───────── */}
      <div className="main">
        <header className="topbar">
          <span className="t">{titles[view][0]}</span>
          <span className="d">{titles[view][1]}</span>
          {view === "list" && (
            <span className="right">
              <button className="btn" onClick={() => { resetForm(); setView("new"); }}>新規登録</button>
            </span>
          )}
        </header>

        <div className="content">
          {/* ── 一覧 ── */}
          {view === "list" && (
            <>
              {isSample && (
                <div className="notice">
                  表示中のデータは<b>見本</b>です。そのまま触って試せます。
                  消したいときは、左メニューの<b>設定</b>から。
                </div>
              )}

              <div className="stats">
                <div className="stat"><div className="n accent">{counts.open}</div><div className="l">{TEXT.open}</div></div>
                <div className="stat"><div className="n">{attention}</div><div className="l">{TEXT.stat2}</div></div>
                <div className="stat"><div className="n">{counts.all}</div><div className="l">全{UNIT}</div></div>
              </div>

              <div className="filters">
                <div className="search">
                  <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="講師名・クライアント名・メモで検索" />
                </div>
                <div className="seg">
                  {(["open", "done", "all"] as Filter[]).map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f === "open" ? `${TEXT.open} ${counts.open}`
                        : f === "done" ? `${TEXT.done} ${counts.done}`
                        : `全部 ${counts.all}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="list">
                {shown.length === 0 ? (
                  <>
                    <div className="list-head">
                      {filter === "open" ? TEXT.headOpen : filter === "done" ? TEXT.done : "すべて"}
                      <span className="count">0 {UNIT}</span>
                    </div>
                    <div className="empty">
                      <div className="t">{q ? "見つかりませんでした" : "ここに表示する依頼がありません"}</div>
                      <div className="d">
                        {q ? "講師名やクライアント名を短くして探してみてください。" : "右上の「新規登録」から、講師依頼を1本追加できます。"}
                      </div>
                    </div>
                  </>
                ) : (
                  groups.map((g) => (
                    <div key={g.key}>
                      <div className={"group-head" + (g.mark ? ` is-${g.mark}` : "")}>
                        {g.mark && <span className="dot" />}
                        {g.label}
                        <span className="count">{g.items.length} {UNIT}</span>
                      </div>
                      {g.items.map((r) => {
                        const b = rowBadge(r);
                        return (
                          <div className="row" key={r.id}>
                            <div className="row-main">
                              <div className="row-title">{r.name}</div>
                              <div className="row-sub">{r.client}{r.note && `｜${r.note}`}</div>
                            </div>
                            <div className="row-meta">
                              {b && <span className={`badge badge-${b.kind}`}>{b.text}</span>}
                              {filter !== "open" && <span className="badge">{r.category}</span>}
                              <span className="row-time">{r.date.slice(5).replace("-", "/")}</span>
                              <button className="btn-ghost" onClick={() => startEdit(r)}>編集</button>
                              <button className="btn-ghost" onClick={() => advance(r)}>{nextLabel(r)}</button>
                              <button className="btn-ghost danger-btn" onClick={() => remove(r.id)}>削除</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
              <p className="note">データはこの端末のブラウザにだけ保存されます。外部には送信されません。</p>
            </>
          )}

          {/* ── 新規登録・編集 ── */}
          {view === "new" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-name">講師名<span className="req">必須</span></label>
                <input id="f-name" className="field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：青木先生" />
                <span className="hint">依頼書に書く呼び方で入れておきます</span>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-client">クライアント名</label>
                <input id="f-client" className="field" value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="例：みらい商事" />
              </div>

              <div className="form-row">
                <div className="inline">
                  <div>
                    <label className="label" htmlFor="f-cat">{TEXT.catLabel}</label>
                    <select id="f-cat" className="select" value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="f-date">{TEXT.dateLabel}</label>
                    <input id="f-date" className="field" type="date" value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <label className="label" htmlFor="f-note">メモ</label>
                <textarea id="f-note" className="field" value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="研修テーマ／場所／集合時間／講師料など" />
                <span className="hint">依頼書を書くときに見返す情報を、分かる範囲で入れておきます</span>
              </div>

              <div className="form-actions">
                <button className="btn" onClick={save} disabled={!form.name.trim()}>
                  {editing ? "保存する" : "一覧に追加"}
                </button>
                <button className="btn-ghost" onClick={() => { resetForm(); setView("list"); }}>やめる</button>
                <span className="spacer" />
                {editing && (
                  <button className="btn-ghost danger-btn"
                    onClick={() => { remove(editing.id); resetForm(); setView("list"); }}>
                    この1{UNIT}を削除
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 設定 ── */}
          {view === "settings" && (
            <div className="panel">
              <div className="form-row">
                <label className="label" htmlFor="f-app">画面の表示名</label>
                <input id="f-app" className="field" value={appName}
                  onChange={(e) => setAppName(e.target.value)} />
                <span className="hint">左上に表示されます。変えるとすぐ反映されます</span>
              </div>

              <div className="form-row">
                <label className="label">データ</label>
                <div className="inline">
                  <button className="btn-ghost" onClick={() => setItems(SAMPLE)}>見本データを入れ直す</button>
                  <button className="btn-ghost danger-btn"
                    onClick={() => { if (confirm("全部消します。よろしいですか？")) setItems([]); }}>
                    全部消す
                  </button>
                </div>
                <span className="hint">
                  現在 {counts.all} {UNIT}（{TEXT.open} {counts.open} / {TEXT.done} {counts.done}）
                </span>
              </div>

              <p className="note">
                データはこの端末のブラウザにだけ保存されます。
                別の端末や他の人とは共有されません（共有は第3回で扱います）。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
