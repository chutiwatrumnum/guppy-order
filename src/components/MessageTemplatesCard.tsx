import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, MessageSquareText, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { missingRequired, type MessageTemplate } from '@/utils/templates';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// แก้คำที่ระบบส่งหาลูกค้า
//
// ข้อความทั้งหมดอยู่ในตารางเดียว ทั้งที่บอทส่งและที่หน้าแอดมินหยอดคิว
// เดิมกระจายอยู่ในโค้ดบอท หน้าแอดมิน และในฟังก์ชัน SQL — แก้คำทีต้อง deploy ที

const GROUPS: { key: string; title: string; hint: string }[] = [
  {
    key: 'push',
    title: 'ข้อความที่ส่งหาลูกค้า',
    hint: 'ระบบส่งให้อัตโนมัติตามเหตุการณ์ กินโควต้าข้อความของ LINE',
  },
  {
    key: 'chat',
    title: 'บอทตอบในแชท',
    hint: 'ตอบเมื่อลูกค้าพิมพ์หรือกดปุ่มริชเมนู ไม่กินโควต้า',
  },
];

export default function MessageTemplatesCard() {
  const [rows, setRows] = useState<MessageTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('sort_order');

    if (error) {
      toast.error('โหลดข้อความไม่สำเร็จ');
      setLoading(false);
      return;
    }
    const list = (data || []) as MessageTemplate[];
    setRows(list);
    setDrafts(Object.fromEntries(list.map((r) => [r.key, r.body])));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (row: MessageTemplate) => {
    const body = (drafts[row.key] ?? '').trim();
    if (!body) {
      toast.error('ข้อความว่างไม่ได้ครับ');
      return;
    }

    // ลบ {{tracking}} ทิ้ง = ลูกค้าไม่ได้เลขพัสดุ — เตือนแต่ไม่บล็อก
    // ร้านอาจตั้งใจเขียนใหม่ทั้งประโยค ระบบไม่ควรขวางถ้าเจ้าของยืนยันเอง
    const missing = missingRequired(body, row.required);
    if (missing.length > 0) {
      const ok = window.confirm(
        `ข้อความนี้ไม่มี ${missing.map((v) => `{{${v}}}`).join(', ')} แล้ว\n` +
          `ลูกค้าจะไม่เห็นข้อมูลส่วนนั้นเลย ยืนยันจะบันทึกไหม?`
      );
      if (!ok) return;
    }

    setSaving(row.key);
    const { error } = await supabase
      .from('message_templates')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('key', row.key);
    setSaving(null);

    if (error) {
      toast.error('บันทึกไม่สำเร็จ');
      return;
    }
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, body } : r)));
    toast.success('บันทึกแล้ว', { description: 'บอทจะใช้คำใหม่ภายใน 1 นาที' });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <button
          type="button"
          className="flex w-full items-start gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
        >
          <MessageSquareText className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">คำที่ระบบพูดกับลูกค้า</p>
            <p className="text-muted-foreground text-sm">
              แก้ได้ทั้ง {rows.length} ข้อความ ไม่ต้องรอ deploy
            </p>
          </div>
          <ChevronDown
            className={cn('text-muted-foreground mt-1 size-4 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="space-y-6">
            {GROUPS.map((g) => {
              const list = rows.filter((r) => r.group_key === g.key);
              if (list.length === 0) return null;

              return (
                <div key={g.key} className="space-y-3">
                  <div>
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="text-muted-foreground text-xs">{g.hint}</p>
                  </div>

                  {list.map((row) => {
                    const draft = drafts[row.key] ?? '';
                    const dirty = draft !== row.body;
                    const missing = missingRequired(draft, row.required);

                    return (
                      <div key={row.key} className="bg-muted/40 space-y-2 rounded-lg p-3">
                        <div>
                          <p className="text-sm font-medium">{row.label}</p>
                          {row.description && (
                            <p className="text-muted-foreground text-xs">{row.description}</p>
                          )}
                        </div>

                        <Textarea
                          rows={Math.min(10, Math.max(3, draft.split('\n').length + 1))}
                          value={draft}
                          onChange={(e) => setDrafts((p) => ({ ...p, [row.key]: e.target.value }))}
                          className="bg-background font-mono text-xs"
                        />

                        {row.variables.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground text-xs">แทรกได้:</span>
                            {row.variables.map((v) => (
                              <button
                                key={v}
                                type="button"
                                className="bg-background hover:bg-accent rounded border px-1.5 py-0.5 font-mono text-xs"
                                onClick={() =>
                                  setDrafts((p) => ({ ...p, [row.key]: (p[row.key] ?? '') + `{{${v}}}` }))
                                }
                              >
                                {`{{${v}}}`}
                              </button>
                            ))}
                          </div>
                        )}

                        {missing.length > 0 && (
                          <div className="text-warning flex items-start gap-1.5 text-xs">
                            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              ไม่มี {missing.map((v) => `{{${v}}}`).join(', ')} — ลูกค้าจะไม่เห็นข้อมูลส่วนนี้
                            </span>
                          </div>
                        )}

                        {dirty && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => save(row)} disabled={saving === row.key}>
                              {saving === row.key ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Save className="size-3.5" />
                              )}
                              บันทึก
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDrafts((p) => ({ ...p, [row.key]: row.body }))}
                            >
                              <RotateCcw className="size-3.5" /> ย้อนกลับ
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <Separator />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
