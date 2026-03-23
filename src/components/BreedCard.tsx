import { Fish, Edit2, Trash2 } from 'lucide-react';
import type { Breed, Grade, Gender } from '../types';

interface BreedCardProps {
  breed: Breed;
  onAddToOrder: (breed: Breed, type: 'piece' | 'pair' | 'set', gender: Gender, grade: Grade) => void;
  onEdit?: (breed: Breed) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  selectedGrade: Grade;
  compact?: boolean;
}

export default function BreedCard({ 
  breed, 
  onAddToOrder, 
  onEdit, 
  onDelete, 
  isAdmin = false,
  selectedGrade,
  compact = false
}: BreedCardProps) {
  const pricePiece = selectedGrade === 'premium' && breed.premium_price_piece 
    ? breed.premium_price_piece 
    : breed.price_piece;
  
  const pricePair = selectedGrade === 'premium' && breed.premium_price_pair 
    ? breed.premium_price_pair 
    : breed.price_pair;
  
  const priceSet = selectedGrade === 'premium' && breed.premium_price_set 
    ? breed.premium_price_set 
    : breed.price_set;

  if (isAdmin) {
    return (
      <div className="bg-white p-3 sm:p-4 rounded-[1.5rem] sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col group hover:shadow-md hover:border-blue-100 transition-all relative overflow-hidden">
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="min-w-0">
            <h4 className="font-black text-[13px] sm:text-sm text-slate-800 line-clamp-1 leading-snug">
              {breed.name}
            </h4>
            <div className="text-[9.5px] sm:text-[10px] font-bold tracking-tight mt-1.5 space-y-0.5">
              {breed.premium_price_piece ? (
                <>
                  <p className="text-orange-500 truncate">👑 คัด: ฿{breed.premium_price_piece}/{breed.premium_price_pair}{breed.premium_price_set && breed.premium_price_set > 0 && `/${breed.premium_price_set}`}</p>
                  <p className="text-slate-400 truncate opacity-80">🐟 ปกติ: ฿{breed.price_piece}/{breed.price_pair}{breed.price_set && breed.price_set > 0 && `/${breed.price_set}`}</p>
                </>
              ) : (
                <p className="text-slate-400 truncate mt-1">฿{breed.price_piece} / ฿{breed.price_pair} {breed.price_set && breed.price_set > 0 && `/ ฿${breed.price_set}`}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0 mt-3 pt-3 border-t border-slate-50 relative z-20">
          <button 
            onClick={() => onEdit?.(breed)} 
            className="flex-1 h-8 bg-slate-50 text-slate-500 hover:bg-white hover:text-blue-600 border border-transparent hover:border-slate-200 rounded-[0.8rem] flex items-center justify-center active:scale-95 transition-all text-[10px] font-black"
          >
            <Edit2 className="h-3 w-3 mr-1" /> แก้ไข
          </button>
          <button 
            onClick={() => onDelete?.(breed.id)} 
            className="h-8 w-9 shrink-0 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-[0.8rem] flex items-center justify-center active:scale-95 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
      <div>
        <h4 className="font-bold text-sm text-slate-800 mb-1.5 leading-tight line-clamp-1">{breed.name}</h4>
        
        {/* Gender Selection */}
        <div className="flex gap-1.5 mb-1.5">
          <button 
            onClick={() => onAddToOrder(breed, 'piece', 'male', selectedGrade)} 
            className="flex-1 py-2 bg-blue-50 hover:bg-blue-500 hover:text-white text-blue-600 rounded-lg text-[11px] font-bold transition-all"
          >
            ตัวผู้ (฿{pricePiece})
          </button>
          <button 
            onClick={() => onAddToOrder(breed, 'piece', 'female', selectedGrade)} 
            className="flex-1 py-2 bg-pink-50 hover:bg-pink-500 hover:text-white text-pink-600 rounded-lg text-[11px] font-bold transition-all"
          >
            ตัวเมีย (฿{pricePiece})
          </button>
        </div>
        
        {/* Price Buttons */}
        <div className={`grid gap-1.5 ${breed.price_set && priceSet > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button 
            onClick={() => onAddToOrder(breed, 'pair', 'mixed', selectedGrade)} 
            className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all"
          >
            <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Pair</p>
            <p className="font-black text-sm">฿{pricePair}</p>
          </button>
          {priceSet && priceSet > 0 ? (
            <button 
              onClick={() => onAddToOrder(breed, 'set', 'mixed', selectedGrade)} 
              className="flex flex-col items-center bg-slate-50 hover:bg-blue-600 hover:text-white py-2 rounded-lg transition-all"
            >
              <p className="text-[8px] font-black uppercase tracking-wider opacity-60">Set</p>
              <p className="font-black text-sm">฿{priceSet}</p>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}