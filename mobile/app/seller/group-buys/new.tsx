import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { useSellerMode } from "@/store/seller-mode";

/**
 * /seller/group-buys/new — create a Group Buy campaign.
 *
 * Inputs:
 *   1. Pick product (paged grid of the shop's products)
 *   2. Title + (optional) description
 *   3. Min qty (the goal — when reached, status flips to FILLED)
 *   4. Optional max qty cap
 *   5. Deadline preset (24h / 48h / 72h / 7 days) — server caps to 30 days
 *   6. Tier ladder — up to 3 rows of (minQty, priceBaht), pre-seeded with the
 *      product's current price; sellers add more rows to offer discounts at
 *      higher quantities. Server re-validates monotonicity + price ceiling.
 *
 * We compute the live "ขายแล้วได้กำไรเท่าไหร่" hint inline so sellers don't
 * commit to a price below cost by mistake. Validation matches the server's
 * `validateTiers()` so we fail loudly client-side before the POST.
 */

type DurationPreset = "24h" | "48h" | "72h" | "7d";

interface TierRow {
  minQty: string;
  priceBaht: string;
}

const DURATION_OPTIONS: Array<{
  key: DurationPreset;
  label: string;
  hours: number;
}> = [
  { key: "24h", label: "24 ชม.", hours: 24 },
  { key: "48h", label: "48 ชม.", hours: 48 },
  { key: "72h", label: "72 ชม.", hours: 72 },
  { key: "7d", label: "7 วัน", hours: 24 * 7 },
];

