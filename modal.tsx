      {/* Add/Edit Breed Modal */}
      {isBreedModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl">
                  {editingBreed ? <Edit2 className="h-6 w-6 text-white" /> : <Plus className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <h2 className="font-black text-xl text-white tracking-tight">{editingBreed ? 'แก้ไขสายพันธุ์' : 'เพิ่มสายพันธุ์ใหม่'}</h2>
                  <p className="text-blue-200 text-sm">{editingBreed ? `กำลังแก้ไข #${String(editingBreed.id).slice(-6)}` : 'กรอกรายละเอียดเพื่อเพิ่มปลา'}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsBreedModalOpen(false); setEditingBreed(null); }}
                className="h-12 w-12 bg-white/20 hover:bg-white/30 rounded-2xl flex items-center justify-center text-white transition-all"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <form id="breedForm" onSubmit={handleAddOrUpdateBreed} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อสายพันธุ์</label>
                  <input name="name" defaultValue={editingBreed?.name} required placeholder="เช่น Full Gold" className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                </div>
                
                <div className="space-y-6">
                  {/* เกรดคัด */}
                  <div className="bg-orange-50/50 p-6 rounded-[2rem] border-2 border-orange-100 shadow-sm space-y-4">
                    <p className="text-sm font-black text-orange-600 uppercase tracking-widest flex items-center gap-2"><span className="text-lg">👑</span> งานคัดเกรด</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Piece (ต่อตัว)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_piece" type="number" defaultValue={editingBreed?.premium_price_piece || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_piece" type="number" defaultValue={editingBreed?.premium_cost_piece || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Pair (คู่)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_pair" type="number" defaultValue={editingBreed?.premium_price_pair || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_pair" type="number" defaultValue={editingBreed?.premium_cost_pair || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-orange-100/50 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Set (ชุด)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="premium_price_set" type="number" defaultValue={editingBreed?.premium_price_set || ''} placeholder="0" className="w-full h-11 bg-orange-50/30 border border-orange-200 rounded-xl px-4 font-black outline-none text-sm focus:border-orange-400" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="premium_cost_set" type="number" defaultValue={editingBreed?.premium_cost_set || ''} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* เกรดปกติ */}
                  <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm space-y-4">
                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">🐟 เกรดปกติ (จำเป็น)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Piece (ต่อตัว)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_piece" type="number" defaultValue={editingBreed?.price_piece} required placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_piece" type="number" defaultValue={editingBreed?.cost_piece || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Pair (คู่)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_pair" type="number" defaultValue={editingBreed?.price_pair} required placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_pair" type="number" defaultValue={editingBreed?.cost_pair || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 p-4 bg-white rounded-[1.5rem] border border-slate-100 shadow-sm">
                        <p className="text-xs font-bold text-center text-slate-600 uppercase tracking-widest">Set (ชุด)</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">ราคาขาย</label>
                            <input name="price_set" type="number" defaultValue={editingBreed?.price_set || 0} placeholder="0" className="w-full h-11 bg-blue-50/30 border border-blue-100 rounded-xl px-4 font-black outline-none text-sm focus:border-blue-300" />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทุน</label>
                            <input name="cost_set" type="number" defaultValue={editingBreed?.cost_set || 0} placeholder="0" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 font-bold outline-none text-sm text-slate-500 focus:border-slate-300" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
              <button 
                type="button" 
                onClick={() => { setIsBreedModalOpen(false); setEditingBreed(null); }}
                className="flex-1 h-14 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:border-slate-300 transition-all"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                form="breedForm"
                className="flex-1 h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-all"
              >
                <Save className="h-5 w-5" />
                {editingBreed ? 'อัปเดตข้อมูล' : 'เพิ่มปลา'}
              </button>
            </div>
          </div>
        </div>
      )}
