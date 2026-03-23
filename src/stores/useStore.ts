import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { 
  Breed, 
  OrderItem, 
  BankInfo, 
  SavedOrder, 
  GroupedOrderItem,
  Grade,
  Gender
} from '../types';

interface AppState {
  // Data
  breeds: Breed[];
  savedOrders: SavedOrder[];
  allOrders: SavedOrder[];
  bankInfo: BankInfo;
  
  // UI State
  isManagingBreeds: boolean;
  showAdminDashboard: boolean;
  showCart: boolean;
  showOrderHistory: boolean;
  selectedGrade: Grade;
  searchTerm: string;
  
  // Loading States
  loading: boolean;
  isSavingSettings: boolean;
  isSavingOrder: boolean;
  
  // Admin State
  adminView: 'orders' | 'dashboard' | 'reports';
  reportPeriod: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  
  // Editing State
  editingBreed: Breed | null;
  editingOrder: SavedOrder | null;
  isBreedModalOpen: boolean;
  isBankModalOpen: boolean;
  isEditingOrder: boolean;
  
  // Order State
  orderItems: OrderItem[];
  customerName: string;
  orderNote: string;
  
  // Feedback State
  copySuccess: boolean;
  editCopySuccess: boolean;
  
  // Actions
  setBreeds: (breeds: Breed[]) => void;
  setBankInfo: (info: BankInfo) => void;
  setIsManagingBreeds: (value: boolean) => void;
  setShowAdminDashboard: (value: boolean) => void;
  setShowCart: (value: boolean) => void;
  setShowOrderHistory: (value: boolean) => void;
  setSelectedGrade: (grade: Grade) => void;
  setSearchTerm: (term: string) => void;
  setLoading: (loading: boolean) => void;
  setIsSavingSettings: (saving: boolean) => void;
  setIsSavingOrder: (saving: boolean) => void;
  setAdminView: (view: 'orders' | 'dashboard' | 'reports') => void;
  setReportPeriod: (period: 'today' | 'week' | 'month' | 'year' | 'custom') => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setEditingBreed: (breed: Breed | null) => void;
  setEditingOrder: (order: SavedOrder | null) => void;
  setIsBreedModalOpen: (open: boolean) => void;
  setIsBankModalOpen: (open: boolean) => void;
  setIsEditingOrder: (editing: boolean) => void;
  setOrderItems: (items: OrderItem[]) => void;
  setCustomerName: (name: string) => void;
  setOrderNote: (note: string) => void;
  setCopySuccess: (success: boolean) => void;
  setEditCopySuccess: (success: boolean) => void;
  setSavedOrders: (orders: SavedOrder[]) => void;
  setAllOrders: (orders: SavedOrder[]) => void;
  
  // Data Fetching
  fetchData: () => Promise<void>;
  fetchAllOrders: (period?: 'today' | 'week' | 'month' | 'year' | 'custom', customStart?: string, customEnd?: string) => Promise<void>;
  
  // Order Actions
  addToOrder: (breed: Breed, type: 'piece' | 'pair' | 'set', gender: Gender, grade: Grade) => void;
  removeFromOrder: (id: string) => void;
  setItemDiscount: (itemId: string, discount: number) => void;
  setFreeQty: (itemId: string, freeQty: number) => void;
  
  // Breed Actions
  addOrUpdateBreed: (breedData: Partial<Breed>, editingId?: string) => Promise<void>;
  deleteBreed: (id: string) => Promise<void>;
  
  // Settings Actions
  saveSettings: () => Promise<void>;
  
  // Order Management
  saveOrder: (user: { shop_name?: string; username?: string }) => Promise<void>;
  updateOrder: (orderId: string, updatedItems: OrderItem[], updatedCustomerName?: string, updatedNote?: string, updatedActualShippingFee?: number) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial State
  breeds: [],
  savedOrders: [],
  allOrders: [],
  bankInfo: {
    id: null,
    bank_name: 'กสิกรไทย',
    account_number: '',
    account_name: '',
    shipping_fee: 60
  },
  
  isManagingBreeds: false,
  showAdminDashboard: false,
  showCart: false,
  showOrderHistory: false,
  selectedGrade: 'premium',
  searchTerm: '',
  
  loading: true,
  isSavingSettings: false,
  isSavingOrder: false,
  
  adminView: 'orders',
  reportPeriod: 'today',
  startDate: '',
  endDate: '',
  
  editingBreed: null,
  editingOrder: null,
  isBreedModalOpen: false,
  isBankModalOpen: false,
  isEditingOrder: false,
  
