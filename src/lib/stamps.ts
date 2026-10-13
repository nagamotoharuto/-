import { db } from "@/lib/db";
import { STAMPS_PER_CARD } from "@/lib/utils";

export interface StampGrant {
  /** 押したあとの、使用中のカードのスタンプ数 */
  stamps: number;
  /** この操作で満了したカードの枚数 */
  completedNow: number;
}

/**
 * スタンプを押す。
 *
 * 満了したら自動で新しいカードに切り替え、達成した分を1枚ずつ残す。
 * 注文からもご意見からも呼ぶので、カードの繰り上がりはここに集約している。
 */
export async function grantStamps(
  nickname: string,
  amount: number,
  fields: {
    lastOrderDate?: string;
    lastOpinionDate?: string;
    streak?: number;
    countsAsOrder?: boolean;
  } = {}
): Promise<StampGrant> {
  const card = await db.stampCard.findUnique({ where: { nickname } });

  const rawStamps = (card?.stamps ?? 0) + Math.max(0, amount);
  // 1回で2枚満了することはまずないが、繰り上がりが残らないよう割り算で処理する
  const completedNow = Math.floor(rawStamps / STAMPS_PER_CARD);
  const stamps = rawStamps % STAMPS_PER_CARD;

  await db.stampCard.upsert({
    where: { nickname },
    create: {
      nickname,
      stamps,
      totalOrders: fields.countsAsOrder ? 1 : 0,
      streak: fields.streak ?? 0,
      lastOrderDate: fields.lastOrderDate ?? "",
      lastOpinionDate: fields.lastOpinionDate ?? "",
    },
    update: {
      stamps,
      ...(fields.countsAsOrder ? { totalOrders: { increment: 1 } } : {}),
      ...(fields.streak !== undefined ? { streak: fields.streak } : {}),
      ...(fields.lastOrderDate !== undefined ? { lastOrderDate: fields.lastOrderDate } : {}),
      ...(fields.lastOpinionDate !== undefined
        ? { lastOpinionDate: fields.lastOpinionDate }
        : {}),
    },
  });

  if (completedNow > 0) {
    const already = await db.stampCardCompletion.count({ where: { nickname } });
    await db.stampCardCompletion.createMany({
      data: Array.from({ length: completedNow }, (_, i) => ({
        nickname,
        cardNumber: already + i + 1,
      })),
    });
  }

  return { stamps, completedNow };
}
