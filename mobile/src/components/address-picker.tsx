import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { api } from "@/lib/api";

/**
 * AddressPicker — postcode-first Thai address autocomplete.
 *
 * The buyer types their 5-digit postcode; we hit `/api/v1/thai-address` and
 * surface the matching subdistrict / district / province combinations. After
 * they pick one, the parent gets the composed address string back via
 * `onChange`, and we let them tack on building-number details freeform.
 *
 * Same UX shape as the web's `ThaiAddressPicker` so power-users get a
 * familiar flow on both surfaces.
 */
export interface ThaiAddressOption {
  key: string;
  postcode: string;
  subdistrict: string;
  district: string;
  province: string;
}

interface Props {
  /** Composed final address string (what we POST to /orders). */
  value: string;
  onChange: (composed: string) => void;
  /** Initial postcode if we can prefill from a saved address. */
  initialPostcode?: string;
}

export function AddressPicker({ value, onChange, initialPostcode = "" }: Props) {
  const [postcode, setPostcode] = useState(initialPostcode);
  const [detail, setDetail] = useState("");
  const [options, setOptions] = useState<ThaiAddressOption[]>([]);
  const [selected, setSelected] = useState<ThaiAddressOption | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset options + selection during render whenever the postcode is no
  // longer a valid 5-digit code (e.g. the buyer started editing it). Doing
  // this in render with a state guard sidesteps React 19's set-state-in-effect
  // warning and removes a flicker pass.
  const postcodeReady = postcode.length === 5;
  const [lastPostcodeReady, setLastPostcodeReady] = useState(postcodeReady);
  if (!postcodeReady && lastPostcodeReady) {
    setLastPostcodeReady(false);
    setOptions([]);
    setSelected(null);
  } else if (postcodeReady && !lastPostcodeReady) {
    setLastPostcodeReady(true);
  }

  // When the 5-digit postcode is complete, kick off the lookup. We cancel
  // in-flight requests on subsequent edits so a fast typist doesn't get
  // stale results layered on top. `setLoading` is deferred to a microtask
  // so the call isn't synchronous in the effect body (React 19 rule).
  useEffect(() => {
    if (postcode.length !== 5) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    api
      .thaiAddress(postcode)
      .then((res) => {
        if (cancelled) return;
        setOptions(res.options);
        // Auto-pick when there's only one subdistrict for the postcode.
        if (res.options.length === 1) {
          setSelected(res.options[0]!);
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postcode]);

  // Compose the final address whenever `detail` or `selected` changes — keep
  // the parent in sync. Empty state is empty so the order POST doesn't write
  // a half-baked address.
  const composed = useMemo(() => {
    const trimmedDetail = detail.replace(/\s+/g, " ").trim();
    if (!trimmedDetail || !selected) return "";
    return [
      trimmedDetail,
      `ต.${selected.subdistrict}`,
      `อ.${selected.district}`,
      `จ.${selected.province}`,
      selected.postcode,
    ].join(" ");
  }, [detail, selected]);

  useEffect(() => {
    if (composed !== value) onChange(composed);
    // We only want to fire when the composed string changes, not the parent's
    // value (which would loop). onChange is allowed to be unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composed]);

  return (
    <View className="mt-3 gap-2">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        ที่อยู่
      </Text>

      {/* Postcode field */}
      <View>
        <Text className="mb-1 text-[12px] text-muted">รหัสไปรษณีย์ 5 หลัก</Text>
        <TextInput
          value={postcode}
          onChangeText={(v) => setPostcode(v.replace(/[^\d]/g, "").slice(0, 5))}
          placeholder="เช่น 10110"
          keyboardType="number-pad"
          maxLength={5}
          className="rounded-2xl border border-border bg-soft px-3 py-2.5 text-[14px] text-fg"
        />
      </View>

      {/* Subdistrict / district / province picker */}
      {loading ? (
        <View className="py-3">
          <ActivityIndicator color="#e11d48" />
        </View>
      ) : options.length > 0 ? (
        <View className="gap-1.5">
          <Text className="text-[12px] text-muted">
            เลือกตำบล/อำเภอ/จังหวัด
          </Text>
          <View className="max-h-56 gap-1.5">
            {options.map((opt) => {
              const isSelected = selected?.key === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setSelected(opt)}
                  className={`rounded-2xl border px-3 py-2 ${
                    isSelected
                      ? "border-brand-300 bg-brand-50"
                      : "border-border bg-white"
                  }`}
                >
                  <Text
                    className={`text-[13px] ${
                      isSelected ? "font-semibold text-brand-700" : "text-fg"
                    }`}
                  >
                    ต.{opt.subdistrict} · อ.{opt.district}
                  </Text>
                  <Text className="text-[11px] text-muted">
                    จ.{opt.province} {opt.postcode}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : postcode.length === 5 ? (
        <Text className="text-[12px] text-rose-600">
          ไม่พบที่อยู่สำหรับรหัสไปรษณีย์นี้ — โปรดตรวจสอบ
        </Text>
      ) : null}

      {/* Free-form building / street detail */}
      {selected ? (
        <View>
          <Text className="mb-1 text-[12px] text-muted">
            บ้านเลขที่ / ถนน / รายละเอียดเพิ่มเติม
          </Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="เช่น 123/4 ซ.สุขุมวิท 21 ถ.อโศกมนตรี"
            multiline
            className="rounded-2xl border border-border bg-soft px-3 py-2.5 text-[14px] text-fg"
            style={{ minHeight: 60 }}
          />
        </View>
      ) : null}

      {composed ? (
        <View className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <Text className="text-[11px] font-semibold text-emerald-700">
            ✓ ที่อยู่จัดส่ง
          </Text>
          <Text className="mt-1 text-[12px] leading-relaxed text-emerald-900">
            {composed}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