  orderItems: [],
  customerName: '',
  orderNote: '',
  
  copySuccess: false,
  editCopySuccess: false,
  
  // Setters
  setBreeds: (breeds) => set({ breeds }),
  setBankInfo: (bankInfo) => set({ bankInfo }),
  setIsManagingBreeds: (isManagingBreeds) => set({ isManagingBreeds }),
  setShowAdminDashboard: (showAdminDashboard) => set({ showAdminDashboard }),
  setShowCart: (showCart) => set({ showCart }),
  setShowOrderHistory: (showOrderHistory) => set({ showOrderHistory }),
  setSelectedGrade: (selectedGrade) => set({ selectedGrade }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setLoading: (loading) => set({ loading }),
  setIsSavingSettings: (isSavingSettings) => set({ isSavingSettings }),
  setIsSavingOrder: (isSavingOrder) => set({ isSavingOrder }),
  setAdminView: (adminView) => set({ adminView }),
  setReportPeriod: (reportPeriod) => set({ reportPeriod }),
  setStartDate: (startDate) => set({ startDate }),
  setEndDate: (endDate) => set({ endDate }),
  setEditingBreed: (editingBreed) => set({ editingBreed }),
  setEditingOrder: (editingOrder) => set({ editingOrder }),
  setIsBreedModalOpen: (isBreedModalOpen) => set({ isBreedModalOpen }),
  setIsBankModalOpen: (isBankModalOpen) => set({ isBankModalOpen }),
  setIsEditingOrder: (isEditingOrder) => set({ isEditingOrder }),
  setOrderItems: (orderItems) => set({ orderItems }),
  setCustomerName: (customerName) => set({ customerName }),
  setOrderNote: (orderNote) => set({ orderNote }),
  setCopySuccess: (copySuccess) => set({ copySuccess }),
  setEditCopySuccess: (editCopySuccess) => set({ editCopySuccess }),
  setSavedOrders: (savedOrders) => set({ savedOrders }),
  setAllOrders: (allOrders) => set({ allOrders }),
  
  // Fetch Data
  fetchData: async () => {
    set({ loading: true });
    try {
      const { data: breedsData } = await supabase
        .from('breeds')
        .select('*')
        .order('name');
      
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .limit(1);
      
      set({ 
        breeds: breedsData || [],
        bankInfo: settingsData && settingsData.length > 0 ? settingsData[0] : {
          id: null,
          bank_name: 'กสิกรไทย',
          account_number: '',
          account_name: '',
          shipping_fee: 60
        }
      });
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      set({ loading: false });
    }
  },
  
  fetchAllOrders: async (period: 'today' | 'week' | 'month' | 'year' | 'custom' = 'today', customStart?: string, customEnd?: string) => {
    try {
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      
      const now = new Date();
      if (period === 'today') {
        const today = now.toISOString().split('T')[0];
        query = query.gte('created_at', today);
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', weekAgo);
      } else if (period === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        query = query.gte('created_at', monthStart);
      } else if (period === 'year') {
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
        query = query.gte('created_at', yearStart);
      } else if (period === 'custom' && customStart && customEnd) {
        query = query.gte('created_at', customStart).lte('created_at', customEnd + 'T23:59:59');
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const transformedData = (data || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        items: order.items,
        totalAmount: order.total_amount || 0,
        totalFish: order.total_fish || 0,
        shippingFee: order.shipping_fee || 60,
        actualShippingFee: order.actual_shipping_fee !== null ? order.actual_shipping_fee : (order.shipping_fee || 60),
        totalCost: order.total_cost || 0,
        customerName: order.customer_name,
        note: order.note
      }));
      
      set({ allOrders: transformedData });
    } catch (err) {
      console.error('Load all orders error:', err);
    }
  },
  
  // Add to Order
  addToOrder: (breed, type, gender, grade) => {
    const { orderItems } = get();
    
    let price = 0;
    let cost = 0;
    
    if (grade === 'premium') {
      price = type === 'piece' ? (breed.premium_price_piece || breed.price_piece) : 
              type === 'pair' ? (breed.premium_price_pair || breed.price_pair) : 
              (breed.premium_price_set || breed.price_set || 0);
      cost = type === 'piece' ? (breed.premium_cost_piece || breed.cost_piece || 0) : 
             type === 'pair' ? (breed.premium_cost_pair || breed.cost_pair || 0) : 
             (breed.premium_cost_set || breed.cost_set || 0);
    } else {
      price = type === 'piece' ? breed.price_piece : type === 'pair' ? breed.price_pair : breed.price_set || 0;
      cost = type === 'piece' ? (breed.cost_piece || 0) : type === 'pair' ? (breed.cost_pair || 0) : (breed.cost_set || 0);
    }

    const existing = orderItems.find(item => item.breedId === breed.id && item.type === type && item.gender === gender && item.grade === grade);
    
    if (existing) {
      set({
        orderItems: orderItems.map(item => 
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        )
      });
    } else {
      set({
        orderItems: [...orderItems, { 
          id: Date.now().toString(), 
          breedId: breed.id, 
          breedName: breed.name, 
          type, 
          quantity: 1, 
          price, 
          cost, 
          grade, 
          gender 
        }]
      });
    }
  },
  
