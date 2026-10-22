"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ImageOff,
  Package,
  Pencil,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import ImageUploadZone from "@/components/features/ImageUploadZone";
import QtyStepper from "@/components/features/QtyStepper";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cn,
  formatJstDateLabel,
  formatPrice,
  getNextBusinessDay,
  getReservableQty,
  getUpcomingBusinessDays,
  getWalkInSharePercent,
  SUB_CATEGORIES,
  SUB_CATEGORY_LABELS,
  toJstDateString,
} from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  price: number;
  imageUrl: string;
  description: string;
  isAvailable: boolean;
  plannedQty: number;
  reservableQty: number;
  reservedQty: number;
  walkInSoldQty: number;
  remainingStock: number;
  remainingQty: number;
}

interface EditState {
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  subCategory: string;
  isAvailable: boolean;
}

const EMPTY_NEW = {
  name: "",
  category: "food",
  subCategory: "bread",
  price: "",
  imageUrl: "",
  description: "",
};

/**
 * 商品と、販売日ごとの発注数を扱う画面。
 *
 * ドリンクとお菓子はほぼ毎日同じ、パンは曜日ごとに決まっているという運用なので、
 * 過去の発注数をまとめて写せるようにしている。
 */
export default function InventoryPage() {
  const router = useRouter();

  // 休みにした日はサーバーしか知らない。聞くまでは曜日と祝日だけで出し、
  // 届いたら中止になった日を飛ばして出し直す。
  const [closedDates, setClosedDates] = useState<string[]>([]);

  const saleDates = useMemo(
    () => [toJstDateString(), getNextBusinessDay(new Date(), closedDates)],
    [closedDates]
  );
  // 次の営業日より先。1週間ぶんを見込んで、営業日で4日先まで用意する。
  const laterDates = useMemo(
    () => getUpcomingBusinessDays(5, new Date(), closedDates).slice(1),
    [closedDates]
  );
  const [showLater, setShowLater] = useState(false);
  // 先の営業日に、もうパンの発注数が入っているか
  const [laterFilled, setLaterFilled] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(() => getNextBusinessDay());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState(EMPTY_NEW);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/daily-stock?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setError("");
      })
      .catch(() => {
        if (!cancelled) setError("読み込みに失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, reloadKey]);

  const loadClosedDates = useCallback(() => {
    return fetch("/api/business-status")
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = Array.isArray(data.closedDates) ? data.closedDates : [];
        setClosedDates(list);
        // 開いている日が休みになっていたら次の営業日へ移す。中止した日に
        // 発注数を入れ続けてしまわないように。
        setDate((current) =>
          list.includes(current) ? getNextBusinessDay(new Date(), list) : current
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadClosedDates();
  }, [loadClosedDates, reloadKey]);

  useEffect(() => {
    if (laterDates.length === 0) return;
    let cancelled = false;

    fetch(`/api/daily-stock/status?dates=${laterDates.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.filled) return;
        const filled: Record<string, boolean> = {};
        for (const d of laterDates) filled[d] = (data.filled[d] ?? 0) > 0;
        setLaterFilled(filled);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [laterDates, reloadKey]);

  function selectDate(next: string) {
    if (next === date) return;
    setLoading(true);
    setNotice("");
    setDate(next);
  }

  /** 入力中の発注数から予約枠をその場で出す。保存を待たずに数字が見える。 */
  function previewPlannedQty(item: Item, plannedQty: number) {
    const safe = Math.max(0, plannedQty);
    const reservable = getReservableQty(safe, item);
    setItems((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              plannedQty: safe,
              reservableQty: reservable,
              remainingQty: Math.max(0, reservable - p.reservedQty),
            }
          : p
      )
    );
  }

  const savePlannedQty = useCallback(
    async (productId: string, plannedQty: number) => {
      const res = await fetch("/api/daily-stock", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, date, plannedQty: Math.max(0, plannedQty) }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        setReloadKey((k) => k + 1);
        return;
      }
      setSavedId(productId);
      setTimeout(() => setSavedId((c) => (c === productId ? null : c)), 1500);
      setReloadKey((k) => k + 1);
    },
    [date]
  );

  /**
   * 選んでいる販売日を休みにする、または休みを取り消す。
   *
   * 急に中止が決まった日を飛ばして次の営業日を出すために使う。休みにすると
   * その日の予約は受け付けなくなり、お客様の画面は次の営業日に進む。
   */
  async function toggleClosed(closed: boolean) {
    setBusy("closure");
    setError("");
    setNotice("");
    try {
      const res = closed
        ? await fetch("/api/business-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date }),
          })
        : await fetch(`/api/business-status?date=${encodeURIComponent(date)}`, {
            method: "DELETE",
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "変更に失敗しました");
        return;
      }
      setClosedDates(Array.isArray(data.closedDates) ? data.closedDates : []);
      setNotice(
        closed
          ? `${formatJstDateLabel(date)} を休みにしました。次の営業日は ${formatJstDateLabel(
              getNextBusinessDay(new Date(), data.closedDates ?? []),
              new Date(),
              data.closedDates ?? []
            )} です`
          : `${formatJstDateLabel(date)} の休みを取り消しました`
      );
      setConfirmClose(false);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  /** 過去の発注数をまとめて写す。 */
  async function copyFrom(mode: "previous" | "weekday") {
    setBusy("copy");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/daily-stock/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "コピーに失敗しました");
        return;
      }
      setNotice(`${formatJstDateLabel(data.sourceDate)} から ${data.copied} 件の発注数を写しました`);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  const laterSetCount = laterDates.filter((d) => laterFilled[d]).length;
  const isLaterDate = !saleDates.includes(date);
  const isClosedDate = closedDates.includes(date);

  function getEdit(item: Item): EditState {
    return (
      edits[item.id] ?? {
        name: item.name,
        price: String(item.price),
        imageUrl: item.imageUrl,
        description: item.description,
        subCategory: item.subCategory,
        isAvailable: item.isAvailable,
      }
    );
  }

  function updateEdit(id: string, field: keyof EditState, value: string | boolean) {
    const item = items.find((p) => p.id === id)!;
    setEdits((prev) => ({ ...prev, [id]: { ...getEdit(item), [field]: value } }));
  }

  async function saveProduct(item: Item) {
    const edit = getEdit(item);
    if (!edit.name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    const price = Number(edit.price);
    if (!price || isNaN(price) || price <= 0) {
      setError("正しい金額を入力してください");
      return;
    }

    setBusy(item.id);
    setError("");
    try {
      const res = await fetch(`/api/products/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name.trim(),
          price,
          imageUrl: edit.imageUrl,
          description: edit.description,
          subCategory: edit.subCategory,
          isAvailable: edit.isAvailable,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存に失敗しました");
        return;
      }
      setEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      setOpenId(null);
      setBrokenThumbs((prev) => ({ ...prev, [item.id]: false }));
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  /** 記録が残っている商品はサーバー側で拒否されるので、ここでは結果を伝えるだけ。 */
  async function deleteProduct(item: Item) {
    setBusy(item.id);
    setError("");
    try {
      const res = await fetch(`/api/products/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "削除に失敗しました");
        setConfirmDelete(null);
        return;
      }
      setConfirmDelete(null);
      setOpenId(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  async function createProduct() {
    if (!newProduct.name.trim()) {
      setAddError("商品名を入力してください");
      return;
    }
    const price = Number(newProduct.price);
    if (!price || isNaN(price) || price <= 0) {
      setAddError("正しい金額を入力してください");
      return;
    }

    setBusy("add");
    setAddError("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name.trim(),
          category: newProduct.category,
          subCategory: newProduct.subCategory,
          price,
          imageUrl: newProduct.imageUrl,
          stock: 0,
          description: newProduct.description,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAddError(data.error ?? "登録に失敗しました");
        return;
      }
      setShowAdd(false);
      setNewProduct(EMPTY_NEW);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(null);
    }
  }

  const isToday = date === toJstDateString();
  const offeredCount = items.filter((i) => i.plannedQty > 0).length;

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <StaffHeader />

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* ---------- 販売日 ---------- */}
        <section className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4">
          <label className="flex items-center gap-1.5 text-xs font-bold text-[#6b5e52] mb-2">
            <CalendarDays size={14} />
            発注数を入れる販売日
          </label>
          <div className="flex gap-2 mb-3">
            {saleDates.map((d) => (
              <button
                key={d}
                onClick={() => selectDate(d)}
                className={cn(
                  "flex-1 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors",
                  date === d
                    ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                    : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                )}
              >
                {formatJstDateLabel(d, new Date(), closedDates)}
              </button>
            ))}
          </div>

          {/* 先の営業日。ふだんは畳んでおき、手の空いたときだけ開く。 */}
          <button
            onClick={() => setShowLater((v) => !v)}
            className="w-full flex items-center justify-between text-left mb-2"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-[#8B1A2C]">
              <CalendarPlus size={14} />
              もっと先の営業日も入れる
              {laterSetCount > 0 && (
                <span className="text-[10px] font-black text-white bg-[#8B1A2C] rounded-full px-2 py-0.5">
                  {laterSetCount}日ぶん入力済み
                </span>
              )}
            </span>
            {showLater ? (
              <ChevronUp size={15} className="text-[#6b5e52]" />
            ) : (
              <ChevronDown size={15} className="text-[#6b5e52]" />
            )}
          </button>

          {showLater && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {laterDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => selectDate(d)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                      date === d
                        ? "bg-[#8B1A2C] text-white border-[#8B1A2C]"
                        : "bg-white text-[#6b5e52] border-[#e8e0d8] hover:border-[#8B1A2C]"
                    )}
                  >
                    {formatJstDateLabel(d, new Date(), closedDates)}
                    {laterFilled[d] ? (
                      <span
                        className={cn(
                          "ml-1.5 text-[10px] font-black",
                          date === d ? "text-[#F0AA5A]" : "text-[#8B1A2C]"
                        )}
                      >
                        入力済
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#6b5e52] mt-2 leading-relaxed">
                先の営業日の発注数を、手の空いたときに入れておけます。
                お客様に見えるのは当日と次の営業日だけなので、先に入れても予約は受け付けません。
              </p>
            </div>
          )}

          <p className="text-xs font-bold text-[#6b5e52] mb-1.5">過去の発注数を写す</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copyFrom("previous")}
              disabled={busy === "copy"}
              className="flex items-center gap-1.5 bg-[#f5f0eb] text-[#8B1A2C] border border-[#e8e0d8] rounded-xl px-3 py-2 text-xs font-bold hover:border-[#8B1A2C] disabled:opacity-50 transition-colors"
            >
              <Copy size={13} />
              前の営業日から
            </button>
            <button
              onClick={() => copyFrom("weekday")}
              disabled={busy === "copy"}
              className="flex items-center gap-1.5 bg-[#f5f0eb] text-[#8B1A2C] border border-[#e8e0d8] rounded-xl px-3 py-2 text-xs font-bold hover:border-[#8B1A2C] disabled:opacity-50 transition-colors"
            >
              <Copy size={13} />
              先週の同じ曜日から
            </button>
          </div>
          <p className="text-[11px] text-[#6b5e52] mt-1.5">
            <strong className="text-[#8B1A2C]">ドリンクとお菓子は前回の数を自動で引き継ぎます。</strong>
            入力し直す必要はありません。数を変えたい日だけ直してください。
            パンは曜日で決まっているので「先週の同じ曜日から」で写せます。
          </p>

          {notice && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mt-2">
              {notice}
            </p>
          )}
        </section>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* いま何日ぶんを触っているか。先の営業日を選んだまま畳んでも取り違えないように。 */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2.5 border",
            isLaterDate
              ? "bg-[#fff8ee] border-[#F0AA5A]"
              : "bg-white border-[#e8e0d8]"
          )}
        >
          <CalendarDays size={15} className="text-[#8B1A2C] flex-shrink-0" />
          <p className="text-sm font-black text-[#1a1a1a]">
            {formatJstDateLabel(date, new Date(), closedDates)}
            {/* 当日と次の営業日は formatJstDateLabel が印を付けるので、先の日だけ補う */}
            {isLaterDate && (
              <span className="font-bold text-[#6b5e52] text-xs ml-1.5">（先の営業日）</span>
            )}
          </p>
          {isLaterDate && !isClosedDate && (
            <span className="ml-auto text-[11px] font-bold text-[#8B1A2C]">
              まだお客様には出ません
            </span>
          )}
          {isClosedDate && (
            <span className="ml-auto text-[11px] font-black text-white bg-[#8B1A2C] rounded-full px-2.5 py-1">
              休み
            </span>
          )}
        </div>

        {/* 急に中止が決まった日を休みにする。次の営業日が繰り下がる。 */}
        <div className="bg-white border border-[#e8e0d8] rounded-2xl px-4 py-3">
          {isClosedDate ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#6b5e52] leading-relaxed">
                この日は<strong className="text-[#8B1A2C]">休み</strong>です。予約は受け付けません。
              </p>
              <button
                onClick={() => toggleClosed(false)}
                disabled={busy === "closure"}
                className="flex-shrink-0 text-xs font-bold text-[#8B1A2C] bg-white border border-[#e8e0d8] rounded-xl px-3 py-2 hover:border-[#8B1A2C] disabled:opacity-50 transition-colors"
              >
                休みを取り消す
              </button>
            </div>
          ) : confirmClose ? (
            <div>
              <p className="text-xs font-bold text-[#1a1a1a] mb-2">
                {formatJstDateLabel(date, new Date(), closedDates)} を休みにします。よろしいですか？
              </p>
              <p className="text-[11px] text-[#6b5e52] mb-2.5 leading-relaxed">
                この日の予約は受け付けなくなり、お客様の画面は次の営業日に進みます。
                入力済みの発注数は消えません。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleClosed(true)}
                  disabled={busy === "closure"}
                  className="flex-1 bg-[#8B1A2C] text-white text-xs font-bold rounded-xl py-2.5 hover:bg-[#A52235] disabled:opacity-50 transition-colors"
                >
                  休みにする
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="flex-1 bg-white text-[#6b5e52] text-xs font-bold border border-[#e8e0d8] rounded-xl py-2.5 hover:border-[#8B1A2C] transition-colors"
                >
                  やめる
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[#6b5e52] leading-relaxed">
                急に販売が中止になったときは、この日を休みにします。
              </p>
              <button
                onClick={() => setConfirmClose(true)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold text-[#8B1A2C] bg-white border border-[#e8e0d8] rounded-xl px-3 py-2 hover:border-[#8B1A2C] transition-colors"
              >
                <CalendarOff size={13} />
                この日は休み
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-[#6b5e52]">
          発注数を入れた <strong className="text-[#8B1A2C]">{offeredCount}件</strong> がこの日のメニューに並びます。
          <strong>0の商品は表示されません。</strong>
          予約枠はパン・ドリンク・グッズが発注数の70%、お菓子は全量です。
        </p>

        {/* ---------- 商品一覧 ---------- */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-[#e8e0d8]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-[#6b5e52] bg-white border border-[#e8e0d8] rounded-2xl py-8">
            商品が登録されていません
          </p>
        ) : (
          CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat);
            if (catItems.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="text-sm font-black text-[#8B1A2C] mb-2">{CATEGORY_LABELS[cat]}</h2>
                <div className="flex flex-col gap-2">
                  {catItems.map((item) => {
                    const edit = getEdit(item);
                    const isOpen = openId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden"
                      >
                        <div className="px-3 py-2.5 flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#f5f0eb]">
                            {item.imageUrl && !brokenThumbs[item.id] ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="48px"
                                onError={() =>
                                  setBrokenThumbs((prev) => ({ ...prev, [item.id]: true }))
                                }
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-[#c8bdb5]">
                                <ImageOff size={16} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1a1a1a] truncate">
                              {item.name}
                              {!item.isAvailable && (
                                <span className="ml-1.5 text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded-full">
                                  停止中
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#6b5e52] tabular-nums">
                              {formatPrice(item.price)}
                              {item.plannedQty > 0 && (
                                <>
                                  ・予約枠
                                  <strong className="text-[#8B1A2C] mx-0.5">{item.reservableQty}</strong>
                                  （{getWalkInSharePercent(item) === 0 ? "全量" : "70%"}）・予約
                                  {item.reservedQty}
                                  {isToday && <>・残り{item.remainingStock}</>}
                                </>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <QtyStepper
                              value={item.plannedQty}
                              onChange={(next) => previewPlannedQty(item, next)}
                              onCommit={(next) => savePlannedQty(item.id, next)}
                              label={`${item.name}の発注数`}
                            />
                            {savedId === item.id && <Check size={14} className="text-green-600" />}
                            <button
                              onClick={() => setOpenId(isOpen ? null : item.id)}
                              className={cn(
                                "w-9 h-9 flex items-center justify-center rounded-lg border transition-colors",
                                isOpen
                                  ? "bg-[#f5f0eb] text-[#6b5e52] border-[#e8e0d8]"
                                  : "bg-white text-[#8B1A2C] border-[#e8e0d8] hover:border-[#8B1A2C]"
                              )}
                              aria-label={isOpen ? "編集を閉じる" : "商品を編集"}
                            >
                              {isOpen ? <X size={15} /> : <Pencil size={15} />}
                            </button>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-[#e8e0d8] bg-[#fdf8f3] p-4 flex flex-col gap-3">
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">商品名</label>
                              <input
                                type="text"
                                value={edit.name}
                                onChange={(e) => updateEdit(item.id, "name", e.target.value)}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">金額（円）</label>
                              <input
                                type="number"
                                min={1}
                                value={edit.price}
                                onChange={(e) => updateEdit(item.id, "price", e.target.value)}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                              />
                            </div>

                            {item.category === "food" && (
                              <div>
                                <label className="block text-xs font-bold text-[#6b5e52] mb-1">内訳</label>
                                <select
                                  value={edit.subCategory}
                                  onChange={(e) => updateEdit(item.id, "subCategory", e.target.value)}
                                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                                >
                                  {SUB_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {SUB_CATEGORY_LABELS[c]}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[10px] text-[#6b5e52] mt-1">
                                  お菓子は予約枠が全量になります
                                </p>
                              </div>
                            )}

                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">写真</label>
                              <ImageUploadZone
                                currentUrl={edit.imageUrl}
                                onUploaded={(url) => updateEdit(item.id, "imageUrl", url)}
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">説明文</label>
                              <textarea
                                value={edit.description}
                                onChange={(e) => updateEdit(item.id, "description", e.target.value)}
                                rows={2}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                              />
                            </div>

                            <button
                              onClick={() => updateEdit(item.id, "isAvailable", !edit.isAvailable)}
                              className="flex items-center gap-1.5 self-start"
                            >
                              {edit.isAvailable ? (
                                <ToggleRight size={22} className="text-[#8B1A2C]" />
                              ) : (
                                <ToggleLeft size={22} className="text-[#e8e0d8]" />
                              )}
                              <span
                                className={cn(
                                  "text-xs font-bold",
                                  edit.isAvailable ? "text-[#8B1A2C]" : "text-[#6b5e52]"
                                )}
                              >
                                {edit.isAvailable ? "販売中" : "停止中"}
                              </span>
                            </button>

                            <button
                              onClick={() => saveProduct(item)}
                              disabled={busy === item.id}
                              className="flex items-center justify-center gap-1.5 bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold hover:bg-[#A52235] disabled:opacity-50 transition-colors"
                            >
                              <Save size={15} />
                              {busy === item.id ? "保存中..." : "保存"}
                            </button>

                            {/* 削除。押し間違いで消えないよう一度確認を挟む。 */}
                            <div className="border-t border-[#e8e0d8] pt-3 mt-1">
                              {confirmDelete === item.id ? (
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    「{item.name}」を削除します。元に戻せません。よろしいですか？
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="flex-1 border border-[#e8e0d8] text-[#6b5e52] rounded-xl py-2.5 text-sm font-bold hover:bg-[#f5f0eb] transition-colors"
                                    >
                                      やめる
                                    </button>
                                    <button
                                      onClick={() => deleteProduct(item)}
                                      disabled={busy === item.id}
                                      className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                      {busy === item.id ? "削除中..." : "削除する"}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmDelete(item.id);
                                    setError("");
                                  }}
                                  className="flex items-center justify-center gap-1.5 w-full border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-bold hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={15} />
                                  この商品を削除
                                </button>
                              )}
                              <p className="text-[10px] text-[#6b5e52] mt-1.5 leading-relaxed">
                                販売や予約の記録がある商品は削除できません。その場合は
                                「販売中」を切り替えて停止中にしてください。
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        {/* ---------- 商品を追加 ---------- */}
        <section>
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setAddError("");
            }}
            className="w-full flex items-center justify-center gap-2 bg-white text-[#8B1A2C] border border-[#e8e0d8] rounded-2xl py-3 font-bold text-sm hover:border-[#8B1A2C] transition-colors"
          >
            {showAdd ? <X size={16} /> : <Plus size={16} />}
            {showAdd ? "閉じる" : "商品を追加"}
          </button>

          {showAdd && (
            <div className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 mt-2 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#8B1A2C]" />
                <p className="text-sm font-bold text-[#1a1a1a]">新しい商品</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">商品名</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                  placeholder="例：メロンパン"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#6b5e52] mb-1">売り場</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
                    className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>
                {newProduct.category === "food" && (
                  <div>
                    <label className="block text-xs font-bold text-[#6b5e52] mb-1">内訳</label>
                    <select
                      value={newProduct.subCategory}
                      onChange={(e) => setNewProduct((p) => ({ ...p, subCategory: e.target.value }))}
                      className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                    >
                      {SUB_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {SUB_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">金額（円）</label>
                <input
                  type="number"
                  min={1}
                  value={newProduct.price}
                  onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                  placeholder="例：200"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">写真</label>
                <ImageUploadZone
                  currentUrl={newProduct.imageUrl}
                  onUploaded={(url) => setNewProduct((p) => ({ ...p, imageUrl: url }))}
                />
              </div>

              <p className="text-xs text-[#6b5e52]">
                個数は登録後に、販売日ごとの発注数として入力します。
              </p>

              {addError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}

              <button
                onClick={createProduct}
                disabled={busy === "add"}
                className="bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold hover:bg-[#A52235] disabled:opacity-50 transition-colors"
              >
                {busy === "add" ? "登録中..." : "登録する"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
