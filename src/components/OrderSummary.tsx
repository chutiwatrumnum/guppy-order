import { Fish, Trash2, ArrowLeft, ClipboardList, Save, MessageCircle, Copy, Check, Loader2 } from 'lucide-react';
import type { GroupedOrderItem, BankInfo, OrderItem } from '../types';
import { calculateItemTotal, getGenderLabel } from '../utils/message';

interface OrderSummaryProps {
  groupedItems: GroupedOrderItem[];
  orderItems: OrderItem[];
  bankInfo: BankInfo;
  totalFishCount: number;
  totalFishPrice: number;
  grandTotal: number;
  customerName: string;
  orderNote: string;
  isSavingOrder: boolean;
  copySuccess: boolean;
  onRemoveFromOrder: (id: string) => void;
  onSetItemDiscount: (itemId: string, discount: number) => void;
  onSetFreeQty: (itemId: string, freeQty: number) => void;
  onSetCustomerName: (name: string) => void;
  onSetOrderNote: (note: string) => void;
  onSaveOrder: () => void;
  onCopyToClipboard: () => void;
  onShareToLine: () => void;
  onClearOrder: () => void;
  onBack: () => void;
}

export default function OrderSummary({
  groupedItems,
  orderItems,
  bankInfo,
  totalFishCount,
  totalFishPrice,
  grandTotal,
  customerName,
  orderNote,
  isSavingOrder,
  copySuccess,
  onRemoveFromOrder,
  onSetItemDiscount,
  onSetFreeQty,
  onSetCustomerName,
  onSetOrderNote,
  onSaveOrder,
  onCopyToClipboard,
  onShareToLine,
  onClearOrder,
  onBack
}: OrderSummaryProps) {
  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-2 sm:mb-6 transition-all bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm w-fit active:scale-95"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับไปเลือกปลาเพิ่ม
      </button>
      
      <div className="lg:sticky lg:top-28 space-y-4 lg:space-y-6">
        <div className="bg-white rounded-2xl lg:rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-50 overflow-hidden">
          <div className="p-4 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-[#F9FAFB]/50">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-blue-600 rounded-xl">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <span className="font-black text-base sm:text-lg text-slate-800 tracking-tight uppercase">Order Summary</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {totalFishCount > 0 && (
                <span className="text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-3 sm:px-4 py-2 rounded-xl">
                  🐟 {totalFishCount} ตัว
                </span>
              )}
              <button 
                onClick={onClearOrder} 
                className="h-8 px-3 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white min-w-[44px] min-h-[44px] lg:min-w-0 lg:min-h-0"
              >
                Clear
              </button>
            </div>
          </div>
          
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[350px] sm:max-h-[450px] overflow-y-auto">
            {groupedItems.map(group => (
              <div key={group.breedId} className="group">
                {/* Header: Breed Name + Total */}
                <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-100 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <Fish className="h-4 w-4 text-blue-600" />
                    <span className="font-black text-sm sm:text-base text-slate-800">{group.breedName}</span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
                      {group.totalFishCount} ตัว
                    </span>
                  </div>
                  <span className="font-black text-base sm:text-lg text-blue-600">
                    ฿{group.totalPrice.toLocaleString()}
                  </span>
                </div>

                {/* Items Detail */}
                <div className="bg-white border border-slate-100 rounded-b-2xl overflow-hidden">
                  {group.items.map(item => (
                    <div key={item.id} className={`p-3 sm:p-4 border-b border-slate-50 last:border-b-0 ${item.freeQty ? 'bg-green-50/50' : ''}`}>
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-sm font-bold text-slate-600">{getGenderLabel(item.gender)}</span>
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                            {item.quantity} {item.type === 'piece' ? 'ตัว' : item.type === 'pair' ? 'คู่' : 'set'}
                          </span>
                          {item.grade === 'premium' && (
                            <span className="text-[10px] text-orange-500 font-bold bg-orange-100 px-2 py-0.5 rounded-full">
                              👑 คัดเกรด
                            </span>
                          )}
                          {item.freeQty ? (
                            <span className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                              แถม {item.freeQty}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className={`font-black text-sm sm:text-base ${item.freeQty ? 'text-green-700' : 'text-slate-900'}`}>
                            ฿{calculateItemTotal(item).toLocaleString()}
                          </span>
                          <button 
                            onClick={() => onRemoveFromOrder(item.id)} 
                            className="h-10 w-10 sm:h-8 sm:w-8 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-all"
                          >
                            <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Discount & Free Qty Inputs */}
                      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">ส่วนลด:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-sm">-฿</span>
                            <input
                              type="number"
                              value={item.discount || ''}
                              onChange={(e) => onSetItemDiscount(item.id, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-16 h-9 sm:h-7 bg-slate-50 border border-slate-200 rounded-lg px-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 min-h-[36px]"
                            />
                          </div>
                          {item.discount ? (
                            <span className="text-[10px] text-green-500 font-bold">ประหยัด {item.discount} บาท</span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-green-600">🎁 แถม:</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={item.freeQty || ''}
                              onChange={(e) => onSetFreeQty(item.id, Number(e.target.value) || 0)}
                              placeholder="0"
                              className="w-16 h-9 sm:h-7 bg-white border border-green-300 rounded-lg px-2 text-sm font-bold text-green-700 outline-none focus:border-green-500 min-h-[36px]"
                            />
                            <span className="text-green-600 text-sm">ตัว</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Customer Info & Save Order */}
            {orderItems.length > 0 && (
              <div className="mt-4 sm:mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">
                  ข้อมูลลูกค้า (ไม่บังคับ)
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => onSetCustomerName(e.target.value)}
                    placeholder="ชื่อลูกค้า"
                    className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                  />
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => onSetOrderNote(e.target.value)}
                    placeholder="หมายเหตุ"
                    className="w-full h-11 sm:h-10 bg-white border border-blue-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={onSaveOrder}
                    disabled={isSavingOrder}
                    className="w-full h-12 sm:h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    {isSavingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isSavingOrder ? 'กำลังบันทึก...' : '💾 บันทึกออเดอร์'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {orderItems.length > 0 && (
            <div className="p-4 sm:p-8 bg-[#1F2937] text-white space-y-4 sm:space-y-5 rounded-b-2xl sm:rounded-b-[3rem] shadow-2xl">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">จำนวนปลา</span>
                <span className="text-white font-black">{totalFishCount} ตัว</span>
              </div>
              <div className="flex justify-between items-center text-xs font-black text-slate-500">
                <span className="uppercase tracking-[0.2em]">Shipping</span>
                <span className="text-white font-black">฿{bankInfo.shipping_fee}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-black text-lg sm:text-xl tracking-tight uppercase">Total Amount</span>
                <span className="font-black text-2xl sm:text-3xl text-blue-400 tracking-tighter">฿{grandTotal.toLocaleString()}</span>
              </div>
              <div className="pt-4 grid grid-cols-1 gap-3">
                <button 
                  onClick={onShareToLine} 
                  className="h-14 sm:h-14 bg-[#06C755] text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] min-h-[56px]"
                >
                  <MessageCircle className="h-5 w-5" /> 
                  Send to LINE
                </button>
                <button 
                  onClick={onCopyToClipboard} 
                  className={`h-14 sm:h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] border-2 min-h-[56px] ${copySuccess ? 'bg-blue-600 border-blue-600 text-white' : 'bg-transparent text-slate-400 border-slate-800'}`}
                >
                  {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copySuccess ? 'Copied Success' : 'Copy Text'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}