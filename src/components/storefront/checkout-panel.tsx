"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  Clock,
  MapPin,
  Minus,
  Plus,
  PlusCircle,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Ticket,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getLineIdTokenIfAvailable } from "@/lib/line-liff-client";

interface Props {
  shopSlug: string;
  product: {
    slug: string;
    name: string;
    priceBaht: number;
    type: "PHYSICAL" | "DIGITAL";
    stock?: number | null;
    image?: string | null;
    shippingFeeBaht?: number;
  };
}

interface CheckoutItem {
  productSlug: string;
  name: string;
  priceBaht: number;
  type: "PHYSICAL" | "DIGITAL";
  stock?: number | null;
  image?: string | null;
  qty: number;
  shippingFeeBaht?: number;
}

interface AddressSuggestion {
  id: string;
  source: "local" | "server" | "line";
  label?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  address: string;
  postcode?: string | null;
  useCount?: number;
  lastUsedAt?: string;
}

interface ThaiAddressOption {
  key: string;
  postcode: string;
  subdistrict: string;
  district: string;
  province: string;
}

interface CheckoutProfileResponse {
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  } | null;
  addresses?: Array<Omit<AddressSuggestion, "source">>;
}

export function CheckoutPanel({ shopSlug, product }: Props) {
  const t = useTranslations("order.checkout");
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"single" | "cart">("single");
  const [cartItems, setCartItems] = useState<CheckoutItem[]>([]);

  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{
    code: string;
    discountBaht: number;
  } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const [loyalty, setLoyalty] = useState<{
    points: number;
    bahtValuePerPoint: number;
  } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [postcode, setPostcode] = useState("");
  const [addressOptions, setAddressOptions] = useState<ThaiAddressOption[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [selectedThaiAddress, setSelectedThaiAddress] =
    useState<ThaiAddressOption | null>(null);
  const [addressDetail, setAddressDetail] = useState("");
  const addressDetailRef = useRef("");
  const linePrefillAttempted = useRef(false);
  const fieldValuesRef = useRef({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const singleItem: CheckoutItem = {
    productSlug: product.slug,
    name: product.name,
    priceBaht: product.priceBaht,
    type: product.type,
    stock: product.stock,
    image: product.image,
    qty,
    shippingFeeBaht: product.shippingFeeBaht ?? 0,
  };
  const checkoutItems = checkoutMode === "cart" ? cartItems : [singleItem];
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.priceBaht * item.qty,
    0,
  );
  // V2.1 per-shop shipping = max() across line items, 0 for DIGITAL-only.
  // Server re-derives at order POST so this is display-only.
  const shipping = checkoutItems.reduce((max, item) => {
    if (item.type === "DIGITAL") return max;
    return Math.max(max, item.shippingFeeBaht ?? 0);
  }, 0);
  const couponDiscount = couponApplied?.discountBaht ?? 0;
  const pointsDiscount =
    redeemPoints * (loyalty?.bahtValuePerPoint ?? 0);
  const total = Math.max(0, subtotal + shipping - couponDiscount - pointsDiscount);
  const needsAddress = checkoutItems.some((item) => item.type === "PHYSICAL");
  const soldOut = product.stock === 0;
  const cartCount = countCartItems(cartItems);
  const cartTotal = totalCartBaht(cartItems);
  const cartInvalid = checkoutMode === "cart" && cartItems.length === 0;
  const cleanPhone = normalizePhoneForCheckout(phone);
  const phoneReady = cleanPhone.length >= 9;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCartItems(readCart(shopSlug));
    });
    return () => {
      cancelled = true;
    };
  }, [shopSlug]);

  useEffect(() => {
    fieldValuesRef.current = { name, phone, email, address };
  }, [address, email, name, phone]);

  useEffect(() => {
    if (!expanded || linePrefillAttempted.current) return;

    let cancelled = false;
    linePrefillAttempted.current = true;

    async function prefillFromLine() {
      let lineIdToken: string | null = null;
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        lineIdToken = await getLineIdTokenIfAvailable().catch(() => null);
        if (lineIdToken) break;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
      if (cancelled || !lineIdToken) return;

      const res = await fetch(
        `/api/v1/shops/${encodeURIComponent(shopSlug)}/checkout-profile`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken: lineIdToken }),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: CheckoutProfileResponse }
        | null;
      if (cancelled || !res.ok || !json?.ok || !json.data) return;

      const customer = json.data.customer;
      const lineAddresses = (json.data.addresses ?? []).map((item) => ({
        ...item,
        source: "line" as const,
      }));
      const primaryAddress = customer?.address || lineAddresses[0]?.address || "";

      if (!fieldValuesRef.current.phone.trim() && customer?.phone) {
        setPhone(customer.phone);
      }
      if (!fieldValuesRef.current.name.trim() && customer?.name) {
        setName(customer.name);
      }
      if (!fieldValuesRef.current.email.trim() && customer?.email) {
        setEmail(customer.email);
      }
      if (needsAddress && !fieldValuesRef.current.address.trim() && primaryAddress) {
        setAddress(primaryAddress);
        setPostcode(extractPostcodeFromAddress(primaryAddress));
        addressDetailRef.current = "";
        setAddressDetail("");
        setAddressOptions([]);
        setSelectedThaiAddress(null);
      }
      if (lineAddresses.length > 0) {
        setAddressSuggestions((current) =>
          mergeAddressSuggestions([...lineAddresses, ...current]).slice(0, 3),
        );
      }
    }

    void prefillFromLine();

    return () => {
      cancelled = true;
    };
  }, [expanded, needsAddress, shopSlug]);

  // Look up loyalty wallet when phone has 9+ digits
  useEffect(() => {
    const cleanPhone = phone.replace(/[^\d]/g, "");
    if (cleanPhone.length < 9) {
      queueMicrotask(() => {
        setLoyalty(null);
        setRedeemPoints(0);
      });
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/shops/${shopSlug}/loyalty/${cleanPhone}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        if (json.data.points > 0 && json.data.config.bahtValuePerPoint > 0) {
          setLoyalty({
            points: json.data.points,
            bahtValuePerPoint: json.data.config.bahtValuePerPoint,
          });
        } else {
          setLoyalty(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phone, shopSlug]);

  useEffect(() => {
    if (!needsAddress) return;
    if (!phoneReady) {
      queueMicrotask(() => {
        setAddressSuggestions([]);
        setAddressLoading(false);
      });
      return;
    }

    let cancelled = false;
    const local = readLocalAddresses(shopSlug, cleanPhone);
    queueMicrotask(() => {
      if (cancelled) return;
      setAddressSuggestions(local);
      setAddressLoading(true);
    });

    fetch(`/api/v1/shops/${shopSlug}/addresses/${cleanPhone}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        const remote = (json.data.addresses as AddressSuggestion[]).map((item) => ({
          ...item,
          source: "server" as const,
        }));
        setAddressSuggestions(mergeAddressSuggestions([...local, ...remote]));
      })
      .catch(() => {
        if (!cancelled) setAddressSuggestions(local);
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cleanPhone, needsAddress, phoneReady, shopSlug]);

  useEffect(() => {
    if (!needsAddress) return;
    let cancelled = false;

    if (postcode.length !== 5) {
      queueMicrotask(() => {
        if (cancelled) return;
        setAddressOptions([]);
        setAddressLookupLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!cancelled) setAddressLookupLoading(true);
    });

    fetch(`/api/v1/thai-address?postcode=${encodeURIComponent(postcode)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.ok) return;
        const options = (json.data.options as ThaiAddressOption[]) ?? [];
        setAddressOptions(options);
        if (options.length === 1) {
          setSelectedThaiAddress(options[0]);
          setAddress(composeThaiAddress(addressDetailRef.current, options[0]));
        }
      })
      .catch(() => {
        if (!cancelled) setAddressOptions([]);
      })
      .finally(() => {
        if (!cancelled) setAddressLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [needsAddress, postcode]);

  function setStructuredAddressDetail(value: string) {
    addressDetailRef.current = value;
    setAddressDetail(value);
    setAddress(composeThaiAddress(value, selectedThaiAddress));
  }

  function selectThaiAddress(option: ThaiAddressOption) {
    setSelectedThaiAddress(option);
    setAddress(composeThaiAddress(addressDetail, option));
  }

  function resetStructuredAddress() {
    setAddress("");
    setPostcode("");
    addressDetailRef.current = "";
    setAddressDetail("");
    setAddressOptions([]);
    setSelectedThaiAddress(null);
  }

  function persistCart(items: CheckoutItem[]) {
    const normalized = normalizeCartItems(items);
    setCartItems(normalized);
    writeCart(shopSlug, normalized);
    return normalized;
  }

  function addCurrentProductToCart() {
    if (soldOut) {
      toast.error("สินค้าหมดสต๊อก");
      return;
    }

    const next = persistCart([
      ...cartItems,
      {
        productSlug: product.slug,
        name: product.name,
        priceBaht: product.priceBaht,
        type: product.type,
        stock: product.stock,
        image: product.image,
        qty: 1,
        shippingFeeBaht: product.shippingFeeBaht ?? 0,
      },
    ]);
    const item = next.find((cartItem) => cartItem.productSlug === product.slug);
    toast.success("ใส่ตะกร้าแล้ว", {
      description: `${product.name} x ${item?.qty ?? 1}`,
    });
  }

  function updateCartQty(productSlug: string, nextQty: number) {
    persistCart(
      cartItems.map((item) =>
        item.productSlug === productSlug
          ? { ...item, qty: nextQty }
          : item,
      ),
    );
  }

  function removeCartItem(productSlug: string) {
    persistCart(cartItems.filter((item) => item.productSlug !== productSlug));
  }

  function openSingleCheckout() {
    setCheckoutMode("single");
    setExpanded(true);
  }

  function openCartCheckout() {
    const next =
      cartItems.length > 0
        ? cartItems
        : persistCart([
            {
              productSlug: product.slug,
              name: product.name,
              priceBaht: product.priceBaht,
              type: product.type,
              stock: product.stock,
              image: product.image,
              qty: 1,
            },
          ]);
    if (next.length === 0) return;
    setCheckoutMode("cart");
    setExpanded(true);
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponChecking(true);
    try {
      const res = await fetch(`/api/v1/shops/${shopSlug}/coupons/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotalSatang: subtotal * 100,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error?.message ?? "ใช้คูปองไม่ได้");
        setCouponApplied(null);
        return;
      }
      setCouponApplied({
        code: json.data.code,
        discountBaht: Math.round(json.data.discountSatang / 100),
      });
      toast.success(
        `ใช้คูปอง ${json.data.code.toUpperCase()} แล้ว — ลด ฿${Math.round(json.data.discountSatang / 100).toLocaleString()}`,
      );
    } finally {
      setCouponChecking(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (cartInvalid) return toast.error("ยังไม่มีสินค้าในตะกร้า");
    if (checkoutMode === "single" && soldOut) return toast.error("สินค้าหมดสต๊อก");
    const unavailableItem = checkoutItems.find(
      (item) => item.stock !== null && item.stock !== undefined && item.stock < item.qty,
    );
    if (unavailableItem) {
      return toast.error(`${unavailableItem.name}: สต๊อกไม่พอ`);
    }
    if (!name.trim()) return toast.error(t("errors.nameRequired"));
    if (!phone.trim()) return toast.error(t("errors.phoneRequired"));
    if (needsAddress && !address.trim())
      return toast.error(t("errors.addressRequired"));

    startTransition(async () => {
      try {
        const lineIdToken = await getLineIdTokenIfAvailable().catch(() => null);
        const res = await createOrder(lineIdToken);
        let json = await res.json();

        if (
          lineIdToken &&
          !res.ok &&
          json.error?.code === "line_login_invalid"
        ) {
          const retry = await createOrder(null);
          json = await retry.json();
          if (!retry.ok || !json.ok) {
            toast.error(t("errors.createFailed"), {
              description: json.error?.message,
            });
            return;
          }
        } else if (!res.ok || !json.ok) {
          toast.error(t("errors.createFailed"), {
            description: json.error?.message,
          });
          return;
        }

        rememberLocalAddress(shopSlug, cleanPhone, {
          id: `local-${Date.now()}`,
          source: "local",
          customerName: name.trim(),
          customerEmail: email.trim() || null,
          address: address.trim(),
          label: makeAddressPreview(address.trim()),
          lastUsedAt: new Date().toISOString(),
        });
        if (checkoutMode === "cart") {
          persistCart([]);
        }
        window.location.assign(`/o/${json.data.token}`);
      } catch (e) {
        toast.error(t("errors.createFailed"), {
          description: e instanceof Error ? e.message : "network error",
        });
      }
    });

    function createOrder(lineIdToken: string | null) {
      return fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shopSlug,
          items: checkoutItems.map((item) => ({
            productSlug: item.productSlug,
            qty: item.qty,
          })),
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim() || undefined,
          customerAddress: needsAddress ? address.trim() : undefined,
          notes: notes.trim() || undefined,
          couponCode: couponApplied?.code,
          redeemPoints: redeemPoints > 0 ? redeemPoints : undefined,
          lineIdToken: lineIdToken ?? undefined,
        }),
      });
    }
  }

  if (!expanded) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-2">
          <button
            type="button"
            onClick={openSingleCheckout}
            disabled={soldOut}
            className={cn(
              "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.99]",
              soldOut
                ? "cursor-not-allowed bg-zinc-300 shadow-none"
                : "bg-[color:var(--color-brand-600)] shadow-rose-200 hover:scale-[1.01]",
            )}
          >
            <ShoppingBag className="size-5" />{" "}
            {soldOut
              ? "สินค้าหมด"
              : `${t("buyNow")} · ฿${product.priceBaht.toLocaleString()}`}
          </button>
          <button
            type="button"
            onClick={addCurrentProductToCart}
            disabled={soldOut}
            aria-label="ใส่ตะกร้า"
            title="ใส่ตะกร้า"
            className={cn(
              "relative grid min-h-14 place-items-center rounded-2xl border bg-white text-[color:var(--color-brand-700)] shadow-sm transition active:scale-[0.99]",
              soldOut
                ? "cursor-not-allowed border-zinc-200 text-zinc-300"
                : "border-[color:var(--color-brand-200)] hover:bg-[color:var(--color-brand-50)]",
            )}
          >
            <ShoppingCart className="size-5" />
            {cartCount > 0 ? (
              <span className="absolute right-2 top-2 grid min-w-5 place-items-center rounded-full bg-[color:var(--color-brand-600)] px-1 text-[10px] font-bold leading-5 text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </button>
        </div>
        {cartCount > 0 ? (
          <button
            type="button"
            onClick={openCartCheckout}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--color-brand-200)] bg-white px-4 text-left shadow-sm active:scale-[0.99]"
          >
            <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-900">
              <ShoppingCart className="size-4 shrink-0 text-[color:var(--color-brand-600)]" />
              <span className="truncate">ตะกร้า {cartCount} ชิ้น</span>
            </span>
            <span className="shrink-0 text-sm font-bold text-[color:var(--color-brand-700)]">
              ฿{cartTotal.toLocaleString()}
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-[color:var(--color-brand-200)] bg-white p-5 shadow-xl shadow-rose-100/40 sm:p-6"
    >
      <h2 className="font-display flex items-center gap-2 text-lg font-bold">
        <Sparkles className="size-4 text-[color:var(--color-brand-600)]" />
        {checkoutMode === "cart" ? "สั่งซื้อจากตะกร้า" : t("title")}
      </h2>
      <p className="mt-1 text-[13px] text-zinc-500">{t("subtitle")}</p>

      {checkoutMode === "cart" ? (
        <CartItemsEditor
          items={cartItems}
          onQtyChange={updateCartQty}
          onRemove={removeCartItem}
          onBackToBuyNow={() => {
            setCheckoutMode("single");
            if (cartItems.length === 0) setExpanded(false);
          }}
        />
      ) : (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm font-medium">{t("qty")}</span>
          <QuantityStepper
            value={qty}
            min={1}
            max={maxQty(product.stock)}
            onChange={setQty}
          />
        </div>
      )}

      <div className="mt-4 space-y-3">
        <FieldInput
          label={t("phone")}
          placeholder={t("phonePlaceholder")}
          value={phone}
          onChange={setPhone}
          required
          autoComplete="tel"
          inputMode="numeric"
        />
        {needsAddress ? (
          <AddressMemory
            phoneReady={phoneReady}
            loading={addressLoading}
            suggestions={addressSuggestions}
            selectedAddress={address}
            onUse={(suggestion) => {
              setAddress(suggestion.address);
              setPostcode(suggestion.postcode ?? extractPostcodeFromAddress(suggestion.address));
              addressDetailRef.current = "";
              setAddressDetail("");
              setAddressOptions([]);
              setSelectedThaiAddress(null);
              if (!name.trim() && suggestion.customerName) {
                setName(suggestion.customerName);
              }
              if (!email.trim() && suggestion.customerEmail) {
                setEmail(suggestion.customerEmail);
              }
            }}
            onNew={resetStructuredAddress}
          />
        ) : null}
        <FieldInput
          label={t("name")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={setName}
          required
          autoComplete="name"
        />
        <FieldInput
          label={t("email")}
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          type="email"
          autoComplete="email"
        />
        {needsAddress ? (
          <ThaiAddressPicker
            label={t("address")}
            postcode={postcode}
            selectedAddress={address}
            selectedThaiAddress={selectedThaiAddress}
            addressDetail={addressDetail}
            options={addressOptions}
            loading={addressLookupLoading}
            onPostcodeChange={(value) => {
              const clean = value.replace(/[^\d]/g, "").slice(0, 5);
              setPostcode(clean);
              setAddressOptions([]);
              setSelectedThaiAddress(null);
              setAddress("");
            }}
            onSelect={selectThaiAddress}
            onDetailChange={setStructuredAddressDetail}
            onClear={resetStructuredAddress}
          />
        ) : null}
        <Field label={t("notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
            className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
          />
        </Field>
      </div>

      {/* Coupon */}
      <div className="mt-5">
        <label className="mb-1 block text-[13px] font-medium">
          <Ticket className="mr-1 inline-block size-3.5 -translate-y-0.5 text-[color:var(--color-brand-600)]" />
          รหัสคูปอง (ถ้ามี)
        </label>
        {couponApplied ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700 ring-1 ring-emerald-200">
            <span className="font-mono font-semibold uppercase">
              {couponApplied.code} · -฿
              {couponApplied.discountBaht.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => {
                setCouponApplied(null);
                setCouponCode("");
              }}
              className="text-[11px] font-medium text-emerald-700 underline"
            >
              เอาออก
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(e) =>
                setCouponCode(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))
              }
              placeholder="WELCOME10"
              className="font-mono uppercase"
              maxLength={40}
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={couponChecking || !couponCode.trim()}
              className={cn(
                "shrink-0 rounded-xl border border-[color:var(--color-border)] bg-white px-3 text-[13px] font-medium",
                couponChecking || !couponCode.trim()
                  ? "text-zinc-300"
                  : "text-[color:var(--color-brand-700)] hover:bg-[color:var(--color-brand-50)]",
              )}
            >
              {couponChecking ? "..." : "ใช้"}
            </button>
          </div>
        )}
      </div>

      {/* Loyalty points redemption */}
      {loyalty && loyalty.points > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] ring-1 ring-amber-200">
          <p className="font-medium text-amber-800">
            คุณมี {loyalty.points.toLocaleString()} คะแนนสะสม
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={Math.min(
                loyalty.points,
                Math.floor((subtotal - couponDiscount) / loyalty.bahtValuePerPoint),
              )}
              value={redeemPoints}
              onChange={(e) => setRedeemPoints(Number(e.target.value))}
              className="flex-1 accent-amber-600"
            />
            <span className="w-20 text-right text-[12px] font-semibold text-amber-800">
              ใช้ {redeemPoints} = ฿
              {(redeemPoints * loyalty.bahtValuePerPoint).toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      <dl className="mt-5 space-y-1.5 rounded-2xl bg-[color:var(--color-soft)] px-4 py-3 text-sm">
        <Row label={t("subtotal")} value={`฿${subtotal.toLocaleString()}`} />
        {shipping > 0 ? (
          <Row label={t("shipping")} value={`฿${shipping.toLocaleString()}`} />
        ) : null}
        {couponDiscount > 0 ? (
          <Row
            label={`คูปอง ${couponApplied?.code.toUpperCase() ?? ""}`}
            value={`-฿${couponDiscount.toLocaleString()}`}
          />
        ) : null}
        {pointsDiscount > 0 ? (
          <Row
            label={`คะแนน ${redeemPoints}`}
            value={`-฿${pointsDiscount.toLocaleString()}`}
          />
        ) : null}
        <Row
          label={t("total")}
          value={`฿${total.toLocaleString()}`}
          highlight
        />
      </dl>

      <Button
        type="submit"
        size="lg"
        className="mt-5 w-full"
        loading={pending}
        disabled={pending || soldOut}
      >
        {soldOut ? "สินค้าหมด" : t("submit")}
      </Button>
    </form>
  );
}

function CartItemsEditor({
  items,
  onQtyChange,
  onRemove,
  onBackToBuyNow,
}: {
  items: CheckoutItem[];
  onQtyChange: (productSlug: string, qty: number) => void;
  onRemove: (productSlug: string) => void;
  onBackToBuyNow: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] p-4 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-900">ตะกร้ายังว่าง</p>
        <button
          type="button"
          onClick={onBackToBuyNow}
          className="mt-3 min-h-10 rounded-xl bg-white px-3 text-xs font-bold text-[color:var(--color-brand-700)] ring-1 ring-[color:var(--color-border)]"
        >
          กลับไปซื้อสินค้านี้
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2 rounded-2xl border border-[color:var(--color-border)] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-zinc-900">
          <ShoppingCart className="size-4 text-[color:var(--color-brand-600)]" />
          รายการในตะกร้า
        </p>
        <button
          type="button"
          onClick={onBackToBuyNow}
          className="min-h-9 rounded-xl px-3 text-xs font-semibold text-zinc-600 ring-1 ring-[color:var(--color-border)]"
        >
          ซื้อชิ้นนี้
        </button>
      </div>
      <div className="divide-y divide-[color:var(--color-border)]">
        {items.map((item) => (
          <div key={item.productSlug} className="flex gap-3 py-3 first:pt-2 last:pb-1">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-zinc-100">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="size-full object-cover" />
              ) : (
                <ShoppingBag className="size-5 text-zinc-400" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-900">{item.name}</p>
                  <p className="text-xs font-semibold text-[color:var(--color-brand-700)]">
                    ฿{item.priceBaht.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.productSlug)}
                  aria-label={`ลบ ${item.name} ออกจากตะกร้า`}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-500">
                  {item.type === "DIGITAL" ? "DIGITAL" : "PHYSICAL"}
                </span>
                <QuantityStepper
                  value={item.qty}
                  min={1}
                  max={maxQty(item.stock)}
                  onChange={(qty) => onQtyChange(item.productSlug, qty)}
                  compact
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuantityStepper({
  value,
  min,
  max,
  onChange,
  compact = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const nextDown = Math.max(min, value - 1);
  const nextUp = Math.min(max, value + 1);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white",
        compact && "gap-1",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(nextDown)}
        disabled={value <= min}
        className={cn(
          "grid place-items-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)] disabled:text-zinc-300",
          compact ? "size-8" : "size-9",
        )}
      >
        <Minus className="size-4" />
      </button>
      <span
        className={cn(
          "text-center text-sm font-semibold",
          compact ? "w-7" : "w-8",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(nextUp)}
        disabled={value >= max}
        className={cn(
          "grid place-items-center rounded-full text-zinc-700 hover:bg-[color:var(--color-soft)] disabled:text-zinc-300",
          compact ? "size-8" : "size-9",
        )}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function AddressMemory({
  phoneReady,
  loading,
  suggestions,
  selectedAddress,
  onUse,
  onNew,
}: {
  phoneReady: boolean;
  loading: boolean;
  suggestions: AddressSuggestion[];
  selectedAddress: string;
  onUse: (suggestion: AddressSuggestion) => void;
  onNew: () => void;
}) {
  if (!phoneReady) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] px-3.5 py-3 text-[13px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800">
          <MapPin className="size-4 text-[color:var(--color-brand-600)]" />
          ใส่เบอร์โทรก่อน
        </span>
        <p className="mt-1 leading-relaxed">
          ถ้าเคยสั่งร้านนี้ ระบบจะแสดงที่อยู่เดิมให้กดใช้ได้ทันที
        </p>
      </div>
    );
  }

  if (loading && suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white px-3.5 py-3 text-[13px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4 animate-pulse text-[color:var(--color-brand-600)]" />
          กำลังเช็คที่อยู่เดิม...
        </span>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-white px-3.5 py-3 text-[13px] text-zinc-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800">
          <PlusCircle className="size-4 text-[color:var(--color-brand-600)]" />
          ยังไม่มีที่อยู่เดิม
        </span>
        <p className="mt-1 leading-relaxed">
          ใส่ที่อยู่ครั้งนี้ ครั้งหน้าจะกดใช้ซ้ำได้เลย
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-[color:var(--color-brand-200)] bg-[color:var(--color-brand-50)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--color-brand-800)]">
          <MapPin className="size-4" />
          ที่อยู่ที่เคยใช้ในร้านนี้
        </p>
        <button
          type="button"
          onClick={onNew}
          className="min-h-9 rounded-xl bg-white px-3 text-[12px] font-semibold text-zinc-700 ring-1 ring-[color:var(--color-border)]"
        >
          ใส่ใหม่
        </button>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const selected =
            selectedAddress.trim() &&
            normalizeText(selectedAddress) === normalizeText(suggestion.address);
          return (
            <button
              key={`${suggestion.source}-${suggestion.id}`}
              type="button"
              onClick={() => onUse(suggestion)}
              className={cn(
                "min-h-16 w-full rounded-2xl bg-white px-3.5 py-3 text-left text-[13px] ring-1 transition active:scale-[0.99]",
                selected
                  ? "ring-[color:var(--color-brand-500)]"
                  : "ring-[color:var(--color-border)]",
              )}
            >
              <span className="block font-semibold text-zinc-900">
                {suggestion.customerName || suggestion.label || "ที่อยู่เดิม"}
              </span>
              <span className="mt-0.5 line-clamp-2 block leading-relaxed text-zinc-600">
                {suggestion.address}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThaiAddressPicker({
  label,
  postcode,
  selectedAddress,
  selectedThaiAddress,
  addressDetail,
  options,
  loading,
  onPostcodeChange,
  onSelect,
  onDetailChange,
  onClear,
}: {
  label: string;
  postcode: string;
  selectedAddress: string;
  selectedThaiAddress: ThaiAddressOption | null;
  addressDetail: string;
  options: ThaiAddressOption[];
  loading: boolean;
  onPostcodeChange: (value: string) => void;
  onSelect: (option: ThaiAddressOption) => void;
  onDetailChange: (value: string) => void;
  onClear: () => void;
}) {
  const hasSavedAddress =
    selectedAddress.trim() && !addressDetail.trim() && !selectedThaiAddress;

  return (
    <div className="space-y-3 rounded-3xl border border-[color:var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-zinc-900">{label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            เริ่มจากรหัสไปรษณีย์ แล้วเลือกตำบล/อำเภอ ระบบจะเติมจังหวัดให้เอง
          </p>
        </div>
        {selectedAddress ? (
          <button
            type="button"
            onClick={onClear}
            className="min-h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-zinc-600 ring-1 ring-[color:var(--color-border)]"
          >
            เปลี่ยน
          </button>
        ) : null}
      </div>

      {hasSavedAddress ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[13px]">
          <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
            <Check className="size-4" />
            ใช้ที่อยู่เดิมแล้ว
          </span>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-emerald-900">
            {selectedAddress}
          </p>
        </div>
      ) : (
        <>
          <FieldInput
            label="รหัสไปรษณีย์"
            placeholder="เช่น 10110"
            value={postcode}
            onChange={onPostcodeChange}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            required
          />

          {postcode.length === 5 ? (
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-zinc-600">
                เลือกตำบล/อำเภอ
              </p>
              {loading ? (
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-soft)] px-3.5 py-3 text-[13px] text-zinc-600">
                  <Clock className="mr-1 inline-block size-4 animate-pulse text-[color:var(--color-brand-600)]" />
                  กำลังค้นหาพื้นที่จากรหัสไปรษณีย์...
                </div>
              ) : options.length > 0 ? (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {options.map((option) => {
                    const selected =
                      selectedThaiAddress?.key === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => onSelect(option)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 text-left ring-1 transition active:scale-[0.99]",
                          selected
                            ? "ring-[color:var(--color-brand-500)]"
                            : "ring-[color:var(--color-border)]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-full border",
                            selected
                              ? "border-[color:var(--color-brand-500)] bg-[color:var(--color-brand-600)] text-white"
                              : "border-zinc-200 bg-zinc-50 text-transparent",
                          )}
                        >
                          <Check className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-zinc-900">
                            {option.subdistrict}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {option.district}, {option.province} {option.postcode}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-800">
                  ยังไม่พบพื้นที่ของรหัสนี้ ลองตรวจรหัสไปรษณีย์อีกครั้ง
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-soft)] px-3.5 py-3 text-[13px] text-zinc-600">
              ใส่รหัสไปรษณีย์ 5 หลักก่อน ระบบจะจำกัดตัวเลือกให้อัตโนมัติ
            </div>
          )}

          <Field label="บ้านเลขที่ / หมู่บ้าน / ถนน">
            <textarea
              required
              value={addressDetail}
              onChange={(e) => onDetailChange(e.target.value)}
              placeholder="เช่น 99/9 หมู่บ้าน..., ซอย..., ถนน..."
              rows={3}
              className="w-full resize-y rounded-xl border border-[color:var(--color-border)] bg-white p-3 text-[15px] outline-none focus:border-[color:var(--color-brand-400)] focus:ring-2 focus:ring-[color:var(--color-brand-100)]"
            />
          </Field>

          {selectedAddress ? (
            <div className="rounded-2xl bg-[color:var(--color-soft)] px-3.5 py-3 text-[13px] text-zinc-700">
              <span className="font-semibold text-zinc-900">ที่อยู่จัดส่ง</span>
              <p className="mt-1 whitespace-pre-line leading-relaxed">
                {selectedAddress}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium">{label}</label>
      {children}
    </div>
  );
}

function FieldInput({
  label,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const { onChange, value, ...inputProps } = rest;
  return (
    <Field label={label}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
    </Field>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between",
        highlight && "border-t border-[color:var(--color-border)] pt-1.5",
      )}
    >
      <dt className="text-zinc-600">{label}</dt>
      <dd
        className={cn(
          "font-semibold",
          highlight && "text-[color:var(--color-brand-700)] text-lg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function maxQty(stock?: number | null) {
  if (stock === null || stock === undefined) return 99;
  return Math.max(1, Math.min(99, stock));
}

function cartStorageKey(shopSlug: string) {
  return `salepage:cart:${shopSlug}`;
}

function readCart(shopSlug: string): CheckoutItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cartStorageKey(shopSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CheckoutItem[];
    if (!Array.isArray(parsed)) return [];
    return normalizeCartItems(parsed);
  } catch {
    return [];
  }
}

function writeCart(shopSlug: string, items: CheckoutItem[]) {
  if (typeof window === "undefined") return;
  const normalized = normalizeCartItems(items);
  if (normalized.length === 0) {
    window.localStorage.removeItem(cartStorageKey(shopSlug));
    return;
  }
  window.localStorage.setItem(cartStorageKey(shopSlug), JSON.stringify(normalized));
}

function normalizeCartItems(items: CheckoutItem[]) {
  const map = new Map<string, CheckoutItem>();
  for (const item of items) {
    if (!item?.productSlug || !item.name || item.priceBaht <= 0) continue;
    if (item.stock === 0) continue;
    const current = map.get(item.productSlug);
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const stockMax = maxQty(item.stock);
    map.set(item.productSlug, {
      productSlug: item.productSlug,
      name: item.name,
      priceBaht: item.priceBaht,
      type: item.type === "DIGITAL" ? "DIGITAL" : "PHYSICAL",
      stock: item.stock ?? null,
      image: item.image ?? null,
      qty: Math.min(stockMax, (current?.qty ?? 0) + qty),
      shippingFeeBaht: item.shippingFeeBaht ?? 0,
    });
  }
  return Array.from(map.values()).slice(0, 20);
}

function countCartItems(items: CheckoutItem[]) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

function totalCartBaht(items: CheckoutItem[]) {
  return items.reduce((sum, item) => sum + item.priceBaht * item.qty, 0);
}

function normalizePhoneForCheckout(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.startsWith("66") && digits.length === 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function composeThaiAddress(detail: string, option: ThaiAddressOption | null) {
  const cleanDetail = detail.replace(/\s+/g, " ").trim();
  if (!cleanDetail || !option) return "";
  return [
    cleanDetail,
    `${option.subdistrict} ${option.district} ${option.province} ${option.postcode}`,
  ].join("\n");
}

function extractPostcodeFromAddress(address: string) {
  return address.match(/\b\d{5}\b/)?.[0] ?? "";
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function makeAddressPreview(address: string) {
  const clean = normalizeText(address);
  if (clean.length <= 48) return clean;
  return `${clean.slice(0, 45).trim()}...`;
}

function addressStorageKey(shopSlug: string, cleanPhone: string) {
  return `salepage:checkout-addresses:${shopSlug}:${cleanPhone}`;
}

function readLocalAddresses(shopSlug: string, cleanPhone: string): AddressSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(addressStorageKey(shopSlug, cleanPhone));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AddressSuggestion[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.address && typeof item.address === "string")
      .slice(0, 3)
      .map((item, index) => ({
        ...item,
        id: item.id || `local-${index}`,
        source: "local" as const,
      }));
  } catch {
    return [];
  }
}

function rememberLocalAddress(
  shopSlug: string,
  cleanPhone: string,
  suggestion: AddressSuggestion,
) {
  if (typeof window === "undefined" || cleanPhone.length < 9 || !suggestion.address) {
    return;
  }
  const current = readLocalAddresses(shopSlug, cleanPhone);
  const merged = mergeAddressSuggestions([suggestion, ...current]).slice(0, 3);
  window.localStorage.setItem(
    addressStorageKey(shopSlug, cleanPhone),
    JSON.stringify(merged),
  );
}

function mergeAddressSuggestions(suggestions: AddressSuggestion[]) {
  const map = new Map<string, AddressSuggestion>();
  for (const suggestion of suggestions) {
    const key = normalizeText(suggestion.address);
    if (!key) continue;
    const existing = map.get(key);
    map.set(key, {
      ...suggestion,
      customerName: suggestion.customerName ?? existing?.customerName ?? null,
      customerEmail: suggestion.customerEmail ?? existing?.customerEmail ?? null,
      label: suggestion.label ?? existing?.label ?? makeAddressPreview(suggestion.address),
      useCount: suggestion.useCount ?? existing?.useCount,
      lastUsedAt: suggestion.lastUsedAt ?? existing?.lastUsedAt,
    });
  }
  return Array.from(map.values()).slice(0, 3);
}
