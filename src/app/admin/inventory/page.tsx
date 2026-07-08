"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronLeft,
  Save,
  Package,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Pencil,
  X,
  Upload,
  ImageIcon,
  Home,
  Plus,
  Minus,
  Clock,
} from "lucide-react";
import { formatPrice, isWithinSalesHours } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
  stock: number;
  isAvailable: boolean;
  description: string;
}

interface EditState {
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  stock: number;
  isAvailable: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  bread: "パン",
  drink: "ドリンク",
  goods: "グッズ",
};

function toEditState(p: Product): EditState {
  return {
    name: p.name,
    price: String(p.price),
    imageUrl: p.imageUrl,
    description: p.description,
    stock: p.stock,
    isAvailable: p.isAvailable,
  };
}

function isDirty(p: Product, e: EditState): boolean {
  return (
    e.name !== p.name ||
    Number(e.price) !== p.price ||
    e.imageUrl !== p.imageUrl ||
    e.description !== p.description ||
    e.stock !== p.stock ||
    e.isAvailable !== p.isAvailable
  );
}

// ---- Image upload zone component ----
function ImageUploadZone({
  currentUrl,
  onUploaded,
}: {
  currentUrl: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFile(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "アップロード失敗");
      } else {
        onUploaded(data.url);
      }
    } catch {
      setUploadError("通信エラーが発生しました");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div>
      {/* Current image preview */}
      {currentUrl && (
        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-[#f5f0eb] mb-2">
          <Image
            src={currentUrl}
            alt="現在の写真"
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs py-1 text-center">
            現在の写真
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-xl py-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragging
            ? "border-[#8B1A2C] bg-[#8B1A2C]/5"
            : "border-[#e8e0d8] hover:border-[#8B1A2C] hover:bg-[#8B1A2C]/5"
        }`}
      >
        {uploading ? (
          <>
            <div className="w-6 h-6 border-2 border-[#8B1A2C] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#6b5e52]">アップロード中...</p>
          </>
        ) : (
          <>
            <Upload size={22} className={dragging ? "text-[#8B1A2C]" : "text-[#6b5e52]"} />
            <p className="text-xs font-bold text-[#6b5e52] text-center">
              クリックまたはドラッグ＆ドロップ
            </p>
            <p className="text-xs text-[#6b5e52]">JPEG・PNG・WebP・GIF（5MBまで）</p>
          </>
        )}
      </div>

      {uploadError && (
        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}

// ---- Main page ----
export default function InventoryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", category: "bread", price: "", imageUrl: "", stock: 0, description: "" });
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [stockUpdating, setStockUpdating] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("staff_auth")) {
      router.push("/admin");
      return;
    }
    loadProducts();
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const businessOpen = isWithinSalesHours(now);

  async function loadProducts() {
    setLoading(true);
    const res = await fetch("/api/inventory");
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function getEdit(product: Product): EditState {
    return edits[product.id] ?? toEditState(product);
  }

  function updateEdit(id: string, field: keyof EditState, value: string | number | boolean) {
    const product = products.find((p) => p.id === id)!;
    setEdits((prev) => ({ ...prev, [id]: { ...getEdit(product), [field]: value } }));
    setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function adjustStock(product: Product, delta: number) {
    const nextStock = Math.max(0, product.stock + delta);
    if (nextStock === product.stock || stockUpdating) return;

    setStockUpdating(product.id);
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: nextStock } : p)));

    const res = await fetch("/api/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, stock: nextStock }),
    });

    if (!res.ok) {
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, stock: product.stock } : p)));
    }
    setStockUpdating(null);
  }

  function cancelEdit(product: Product) {
    setEdits((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setErrors((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setExpanded((prev) => ({ ...prev, [product.id]: false }));
  }

  async function saveProduct(product: Product) {
    const edit = getEdit(product);

    if (!edit.name.trim()) {
      setErrors((prev) => ({ ...prev, [product.id]: "商品名を入力してください" }));
      return;
    }
    const priceNum = Number(edit.price);
    if (!edit.price || isNaN(priceNum) || priceNum <= 0) {
      setErrors((prev) => ({ ...prev, [product.id]: "正しい金額を入力してください" }));
      return;
    }
    if (!edit.imageUrl.trim()) {
      setErrors((prev) => ({ ...prev, [product.id]: "写真をアップロードしてください" }));
      return;
    }

    setSaving(product.id);
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name,
        price: priceNum,
        imageUrl: edit.imageUrl,
        description: edit.description,
        stock: edit.stock,
        isAvailable: edit.isAvailable,
      }),
    });
    setSaving(null);

    if (!res.ok) {
      const data = await res.json();
      setErrors((prev) => ({ ...prev, [product.id]: data.error ?? "保存に失敗しました" }));
      return;
    }

    setEdits((prev) => { const n = { ...prev }; delete n[product.id]; return n; });
    setExpanded((prev) => ({ ...prev, [product.id]: false }));
    loadProducts();
  }

  async function createProduct() {
    if (!newProduct.name.trim()) { setAddError("商品名を入力してください"); return; }
    const priceNum = Number(newProduct.price);
    if (!newProduct.price || isNaN(priceNum) || priceNum <= 0) { setAddError("正しい金額を入力してください"); return; }
    setAddSaving(true);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProduct.name.trim(),
        category: newProduct.category,
        price: priceNum,
        imageUrl: newProduct.imageUrl,
        stock: newProduct.stock,
        description: newProduct.description,
      }),
    });
    setAddSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error ?? "保存に失敗しました");
      return;
    }
    setShowAddForm(false);
    setNewProduct({ name: "", category: "bread", price: "", imageUrl: "", stock: 0, description: "" });
    setAddError("");
    loadProducts();
  }

  const categories = ["bread", "drink", "goods"];

  return (
    <div className="min-h-screen bg-[#fdf8f3]">
      <header className="bg-[#8B1A2C] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-[#A8C8F0] hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Package size={18} className="text-[#F0AA5A]" />
            <span className="font-bold text-sm">商品・在庫管理</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 text-xs text-[#A8C8F0] hover:text-white">
            <Home size={14} />
            ホーム
          </Link>
          <button
            onClick={loadProducts}
            className="flex items-center gap-1 text-xs text-[#A8C8F0] hover:text-white"
          >
            <RefreshCw size={14} />
            更新
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <p className="text-xs text-[#6b5e52] mb-4">
          各商品の「編集」ボタンで商品名・金額・写真を変更、在庫は＋／－ボタンでリアルタイムに変更できます。
        </p>

        {/* Business hours banner */}
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 mb-4 text-xs font-bold ${
            businessOpen
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-gray-100 border border-gray-300 text-gray-600"
          }`}
        >
          <Clock size={14} />
          {businessOpen
            ? "営業時間中（平日11:00〜15:00）：販売中の商品はお客様に表示されています"
            : "営業時間外です：全商品が自動的に「停止中」として表示されます（土日祝は休業／次の営業日11:00に自動再開）"}
        </div>

        {/* Add new product */}
        <div className="mb-6">
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
            className="w-full flex items-center justify-center gap-2 bg-[#8B1A2C] text-white rounded-2xl py-3 font-bold text-sm hover:bg-[#A52235] transition-colors"
          >
            <Plus size={16} />
            新しい商品を追加
          </button>

          {showAddForm && (
            <div className="mt-3 bg-white rounded-2xl border border-[#e8e0d8] shadow-sm p-4 flex flex-col gap-3">
              <p className="text-sm font-bold text-[#1a1a1a]">新規商品登録</p>

              {addError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2">{addError}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">商品名</label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => { setNewProduct(p => ({ ...p, name: e.target.value })); setAddError(""); }}
                  maxLength={50}
                  placeholder="例：あんパン"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">カテゴリ</label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct(p => ({ ...p, category: e.target.value }))}
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                >
                  <option value="bread">パン</option>
                  <option value="drink">ドリンク</option>
                  <option value="goods">グッズ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">金額（円）</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b5e52]">¥</span>
                  <input
                    type="number"
                    min={1}
                    max={99999}
                    value={newProduct.price}
                    onChange={(e) => { setNewProduct(p => ({ ...p, price: e.target.value })); setAddError(""); }}
                    className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1 flex items-center gap-1">
                  <ImageIcon size={12} />
                  写真
                </label>
                <ImageUploadZone
                  currentUrl={newProduct.imageUrl}
                  onUploaded={(url) => setNewProduct(p => ({ ...p, imageUrl: url }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">説明文</label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                  maxLength={100}
                  rows={2}
                  placeholder="商品の説明を入力（任意）"
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6b5e52] mb-1">初期在庫数</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct(p => ({ ...p, stock: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowAddForm(false); setAddError(""); setNewProduct({ name: "", category: "bread", price: "", imageUrl: "", stock: 0, description: "" }); }}
                  className="flex-1 border border-[#e8e0d8] text-[#6b5e52] rounded-xl py-2.5 text-sm font-bold hover:bg-[#f5f0eb] transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={createProduct}
                  disabled={addSaving}
                  className="flex-1 bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#A52235] transition-colors disabled:opacity-60"
                >
                  <Save size={14} />
                  {addSaving ? "保存中..." : "追加する"}
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl h-24 animate-pulse border border-[#e8e0d8]"
              />
            ))}
          </div>
        ) : (
          categories.map((cat) => {
            const catProducts = products.filter((p) => p.category === cat);
            if (catProducts.length === 0) return null;
            return (
              <div key={cat} className="mb-6">
                <h2 className="font-bold text-[#1a1a1a] mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#8B1A2C] rounded-full inline-block" />
                  {CATEGORY_LABELS[cat]}
                </h2>
                <div className="flex flex-col gap-3">
                  {catProducts.map((product) => {
                    const edit = getEdit(product);
                    const dirty = isDirty(product, edit);
                    const isOpen = expanded[product.id] ?? false;
                    const err = errors[product.id];
                    const effectiveAvailable = edit.isAvailable && businessOpen;

                    return (
                      <div
                        key={product.id}
                        className="bg-white rounded-2xl border border-[#e8e0d8] shadow-sm overflow-hidden"
                      >
                        {/* Collapsed row */}
                        <div className="p-4 flex items-center gap-3">
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#f5f0eb]">
                            <Image
                              src={edit.imageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#1a1a1a] truncate">
                              {edit.name}
                            </p>
                            <p className="text-xs text-[#6b5e52]">
                              {formatPrice(Number(edit.price) || product.price)}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-[#6b5e52]">在庫</span>
                                <button
                                  onClick={() => adjustStock(product, -1)}
                                  disabled={product.stock <= 0 || stockUpdating === product.id}
                                  className="w-6 h-6 flex items-center justify-center rounded-full border border-[#e8e0d8] text-[#8B1A2C] hover:bg-[#f5f0eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-7 text-center text-sm font-black text-[#1a1a1a]">
                                  {product.stock}
                                </span>
                                <button
                                  onClick={() => adjustStock(product, 1)}
                                  disabled={stockUpdating === product.id}
                                  className="w-6 h-6 flex items-center justify-center rounded-full border border-[#e8e0d8] text-[#8B1A2C] hover:bg-[#f5f0eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  updateEdit(product.id, "isAvailable", !edit.isAvailable)
                                }
                                className="flex items-center gap-0.5"
                              >
                                {effectiveAvailable ? (
                                  <ToggleRight size={20} className="text-[#8B1A2C]" />
                                ) : (
                                  <ToggleLeft size={20} className="text-[#e8e0d8]" />
                                )}
                                <span
                                  className={`text-xs font-bold ${
                                    effectiveAvailable ? "text-[#8B1A2C]" : "text-[#6b5e52]"
                                  }`}
                                >
                                  {effectiveAvailable ? "販売中" : "停止中"}
                                </span>
                              </button>
                              {!businessOpen && edit.isAvailable && (
                                <span className="text-[10px] text-[#6b5e52]">(営業時間外)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button
                              onClick={() => toggleExpand(product.id)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                isOpen
                                  ? "bg-[#f5f0eb] text-[#6b5e52] border-[#e8e0d8]"
                                  : "bg-white text-[#8B1A2C] border-[#8B1A2C] hover:bg-[#8B1A2C] hover:text-white"
                              }`}
                            >
                              {isOpen ? <X size={12} /> : <Pencil size={12} />}
                              {isOpen ? "閉じる" : "編集"}
                            </button>
                            {dirty && !isOpen && (
                              <button
                                onClick={() => saveProduct(product)}
                                disabled={saving === product.id}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#8B1A2C] text-white rounded-xl text-xs font-bold hover:bg-[#A52235] transition-colors disabled:opacity-60"
                              >
                                <Save size={12} />
                                {saving === product.id ? "保存中" : "保存"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded edit form */}
                        {isOpen && (
                          <div className="border-t border-[#e8e0d8] bg-[#fdf8f3] p-4 flex flex-col gap-3">
                            <p className="text-xs font-bold text-[#6b5e52]">商品情報を編集</p>

                            {err && (
                              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-2">
                                {err}
                              </div>
                            )}

                            {/* Name */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                商品名
                              </label>
                              <input
                                type="text"
                                value={edit.name}
                                onChange={(e) => updateEdit(product.id, "name", e.target.value)}
                                maxLength={50}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                              />
                            </div>

                            {/* Price */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                金額（円）
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6b5e52]">
                                  ¥
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={99999}
                                  value={edit.price}
                                  onChange={(e) =>
                                    updateEdit(product.id, "price", e.target.value)
                                  }
                                  className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white"
                                />
                              </div>
                            </div>

                            {/* Image upload */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1 flex items-center gap-1">
                                <ImageIcon size={12} />
                                写真
                              </label>
                              <ImageUploadZone
                                currentUrl={edit.imageUrl}
                                onUploaded={(url) => updateEdit(product.id, "imageUrl", url)}
                              />
                            </div>

                            {/* Description */}
                            <div>
                              <label className="block text-xs font-bold text-[#6b5e52] mb-1">
                                説明文
                              </label>
                              <textarea
                                value={edit.description}
                                onChange={(e) =>
                                  updateEdit(product.id, "description", e.target.value)
                                }
                                maxLength={100}
                                rows={2}
                                className="w-full border border-[#e8e0d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1A2C] bg-white resize-none"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => cancelEdit(product)}
                                className="flex-1 border border-[#e8e0d8] text-[#6b5e52] rounded-xl py-2.5 text-sm font-bold hover:bg-[#f5f0eb] transition-colors"
                              >
                                キャンセル
                              </button>
                              <button
                                onClick={() => saveProduct(product)}
                                disabled={saving === product.id || !dirty}
                                className="flex-1 bg-[#8B1A2C] text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 hover:bg-[#A52235] transition-colors disabled:opacity-60"
                              >
                                <Save size={14} />
                                {saving === product.id ? "保存中..." : "保存する"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}