  // Remove from Order
  removeFromOrder: (id) => {
    const { orderItems } = get();
    set({ orderItems: orderItems.filter(item => item.id !== id) });
  },
  
  // Set Item Discount
  setItemDiscount: (itemId, discount) => {
    const { orderItems } = get();
    set({
      orderItems: orderItems.map(item => 
        item.id === itemId ? { ...item, discount } : item
      )
    });
  },
  
  // Set Free Qty
  setFreeQty: (itemId, freeQty) => {
    const { orderItems } = get();
    set({
      orderItems: orderItems.map(item => 
        item.id === itemId ? { ...item, freeQty: freeQty > 0 ? freeQty : undefined } : item
      )
    });
  },
  
  // Breed Actions
  addOrUpdateBreed: async (breedData, editingId) => {
    try {
      if (editingId) {
        await supabase.from('breeds').update(breedData).eq('id', editingId);
      } else {
        await supabase.from('breeds').insert([breedData]);
      }
      get().fetchData();
    } catch (err) {
      console.error('Save breed error:', err);
      throw err;
    }
  },
  
  deleteBreed: async (id) => {
    try {
      await supabase.from('breeds').delete().eq('id', id);
      get().fetchData();
    } catch (err) {
      console.error('Delete breed error:', err);
      throw err;
    }
  },
  
