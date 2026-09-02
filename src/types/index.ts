// Types for บ้านหมีมีปลานะ

export interface Breed {
  id: string;
  name: string;
  premium_price_piece: number;
  premium_price_pair: number;
  premium_price_set?: number;
  premium_cost_piece?: number;
  premium_cost_pair?: number;
  premium_cost_set?: number;
}

// สินค้าอื่นที่ไม่ใช่ปลา เช่น อาหาร (ไม่มีเพศ ไม่มีตัว/คู่/ชุด)
export interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  is_active?: boolean;
}

export type Gender = 'male' | 'female' | 'mixed';

export type OrderItemType = 'piece' | 'pair' | 'set';

export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'deposit' | 'paid';

export interface OrderItem {
  id: string;
  breedId: string;
  breedName: string;
  type: OrderItemType;
  quantity: number;
  price: number;
  cost?: number;
  gender: Gender;
  discount?: number;
  freeQty?: number;
  // 'food' = สินค้าอื่นที่ไม่ใช่ปลา ไม่ถูกนับใน "จำนวนปลา" และแสดงแยก
  // ไม่ระบุ = ปลา (ของเดิม)
  kind?: 'fish' | 'food';
}

// Grouped Order Item for Summary Display
export interface GroupedOrderItem {
  breedId: string;
  breedName: string;
  items: OrderItem[];
  totalQuantity: number;
  totalFishCount: number;
  totalPrice: number;
  totalDiscount: number;
  totalFreeQty: number;
}

// Saved Order History
export interface SavedOrder {
  id: string;
  created_at: string;
  items: OrderItem[];
  totalAmount: number;
  totalFish: number;
  shippingFee?: number;
  actualShippingFee?: number;
  totalCost?: number;
  discount?: number;
  orderNumber?: string;
  publicToken?: string;
  lineUserId?: string | null;
  /** ชื่อที่ตั้งไว้ในบัญชี LINE — ไม่ใช่ชื่อผู้รับ อาจเป็นชื่อเล่นหรือมีอิโมจิ */
  lineDisplayName?: string | null;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
  trackingNumber?: string;
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  note?: string;
}

// Bank/Settings Info
export interface BankInfo {
  id: string | null;
  bank_name: string;
  account_number: string;
  account_name: string;
  shipping_fee: number;
}

// User type from Auth
export interface User {
  id: string;
  username: string;
  shop_name: string;
  role: 'admin' | 'user';
  email?: string;
}

// Customer type
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  points?: number;
  total_orders?: number;
  total_spent?: number;
  created_at: string;
}
