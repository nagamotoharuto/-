import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaBetterSqlite3({ url: "file:./dev.db" });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  await prisma.product.deleteMany();

  const products = [
    // Bread (3)
    {
      name: "バターロール",
      category: "bread",
      price: 150,
      imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&q=80",
      stock: 20,
      description: "ふわふわのバターロール。毎朝焼きたて。",
    },
    {
      name: "カレーパン",
      category: "bread",
      price: 200,
      imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
      stock: 15,
      description: "スパイシーなカレーをサクサクのパン生地で包みました。",
    },
    {
      name: "クリームパン",
      category: "bread",
      price: 180,
      imageUrl: "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400&q=80",
      stock: 18,
      description: "なめらかなカスタードクリームたっぷり。",
    },
    // Drinks (6)
    {
      name: "ホットコーヒー",
      category: "drink",
      price: 200,
      imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80",
      stock: 30,
      description: "芳醇な香りの本格ブレンドコーヒー。",
    },
    {
      name: "アイスコーヒー",
      category: "drink",
      price: 220,
      imageUrl: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80",
      stock: 25,
      description: "キリっと冷えたアイスコーヒー。",
    },
    {
      name: "ホットティー",
      category: "drink",
      price: 180,
      imageUrl: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80",
      stock: 20,
      description: "やさしい香りの紅茶。",
    },
    {
      name: "アイスティー",
      category: "drink",
      price: 200,
      imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80",
      stock: 20,
      description: "すっきり爽やかなアイスティー。",
    },
    {
      name: "オレンジジュース",
      category: "drink",
      price: 180,
      imageUrl: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80",
      stock: 15,
      description: "フレッシュオレンジ100%。",
    },
    {
      name: "ミネラルウォーター",
      category: "drink",
      price: 100,
      imageUrl: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80",
      stock: 40,
      description: "厳選された天然水。",
    },
    // University Goods (2)
    {
      name: "大学ロゴマグカップ",
      category: "goods",
      price: 800,
      imageUrl: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80",
      stock: 10,
      description: "大学公式ロゴ入りセラミックマグ。",
    },
    {
      name: "大学ロゴトートバッグ",
      category: "goods",
      price: 1200,
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80",
      stock: 8,
      description: "エコなキャンバス素材の大学公式トートバッグ。",
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`Seeded ${products.length} products successfully`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