  // Settings
  saveSettings: async () => {
    const { bankInfo } = get();
    set({ isSavingSettings: true });
    
    try {
      const payload = {
        bank_name: bankInfo.bank_name,
        account_number: bankInfo.account_number,
        account_name: bankInfo.account_name,
        shipping_fee: Number(bankInfo.shipping_fee)
      };

      let error;
      if (bankInfo.id) {
        const { error: err } = await supabase
          .from('settings')
          .update(payload)
          .eq('id', bankInfo.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('settings')
          .insert([payload]);
        error = err;
      }

      if (error) throw error;
      get().fetchData();
    } catch (err) {
      console.error('Save settings error:', err);
      throw err;
    } finally {
      set({ isSavingSettings: false });
    }
  },
  
  // Save Order
  saveOrder: async (user) => {
    const { orderItems, bankInfo, savedOrders, customerName, orderNote } = get();
    
    if (orderItems.length === 0) {
      throw new Error('No items in order');
    }
    
    set({ isSavingOrder: true });
    
    try {
      const totalFishCount = orderItems.reduce((sum, item) => {
        if (item.type === 'piece') return sum + item.quantity;
        if (item.type === 'pair') return sum + (item.quantity * 2);
        return sum + item.quantity;
      }, 0);
      
      const totalFishPrice = orderItems.reduce((sum, item) => {
        const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
        const subtotal = item.price * paidQty;
        const discount = item.discount || 0;
        return sum + Math.max(0, subtotal - discount);
      }, 0);
      
      const grandTotal = totalFishPrice + (orderItems.length > 0 ? bankInfo.shipping_fee : 0);
      const totalCost = orderItems.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
      
      const orderData = {
        shop_id: user?.shop_name || 'default',
        items: orderItems,
        total_amount: grandTotal,
        total_fish: totalFishCount,
        shipping_fee: bankInfo.shipping_fee,
        actual_shipping_fee: bankInfo.shipping_fee,
        total_cost: totalCost,
        customer_name: customerName || null,
        note: orderNote || null,
        created_by: user?.username || 'unknown'
      };
      
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select();
      
      if (error) throw error;
      
      const newSavedOrder: SavedOrder = {
        id: data[0].id,
        created_at: data[0].created_at,
        items: [...orderItems],
        totalAmount: grandTotal,
        totalFish: totalFishCount,
        shippingFee: bankInfo.shipping_fee || 60,
        actualShippingFee: bankInfo.shipping_fee || 60,
        totalCost: totalCost,
        customerName: customerName || undefined,
        note: orderNote || undefined
      };
      
      set({
        savedOrders: [newSavedOrder, ...savedOrders],
        orderItems: [],
        customerName: '',
        orderNote: ''
      });
    } catch (err) {
      console.error('Save order error:', err);
      throw err;
    } finally {
      set({ isSavingOrder: false });
    }
  },
  
  // Update Order
  updateOrder: async (orderId, updatedItems, updatedCustomerName, updatedNote, updatedActualShippingFee) => {
    const { allOrders, savedOrders, bankInfo, breeds } = get();
    
    try {
      const editingOrder = allOrders.find(o => o.id === orderId);
      
      // Calculate new totals
      const newTotalAmount = updatedItems.reduce((sum, item) => {
        const paidQty = item.quantity - (item.freeQty || 0);
        return sum + (item.price * paidQty) - (item.discount || 0);
      }, 0) + (editingOrder?.shippingFee || 60);
      
      const newTotalFish = updatedItems.reduce((sum, item) => sum + item.quantity, 0);
      const newTotalCost = updatedItems.reduce((sum, item) => {
        let itemCost = item.cost;
        if (itemCost === undefined) {
          const breed = breeds.find((b: Breed) => b.id === item.breedId);
          if (breed) {
            itemCost = item.type === 'piece' ? (breed.cost_piece || 0) : item.type === 'pair' ? (breed.cost_pair || 0) : (breed.cost_set || 0);
            item.cost = itemCost;
          } else {
            itemCost = 0;
          }
        }
        return sum + (itemCost * item.quantity);
      }, 0);
      const newActualShippingFee = updatedActualShippingFee !== undefined ? updatedActualShippingFee : editingOrder?.actualShippingFee;
      
      const { error } = await supabase
        .from('orders')
        .update({
          items: updatedItems,
          total_amount: newTotalAmount,
          total_fish: newTotalFish,
          total_cost: newTotalCost,
          actual_shipping_fee: newActualShippingFee,
          customer_name: updatedCustomerName || null,
          note: updatedNote || null
        })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update state
      set({
        allOrders: prev => prev.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                items: updatedItems, 
                totalAmount: newTotalAmount, 
                totalFish: newTotalFish, 
                totalCost: newTotalCost, 
                actualShippingFee: newActualShippingFee, 
                customerName: updatedCustomerName, 
                note: updatedNote 
              }
            : order
        ),
        savedOrders: prev => prev.map(order => 
          order.id === orderId 
            ? { 
                ...order, 
                items: updatedItems, 
                totalAmount: newTotalAmount, 
                totalFish: newTotalFish, 
                totalCost: newTotalCost, 
                actualShippingFee: newActualShippingFee, 
                customerName: updatedCustomerName, 
                note: updatedNote 
              }
            : order
        ),
        isEditingOrder: false,
        editingOrder: null
      });
    } catch (err) {
      console.error('Update order error:', err);
      throw err;
    }
  },
  
  // Delete Order
  deleteOrder: async (orderId) => {
    const { allOrders } = get();
    
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      
      if (error) throw error;
      
      set({ allOrders: allOrders.filter(order => order.id !== orderId) });
    } catch (err) {
      console.error('Delete order error:', err);
      throw err;
    }
  }
}));

// Computed values (calculated outside the store)
export const calculateItemTotal = (item: OrderItem): number => {
  const paidQty = Math.max(0, item.quantity - (item.freeQty || 0));
  const subtotal = item.price * paidQty;
  const discount = item.discount || 0;
  return Math.max(0, subtotal - discount);
};

export const useGroupedOrderItems = (): GroupedOrderItem[] => {
  const orderItems = useStore(state => state.orderItems);
  
  const groups: { [key: string]: GroupedOrderItem } = {};
  
  orderItems.forEach(item => {
    if (!groups[item.breedId]) {
      groups[item.breedId] = {
        breedId: item.breedId,
        breedName: item.breedName,
        items: [],
        totalQuantity: 0,
        totalFishCount: 0,
        totalPrice: 0,
        totalDiscount: 0,
        totalFreeQty: 0
      };
    }
    
    const group = groups[item.breedId];
    group.items.push(item);
    group.totalQuantity += item.quantity;
    group.totalFishCount += item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity;
    group.totalPrice += calculateItemTotal(item);
    group.totalDiscount += item.discount || 0;
    group.totalFreeQty += item.freeQty || 0;
  });
  
  return Object.values(groups);
};

