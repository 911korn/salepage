/**
 * Central registry of every help topic. Used by the index page (grid of
 * cards), the per-topic page (lookup by slug), and the sidebar nav so all
 * three surfaces stay in sync. Reorder by changing this array — the
 * sidebar + index follow the order here, top-to-bottom.
 */

export interface HelpTopic {
  slug: string;
  title: string;
  /** Short one-line teaser shown on the index page. */
  teaser: string;
  /** Estimated minutes to read + try. Sets reader expectations. */
  minutes: number;
  /** Lucide icon name as a string — the page imports the component so
   *  this stays a typesafe string identifier, not a component reference. */
  icon:
    | "Rocket"
    | "Settings"
    | "ShoppingBag"
    | "Download"
    | "Package"
    | "Truck"
    | "Package2"
    | "Wallet"
    | "ReceiptText"
    | "Ticket"
    | "MessageCircle"
    | "ShieldCheck"
    | "BadgePercent"
    | "AlertCircle"
    | "ChartBar"
    | "Globe";
  /** Topic category — used to group cards on the index page. */
  category: "start" | "products" | "orders" | "shipping" | "money" | "growth";
}

export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    slug: "open-shop",
    title: "เปิดร้านครั้งแรก",
    teaser: "สมัครสมาชิก ตั้งชื่อร้าน ผูก PromptPay — เปิดร้านได้ใน 30 วินาที",
    minutes: 3,
    icon: "Rocket",
    category: "start",
  },
  {
    slug: "shop-settings",
    title: "ตั้งค่าร้าน",
    teaser: "โลโก้ · แบนเนอร์ · สีธีม · ที่อยู่ผู้ส่ง · ช่องทางติดต่อ",
    minutes: 4,
    icon: "Settings",
    category: "start",
  },
  {
    slug: "add-product",
    title: "เพิ่มสินค้าใหม่",
    teaser: "พิมพ์ชื่อ · ใส่ราคา · อัปรูป · เผยแพร่",
    minutes: 3,
    icon: "ShoppingBag",
    category: "products",
  },
  {
    slug: "import-products",
    title: "นำเข้าสินค้าจาก Shopee / Lazada",
    teaser: "วางลิงก์ร้านเดิม → AI ดึงสินค้าทุกชิ้นเข้ามาให้เลย",
    minutes: 3,
    icon: "Download",
    category: "products",
  },
  {
    slug: "manage-orders",
    title: "ดูและจัดการออเดอร์",
    teaser: "ตรวจสลิป · เปลี่ยนสถานะ · แชทกับลูกค้า",
    minutes: 5,
    icon: "Package",
    category: "orders",
  },
  {
    slug: "auto-slip",
    title: "ตรวจสลิปอัตโนมัติ (Auto Slip)",
    teaser: "AI เช็คยอด ผู้รับ และเวลา ภายใน 3 วินาที — เปิดยังไง ใช้ยังไง",
    minutes: 4,
    icon: "ReceiptText",
    category: "orders",
  },
  {
    slug: "print-label-ship",
    title: "พิมพ์ใบปะหน้า + ส่งของ",
    teaser: "พิมพ์ใบปะหน้า · drop ที่ courier ไหนก็ได้ · AI กรอกเลข tracking ให้",
    minutes: 5,
    icon: "Truck",
    category: "shipping",
  },
  {
    slug: "bulk-tracking",
    title: "AI Bulk Tracking — ส่งทีละ 100 ออเดอร์",
    teaser: "ถ่ายใบเสร็จเป็นกอง · AI อ่านทุกใบ จับคู่ออเดอร์อัตโนมัติ",
    minutes: 4,
    icon: "Package2",
    category: "shipping",
  },
  {
    slug: "get-paid",
    title: "รับเงินตรง PromptPay",
    teaser: "เงินจากลูกค้าเข้าบัญชีคุณตรง 100% ไม่ผ่านคนกลาง ไม่หัก%",
    minutes: 3,
    icon: "Wallet",
    category: "money",
  },
  {
    slug: "slip-credits",
    title: "เครดิตตรวจสลิป + โควต้ารายเดือน",
    teaser: "Free/Starter ไม่มีโควต้า ซื้อเครดิตเพิ่มได้ · Pro+ มีให้เลย",
    minutes: 3,
    icon: "ReceiptText",
    category: "money",
  },
  {
    slug: "plans",
    title: "แผน Free / Pro / Business / Agency",
    teaser: "แต่ละแผนได้อะไรบ้าง · อัปเกรดยังไง · ยกเลิกได้เมื่อไหร่",
    minutes: 4,
    icon: "BadgePercent",
    category: "money",
  },
  {
    slug: "coupons",
    title: "คูปองส่วนลด + Loyalty",
    teaser: "ทำคูปองออกแคมเปญ · สะสมแต้มลูกค้าประจำ",
    minutes: 4,
    icon: "Ticket",
    category: "growth",
  },
  {
    slug: "chat",
    title: "แชทกับลูกค้า (Business+)",
    teaser: "รวมแชททุกออเดอร์ในที่เดียว — ตอบจากเดสก์ท็อปหรือมือถือ",
    minutes: 3,
    icon: "MessageCircle",
    category: "growth",
  },
  {
    slug: "analytics",
    title: "Analytics — ดูรายงานยอดขาย",
    teaser: "ยอดวันนี้ · 7 วัน · สินค้าขายดี · ลูกค้าใหม่",
    minutes: 3,
    icon: "ChartBar",
    category: "growth",
  },
  {
    slug: "kyc",
    title: "ยืนยันตัวตน (KYC) สำหรับ Verified Badge",
    teaser: "ส่งบัตรประชาชน + เอกสาร → ได้ป้ายร้านยืนยันแล้ว",
    minutes: 4,
    icon: "ShieldCheck",
    category: "growth",
  },
  {
    slug: "buy-domain",
    title: "ซื้อโดเมนเอง — GoDaddy / Cloudflare / Namecheap",
    teaser: "อยากใช้ mystore.com ไม่ใช่ salepage.in.th/s/... ซื้อโดเมนยังไง · ราคา · เลือก registrar ไหน",
    minutes: 5,
    icon: "Globe",
    category: "growth",
  },
  {
    slug: "refund-dispute",
    title: "ยกเลิก / คืนเงิน / แก้ปัญหากับลูกค้า",
    teaser: "ลูกค้าขอคืน · ของไม่ตรง · ส่งผิด — จัดการยังไง",
    minutes: 4,
    icon: "AlertCircle",
    category: "growth",
  },
];

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.slug === slug);
}

export const CATEGORY_LABELS: Record<HelpTopic["category"], string> = {
  start: "เริ่มต้นใช้งาน",
  products: "สินค้า",
  orders: "ออเดอร์ + ตรวจสลิป",
  shipping: "จัดส่ง",
  money: "เงิน + แผน",
  growth: "ขยายธุรกิจ",
};

export const CATEGORY_ORDER: readonly HelpTopic["category"][] = [
  "start",
  "products",
  "orders",
  "shipping",
  "money",
  "growth",
];
