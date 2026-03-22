{isManagingBreeds && isAdmin ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-4 max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-800 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5"><CreditCard className="w-32 h-32" /></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xl flex items-center gap-3 tracking-tight"><CreditCard className="h-6 w-6 text-blue-400" /> Bank & Shipping</h3>
                  <button onClick={saveSettings} disabled={isSavingSettings} className="bg-blue-600 hover:bg-blue-500 px-6 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2">
                    {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Settings
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ธนาคาร</label>
                    <input value={bankInfo.bank_name} onChange={e => setBankInfo({ ...bankInfo, bank_name: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">เลขบัญชี</label>
                    <input value={bankInfo.account_number} onChange={e => setBankInfo({ ...bankInfo, account_number: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อบัญชี</label>
                    <input value={bankInfo.account_name} onChange={e => setBankInfo({ ...bankInfo, account_name: e.target.value })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ค่าส่ง</label>
                    <input type="number" value={bankInfo.shipping_fee} onChange={e => setBankInfo({ ...bankInfo, shipping_fee: Number(e.target.value) })} className="w-full bg-slate-900 border-none rounded-2xl h-12 px-5 font-black outline-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Breeds List Header */}
            <div className="flex items-center justify-between mt-8 mb-4 px-2">
              <h3 className="font-black text-xl flex items-center gap-3 tracking-tight text-slate-800"><Fish className="h-6 w-6 text-blue-600" /> จัดการสายพันธุ์ปลา</h3>
              <button 
                onClick={() => { setEditingBreed(null); setIsBreedModalOpen(true); }} 
                className="h-10 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> เพิ่มสายพันธุ์
              </button>
            </div>

            <div className="space-y-4">
              {breeds.map(breed => (
                <div key={breed.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-5">
                    <div className="h-14 w-14 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 transition-all duration-300"><Fish className="h-7 w-7" /></div>
                    <div>
                      <h4 className="font-black text-lg text-slate-800 leading-none">{breed.name} {breed.premium_price_piece && <span className="ml-2 inline-block -translate-y-0.5 bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest">👑 มีเกรดคัด</span>}</h4>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                        ปกติ: ฿{breed.price_piece} / ฿{breed.price_pair} {breed.price_set && breed.price_set > 0 && `/ ฿${breed.price_set}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 relative z-20">
                    <button onClick={() => { setEditingBreed(breed); setIsBreedModalOpen(true); }} className="h-11 w-11 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl flex items-center justify-center active:scale-90"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => deleteBreed(breed.id)} className="h-11 w-11 bg-slate-50 text-slate-400 hover:text-red-600 rounded-2xl flex items-center justify-center active:scale-90"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