export const useFilteredBreeds = (): Breed[] => {
  const breeds = useStore(state => state.breeds);
  const selectedGrade = useStore(state => state.selectedGrade);
  const searchTerm = useStore(state => state.searchTerm);
  
  let list = breeds;
  
  // Filter by Premium Grade if selected
  if (selectedGrade === 'premium') {
    list = list.filter(breed => 
      (breed.premium_price_piece && breed.premium_price_piece > 0) || 
      (breed.premium_price_pair && breed.premium_price_pair > 0) || 
      (breed.premium_price_set && breed.premium_price_set > 0)
    );
  }
  
  // Filter by Search Term
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    list = list.filter(breed => breed.name.toLowerCase().includes(term));
  }
  
  return list;
};

export const useOrderTotals = () => {
  const orderItems = useStore(state => state.orderItems);
  const bankInfo = useStore(state => state.bankInfo);
  
  const totalFishCount = orderItems.reduce((sum, item) => {
    if (item.type === 'piece') return sum + item.quantity;
    if (item.type === 'pair') return sum + (item.quantity * 2);
    return sum + item.quantity;
  }, 0);
  
  const totalFishPrice = orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const grandTotal = totalFishPrice + (orderItems.length > 0 ? bankInfo.shipping_fee : 0);
  
  return { totalFishCount, totalFishPrice, grandTotal };
};

export const useTodaySummary = () => {
  const savedOrders = useStore(state => state.savedOrders);
  
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = savedOrders.filter(order => 
    order.created_at?.startsWith(today)
  );
  
  return {
    orderCount: todayOrders.length,
    totalSales: todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    totalFish: todayOrders.reduce((sum, order) => sum + (order.totalFish || 0), 0)
  };
};

export const useDashboardStats = () => {
  const allOrders = useStore(state => state.allOrders);
  
  const totalSales = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalFish = allOrders.reduce((sum, order) => sum + (order.totalFish || 0), 0);
  
  let totalFishNormal = 0;
  let totalFishPremium = 0;
  allOrders.forEach(order => {
    order.items?.forEach((item: OrderItem) => {
      const qty = item.type === 'piece' ? item.quantity : item.type === 'pair' ? item.quantity * 2 : item.quantity;
      if (item.grade === 'premium') {
        totalFishPremium += qty;
      } else {
        totalFishNormal += qty;
      }
    });
  });

  const totalFishCost = allOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
  const totalShippingIncome = allOrders.reduce((sum, order) => sum + (order.shippingFee || 60), 0);
  const totalShippingCost = allOrders.reduce((sum, order) => sum + (order.actualShippingFee !== undefined && order.actualShippingFee !== null ? order.actualShippingFee : (order.shippingFee || 60)), 0);
  const totalProfit = allOrders.reduce((sum, order) => {
    const revenue = order.totalAmount || 0;
    const cost = order.totalCost || 0;
    const shipping = order.actualShippingFee !== undefined && order.actualShippingFee !== null ? order.actualShippingFee : (order.shippingFee || 60);
    return sum + (revenue - cost - shipping);
  }, 0);
  const avgOrderValue = allOrders.length > 0 ? totalSales / allOrders.length : 0;
  
  // Breed stats
  const breedStats: { [key: string]: { name: string; qty: number; sales: number; isPremium?: boolean } } = {};
  allOrders.forEach(order => {
    order.items.forEach((item: OrderItem) => {
      const statKey = `${item.breedId}${item.grade === 'premium' ? '-premium' : '-normal'}`;
      
      if (!breedStats[statKey]) {
        breedStats[statKey] = { name: item.breedName, qty: 0, sales: 0, isPremium: item.grade === 'premium' };
      }
      breedStats[statKey].qty += item.quantity;
      breedStats[statKey].sales += (item.price * item.quantity) - (item.discount || 0);
    });
  });
  
  const topBreeds = Object.values(breedStats)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);
  
  // Customer stats
  const customerStats: { [key: string]: { name: string; orders: number; totalSpent: number; totalFish: number } } = {};
  allOrders.forEach(order => {
    const customerName = order.customerName || 'ไม่ระบุชื่อ';
    if (!customerStats[customerName]) {
      customerStats[customerName] = { name: customerName, orders: 0, totalSpent: 0, totalFish: 0 };
    }
    customerStats[customerName].orders += 1;
    customerStats[customerName].totalSpent += order.totalAmount || 0;
    customerStats[customerName].totalFish += order.totalFish || 0;
  });
  
  const topCustomers = Object.values(customerStats)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);
  
  return {
    totalOrders: allOrders.length,
    totalSales,
    totalFishCost,
    totalShippingIncome,
    totalShippingCost,
    totalFish,
    totalFishNormal,
    totalFishPremium,
    totalProfit,
    avgOrderValue,
    topBreeds,
    topCustomers
  };
};