export default function NewGroupBuyScreen() {
  const activeSlug = useSellerMode((s) => s.activeShopSlug);

  const productsQuery = useQuery({
    queryKey: ["shop", activeSlug],
    queryFn: () => api.shop.get(activeSlug!),
    enabled: Boolean(activeSlug),
  });
  const products = productsQuery.data?.products ?? [];

  const [productSlug, setProductSlug] = useState<string | null>(null);
  const product = products.find((p) => p.slug === productSlug) ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minQty, setMinQty] = useState("20");
  const [maxQty, setMaxQty] = useState("");
  const [duration, setDuration] = useState<DurationPreset>("72h");

  const [tiers, setTiers] = useState<TierRow[]>([
    { minQty: "10", priceBaht: "" },
  ]);

  // Seed the first tier's price at 90% of the picked product's price.
  // Re-seed every time the seller switches product (state-guard pattern
  // so we don't loop the render).
  const [lastSeededSlug, setLastSeededSlug] = useState<string | null>(null);
  if (product && lastSeededSlug !== product.slug) {
    setLastSeededSlug(product.slug);
    const seededBaht = Math.floor((product.priceSatang * 0.9) / 100).toString();
    setTiers([{ minQty: "10", priceBaht: seededBaht }]);
  }

  type Validation =
    | { ok: false; reason: string }
    | {
        ok: true;
        input: {
          productSlug: string;
          title: string;
          description: string | undefined;
          minQty: number;
          maxQty: number | null;
          tiers: Array<{ minQty: number; priceSatang: number }>;
        };
      };

  const validation: Validation = ((): Validation => {
    if (!product) return { ok: false, reason: "เลือกสินค้าก่อน" };
    if (title.trim().length < 3) return { ok: false, reason: "ใส่ชื่อแคมเปญ" };

    const minQtyNum = Number(minQty);
    if (!Number.isInteger(minQtyNum) || minQtyNum < 2)
      return { ok: false, reason: "ต้องการอย่างน้อย 2 ชิ้น" };

    const maxQtyNum = maxQty.trim() ? Number(maxQty) : null;
    if (maxQtyNum !== null) {
      if (!Number.isInteger(maxQtyNum) || maxQtyNum < minQtyNum)
        return { ok: false, reason: "maxQty ต้องมากกว่าหรือเท่ากับ minQty" };
    }

    const cleanedTiers: Array<{ minQty: number; priceSatang: number }> = [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]!;
      const qty = Number(t.minQty);
      const priceSatang = Math.round(Number(t.priceBaht.replace(/,/g, "")) * 100);
      if (!Number.isInteger(qty) || qty < 1)
        return { ok: false, reason: `แถวที่ ${i + 1}: ขั้นต่ำต้อง ≥ 1` };
      if (!Number.isInteger(priceSatang) || priceSatang < 1)
        return { ok: false, reason: `แถวที่ ${i + 1}: ราคาต้อง > 0` };
      if (priceSatang > product.priceSatang)
        return {
          ok: false,
          reason: `แถวที่ ${i + 1}: ราคาห้ามแพงกว่าราคาปกติ (${formatBaht(product.priceSatang)})`,
        };
      cleanedTiers.push({ minQty: qty, priceSatang });
    }
    cleanedTiers.sort((a, b) => a.minQty - b.minQty);

    let prevQty = 0;
    let prevPrice = Infinity;
    for (const t of cleanedTiers) {
      if (t.minQty <= prevQty)
        return { ok: false, reason: "ขั้นต่ำของแต่ละขั้นต้องเรียงเพิ่ม" };
      if (t.priceSatang >= prevPrice)
        return { ok: false, reason: "ราคาต่อชิ้นต้องลดลงตามขั้น" };
      prevQty = t.minQty;
      prevPrice = t.priceSatang;
    }

    if (cleanedTiers[0]!.minQty > minQtyNum)
      return {
        ok: false,
        reason: "ขั้นแรกต้องมี minQty ≤ ขั้นต่ำของแคมเปญ",
      };

    return {
      ok: true,
      input: {
        productSlug: product.slug,
        title: title.trim(),
        description: description.trim() || undefined,
        minQty: minQtyNum,
        maxQty: maxQtyNum,
        tiers: cleanedTiers,
      },
    };
  })();

  const createMutation = useMutation({
    mutationFn: () => {
      if (!validation.ok) throw new Error(validation.reason);
      // Capture the narrowed input so TS doesn't widen across the closure.
      const input = validation.input;
      const hours = DURATION_OPTIONS.find((d) => d.key === duration)!.hours;
      const deadline = new Date(Date.now() + hours * 60 * 60 * 1000);
      return api.groupBuy.create(activeSlug!, {
        productSlug: input.productSlug,
        title: input.title,
        description: input.description,
        minQty: input.minQty,
        maxQty: input.maxQty,
        tiers: input.tiers,
        deadline: deadline.toISOString(),
      });
    },
    onSuccess: () => {
      Alert.alert("เปิดแคมเปญแล้ว", "ลูกค้าเห็นได้ทันทีที่หน้าร้าน", [
        { text: "ตกลง", onPress: () => router.replace("/seller/group-buys") },
      ]);
    },
    onError: (e) => {
      const msg = e instanceof ApiClientError ? e.message : "สร้างไม่สำเร็จ";
      Alert.alert("เกิดข้อผิดพลาด", msg);
    },
  });

  if (!activeSlug) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-fg">เลือกร้านก่อน</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="pb-32">
        <View className="px-5 pt-6">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            สร้างแคมเปญ Group Buy
          </Text>
          <Text className="mt-1 text-[20px] font-bold text-fg">
            ตั้งราคา + เป้าจำนวน
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-muted">
            ลูกค้า join → คุณได้สลิป → เมื่อยอดถึงเป้า ระบบเปลี่ยนสถานะเป็น FILLED
            ให้อัตโนมัติ ถ้าไม่ถึงเป้าก่อนหมดเวลา ระบบยกเลิก + คืนเงินให้
          </Text>
        </View>

        {/* 1. Product picker */}
        <SectionTitle>1. เลือกสินค้า</SectionTitle>
        {productsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : products.length === 0 ? (
          <View className="mx-5 rounded-2xl border border-dashed border-border p-6">
            <Text className="text-center text-[12px] text-muted">
              ยังไม่มีสินค้าในร้าน — เพิ่มสินค้าก่อนจึงเปิดแคมเปญได้
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-5 gap-2 py-1"
          >
            {products.map((p) => {
              const selected = p.slug === productSlug;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setProductSlug(p.slug)}
                  className={`w-32 overflow-hidden rounded-2xl border bg-white ${
                    selected ? "border-emerald-500" : "border-border"
                  }`}
                >
                  <View className="aspect-square w-full bg-soft">
                    {p.imageUrls?.[0] ? (
                      <Image
                        source={{ uri: p.imageUrls[0] }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                  <View className="p-2">
                    <Text
                      className="text-[11px] font-semibold text-fg"
                      numberOfLines={2}
                    >
                      {p.name}
                    </Text>
                    <Text className="mt-0.5 text-[11px] font-bold text-fg">
                      {formatBaht(p.priceSatang)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* 2. Title + description */}
        <SectionTitle>2. ชื่อแคมเปญ</SectionTitle>
        <View className="mx-5 gap-2">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="เช่น รวมซื้อเค้กลด 30% ส่งทั่วประเทศ"
            maxLength={120}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] text-fg"
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="รายละเอียดเพิ่มเติม (ไม่จำเป็น)"
            multiline
            maxLength={2000}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 80, textAlignVertical: "top" }}
          />
        </View>

        {/* 3. Goal quantity */}
        <SectionTitle>3. เป้าจำนวน (ต่ำสุดที่ทำให้แคมเปญ &quot;เต็ม&quot;)</SectionTitle>
        <View className="mx-5 flex-row gap-3">
          <View className="flex-1">
            <Text className="text-[11px] text-muted">เป้า (minQty)</Text>
            <TextInput
              value={minQty}
              onChangeText={(v) => setMinQty(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] font-semibold text-fg"
            />
          </View>
          <View className="flex-1">
            <Text className="text-[11px] text-muted">เพดาน (maxQty, ปล่อยว่าง = ไม่จำกัด)</Text>
            <TextInput
              value={maxQty}
              onChangeText={(v) => setMaxQty(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              maxLength={6}
              className="mt-1 rounded-2xl border border-border bg-white px-3 py-2.5 text-[15px] font-semibold text-fg"
              placeholder="ไม่จำกัด"
            />
          </View>
        </View>

        {/* 4. Duration preset */}
        <SectionTitle>4. หมดเวลาใน</SectionTitle>
        <View className="mx-5 flex-row gap-2">
          {DURATION_OPTIONS.map((d) => {
            const selected = duration === d.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => setDuration(d.key)}
                className={`flex-1 items-center rounded-2xl border px-3 py-2.5 ${
                  selected
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-border bg-white"
                }`}
              >
                <Text
                  className={`text-[13px] font-semibold ${
                    selected ? "text-emerald-700" : "text-fg"
                  }`}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5. Tier ladder */}
        <SectionTitle>5. ขั้นราคา</SectionTitle>
        <View className="mx-5 gap-2">
          <Text className="text-[11px] text-muted">
            ยิ่งซื้อรวมกันเยอะ ราคาต่อชิ้นยิ่งถูก — ขั้นต่ำสุดต้อง ≤ เป้า ({minQty || 0} ชิ้น)
          </Text>
          {tiers.map((t, i) => (
            <View
              key={i}
              className="flex-row items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2"
            >
              <Text className="text-[12px] text-muted">≥</Text>
              <TextInput
                value={t.minQty}
                onChangeText={(v) =>
                  setTiers((prev) =>
                    prev.map((row, idx) =>
                      idx === i
                        ? { ...row, minQty: v.replace(/[^\d]/g, "") }
                        : row,
                    ),
                  )
                }
                keyboardType="number-pad"
                maxLength={6}
                className="w-16 rounded-xl bg-soft px-2 py-1.5 text-center text-[14px] font-semibold text-fg"
              />
              <Text className="text-[12px] text-muted">ชิ้น · ฿</Text>
              <TextInput
                value={t.priceBaht}
                onChangeText={(v) =>
                  setTiers((prev) =>
                    prev.map((row, idx) =>
                      idx === i
                        ? {
                            ...row,
                            priceBaht: v.replace(/[^\d.,]/g, ""),
                          }
                        : row,
                    ),
                  )
                }
                keyboardType="decimal-pad"
                maxLength={10}
                className="flex-1 rounded-xl bg-soft px-2 py-1.5 text-[14px] font-semibold text-fg"
                placeholder="ราคา/ชิ้น"
              />
              {tiers.length > 1 ? (
                <Pressable
                  onPress={() =>
                    setTiers((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="rounded-full bg-rose-50 px-2 py-1"
                >
                  <Text className="text-[10px] font-semibold text-rose-700">
                    ลบ
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {tiers.length < 3 ? (
            <Pressable
              onPress={() =>
                setTiers((prev) => [
                  ...prev,
                  { minQty: "", priceBaht: "" },
                ])
              }
              className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5"
            >
              <Text className="text-[12px] font-semibold text-emerald-700">
                + เพิ่มขั้น
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Validation hint */}
        {!validation.ok ? (
          <View className="mx-5 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2">
            <Text className="text-[12px] text-amber-900">
              ⚠️ {validation.reason}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-white p-4">
        <Button
          disabled={!validation.ok || createMutation.isPending}
          onPress={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            "เปิดแคมเปญ"
          )}
        </Button>
      </View>
    </Screen>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mx-5 mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted">
      {children}
    </Text>
  );
}
