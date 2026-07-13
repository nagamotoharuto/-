const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'dev.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "price" INTEGER NOT NULL,
  "imageUrl" TEXT NOT NULL DEFAULT '',
  "stock" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL DEFAULT '',
  "isAvailable" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nickname" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "userType" TEXT NOT NULL,
  "pickupTime" TEXT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalAmount" INTEGER NOT NULL,
  "orderNumber" TEXT NOT NULL UNIQUE,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price" INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS "StampCard" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "nickname" TEXT NOT NULL UNIQUE,
  "stamps" INTEGER NOT NULL DEFAULT 0,
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "lastOrderDate" TEXT NOT NULL DEFAULT '',
  "freeItemAvailable" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO "Product"
    ("id","name","category","price","imageUrl","stock","description","isAvailable","createdAt","updatedAt")
  VALUES (?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
`);

const products = [
  ['prod_bread_001','バターロール','bread',150,'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&q=80',20,'ふわふわのバターロール。毎朝焼きたて。'],
  ['prod_bread_002','カレーパン','bread',200,'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',15,'スパイシーなカレーをサクサクのパン生地で包みました。'],
  ['prod_bread_003','クリームパン','bread',180,'https://images.unsplash.com/photo-1568254183919-78a4f43a2877?w=400&q=80',18,'なめらかなカスタードクリームたっぷり。'],
  ['prod_drink_001','ホットコーヒー','drink',200,'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&q=80',30,'芳醇な香りの本格ブレンドコーヒー。'],
  ['prod_drink_002','アイスコーヒー','drink',220,'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80',25,'キリっと冷えたアイスコーヒー。'],
  ['prod_drink_003','ホットティー','drink',180,'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80',20,'やさしい香りの紅茶。'],
  ['prod_drink_004','アイスティー','drink',200,'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',20,'すっきり爽やかなアイスティー。'],
  ['prod_drink_005','オレンジジュース','drink',180,'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&q=80',15,'フレッシュオレンジ100%。'],
  ['prod_drink_006','ミネラルウォーター','drink',100,'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',40,'厳選された天然水。'],
  ['prod_goods_001','大学ロゴマグカップ','goods',800,'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&q=80',10,'大学公式ロゴ入りセラミックマグ。'],
  ['prod_goods_002','大学ロゴトートバッグ','goods',1200,'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80',8,'エコなキャンバス素材の大学公式トートバッグ。'],
];

for (const p of products) insert.run(...p);
console.log('DB initialized: ' + products.length + ' products inserted');
db.close();
