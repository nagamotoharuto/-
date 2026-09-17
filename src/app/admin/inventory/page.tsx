"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  CalendarDays,
  Check,
  Copy,
  ImageOff,
  Package,
  Pencil,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import StaffHeader from "@/components/features/StaffHeader";
import ImageUploadZone from "@/components/features/ImageUploadZone";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  cn,
  formatJstDateLabel,
  formatPrice,
  getNextBusinessDay,
  getReservableQty,
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

  const [saleDates] = useState<string[]>(() => [toJstDateString(), getNextBusinessDay()]);
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
                {formatJstDateLabel(d)}
              </button>
            ))}
          </div>

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
            ドリンクとお菓子は「前の営業日から」、パンは曜日で決まっているので「先週の同じ曜日から」が合います。
            写したあとに違う商品だけ直してください。
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
                            <input
                              type="number"
                              min={0}
                              value={item.plannedQty}
                              onChange={(e) =>
                                previewPlannedQty(item, Math.max(0, parseInt(e.target.value, 10) || 0))
                              }
                              onBlur={(e) =>
                                savePlannedQty(item.id, Math.max(0, parseInt(e.target.value, 10) || 0))
                              }
                              className="w-16 border border-[#e8e0d8] rounded-lg px-2 py-2 text-right text-base font-black bg-[#fdf8f3] focus:outline-none focus:ring-2 focus:ring-[#8B1A2C]"
                              aria-label={`${item.name}の発注数`}
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
