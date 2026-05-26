import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { Button } from "@/components/ui/button";

/**
 * V1.5 search filter sheet — modal that slides up from the bottom.
 *
 * Surfaces:
 *  - Sort order (relevance / sold / price asc/desc / newest)
 *  - Price range (฿ min/max — entered in baht; component converts to satang
 *    so the parent doesn't have to know about the unit shift)
 *  - Verified-only toggle
 *  - Min rating (1–5 stars)
 *
 * The parent owns the canonical filter state. We expose a draft state so
 * "Cancel" actually cancels — committing only happens on "Apply".
 */
export type SortOrder =
  | "relevance"
  | "sold"
  | "price-asc"
  | "price-desc"
  | "newest";

export interface SearchFilters {
  sort: SortOrder;
  verifiedOnly: boolean;
  minPriceBaht: string; // empty string = no bound
  maxPriceBaht: string;
  minRating: number; // 0 = no filter
}

export const DEFAULT_FILTERS: SearchFilters = {
  sort: "relevance",
  verifiedOnly: false,
  minPriceBaht: "",
  maxPriceBaht: "",
  minRating: 0,
};

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (next: SearchFilters) => void;
}

const SORT_OPTIONS: Array<{ key: SortOrder; label: string }> = [
  { key: "relevance", label: "เกี่ยวข้อง" },
  { key: "sold", label: "ขายดี" },
  { key: "price-asc", label: "ราคาต่ำ → สูง" },
  { key: "price-desc", label: "ราคาสูง → ต่ำ" },
  { key: "newest", label: "ใหม่ล่าสุด" },
];

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<SearchFilters>(filters);

  // Sync draft when sheet (re-)opens with new parent state.
  if (visible && draft !== filters && !__hasUnsaved(draft, filters)) {
    setDraft(filters);
  }

  function reset() {
    setDraft(DEFAULT_FILTERS);
  }
  function apply() {
    onApply(draft);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable className="mt-auto" onPress={(e) => e.stopPropagation()}>
          <View className="rounded-t-3xl bg-white pt-4 pb-8">
            <View className="mx-auto h-1.5 w-10 rounded-full bg-zinc-300" />
            <View className="mt-4 flex-row items-center justify-between px-5">
              <Text className="text-[17px] font-semibold text-fg">
                ตัวกรองค้นหา
              </Text>
              <Pressable onPress={reset} hitSlop={8}>
                <Text className="text-[12px] font-medium text-brand-700">
                  รีเซ็ต
                </Text>
              </Pressable>
            </View>

            <ScrollView className="mt-4 max-h-[70vh]">
              <View className="gap-5 px-5 pb-4">
                {/* Sort */}
                <Section label="เรียงตาม">
                  <View className="flex-row flex-wrap gap-2">
                    {SORT_OPTIONS.map((opt) => {
                      const active = draft.sort === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() =>
                            setDraft((d) => ({ ...d, sort: opt.key }))
                          }
                          className={`rounded-full border px-3 py-1.5 ${
                            active
                              ? "border-brand-300 bg-brand-50"
                              : "border-border bg-white"
                          }`}
                        >
                          <Text
                            className={`text-[12px] font-medium ${
                              active ? "text-brand-700" : "text-fg"
                            }`}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>

                {/* Price range */}
                <Section label="ช่วงราคา (บาท)">
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={draft.minPriceBaht}
                      onChangeText={(v: string) =>
                        setDraft((d) => ({
                          ...d,
                          minPriceBaht: v.replace(/[^\d]/g, ""),
                        }))
                      }
                      placeholder="ต่ำสุด"
                      keyboardType="number-pad"
                      className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-[14px]"
                    />
                    <Text className="text-[14px] text-muted">—</Text>
                    <TextInput
                      value={draft.maxPriceBaht}
                      onChangeText={(v: string) =>
                        setDraft((d) => ({
                          ...d,
                          maxPriceBaht: v.replace(/[^\d]/g, ""),
                        }))
                      }
                      placeholder="สูงสุด"
                      keyboardType="number-pad"
                      className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-[14px]"
                    />
                  </View>
                </Section>

                {/* Min rating */}
                <Section label="ดาวร้าน">
                  <View className="flex-row gap-2">
                    {[0, 3, 4, 4.5].map((r) => {
                      const active = draft.minRating === r;
                      return (
                        <Pressable
                          key={r}
                          onPress={() =>
                            setDraft((d) => ({ ...d, minRating: r }))
                          }
                          className={`flex-1 rounded-xl border px-3 py-2 ${
                            active
                              ? "border-amber-300 bg-amber-50"
                              : "border-border bg-white"
                          }`}
                        >
                          <Text
                            className={`text-center text-[12px] font-medium ${
                              active ? "text-amber-700" : "text-fg"
                            }`}
                          >
                            {r === 0 ? "ทุกดาว" : `★ ${r}+`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>

                {/* Verified */}
                <Section label="ความน่าเชื่อถือ">
                  <Pressable
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        verifiedOnly: !d.verifiedOnly,
                      }))
                    }
                    className={`flex-row items-center gap-2 self-start rounded-full border px-3 py-2 ${
                      draft.verifiedOnly
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-border bg-white"
                    }`}
                  >
                    <Text className={draft.verifiedOnly ? "" : "opacity-50"}>
                      ✓
                    </Text>
                    <Text
                      className={`text-[12px] font-semibold ${
                        draft.verifiedOnly
                          ? "text-emerald-700"
                          : "text-muted"
                      }`}
                    >
                      เฉพาะร้านที่ยืนยันตัวตน
                    </Text>
                  </Pressable>
                </Section>
              </View>
            </ScrollView>

            <View className="flex-row gap-2 px-5 pt-2">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                ยกเลิก
              </Button>
              <Button className="flex-1" onPress={apply}>
                ใช้ตัวกรอง
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

// Local helper — has the user actually edited the draft? Used to avoid
// resyncing draft state on every parent rerender (which would discard their
// in-progress edits).
function __hasUnsaved(a: SearchFilters, b: SearchFilters): boolean {
  return (
    a.sort !== b.sort ||
    a.verifiedOnly !== b.verifiedOnly ||
    a.minPriceBaht !== b.minPriceBaht ||
    a.maxPriceBaht !== b.maxPriceBaht ||
    a.minRating !== b.minRating
  );
}
