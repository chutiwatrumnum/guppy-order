// Types for Guppy Order App

export interface Breed {
  id: string;
  name: string;
  price_piece: number;
  price_pair: number;
  price_set?: number;
  cost_piece?: number;
  cost_pair?: number;
  cost_set?: number;
  premium_cost_piece?: number;
  premium_cost_pair?: number;
  premium_cost_set?: number;
  premium_price_piece?: number;
  premium_price_pair?: number;
  premium_price_set?: number;
}

export type UserRole = 'admin' | 'user';

export type Gender = 'male' | 'female' | 'mixed';

export type OrderItemType = 'piece' | 'pair' | 'set';

export type Grade = 'normal' | 'premium';

export interface OrderItem {
  id: string;
  breedId: string;
  breedName: string;
  type: OrderItemType;
  quantity: number;
  price: number;
  cost?: number;
  grade?: Grade;
  gender: Gender;
  discount?: number;
  freeQty?: number;
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
  customerName?: string;
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

// Dashboard Statistics
export interface DashboardStats {
  totalOrders: number;
  totalSales: number;
  totalFishCost: number;
  totalShippingIncome: number;
  totalShippingCost: number;
  totalFish: number;
  totalFishNormal: number;
  totalFishPremium: number;
  totalProfit: number;
  avgOrderValue: number;
  topBreeds: BreedStat[];
  topCustomers: CustomerStat[];
}

export interface BreedStat {
  name: string;
  qty: number;
  sales: number;
  isPremium?: boolean;
}

export interface CustomerStat {
  name: string;
  orders: number;
  totalSpent: number;
  totalFish: number;
}

// Admin View Type
export type AdminView = 'orders' | 'dashboard' | 'reports';

// Report Period Type
export type ReportPeriod = 'today' | 'week' | 'month' | 'year' | 'custom';

// User type from Auth
export interface User {
  id: string;
  username: string;
  shop_name: string;
  role: UserRole;
  email?: string;
}