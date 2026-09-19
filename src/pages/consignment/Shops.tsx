import { useState } from 'react';
import { useConsignmentStore } from '../../store/consignmentStore';
import { shareLabel } from '../../utils/consignment';
import {
  pageStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSmall,
  btnDanger,
  C,
} from '../../components/consignment/ui';
import { ErrorBanner } from '../../components/consignment/Feedback';
import { useActionError } from '../../components/consignment/useActionError';

export default function Shops() {
  const { shops, addShop, updateShop, deleteShop } = useConsignmentStore();
  const { error, run, setError } = useActionError();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [share, setShare] = useState(0.6);
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  const reset = () => {
    setName('');
    setContact('');
    setPhone('');
    setShare(0.6);
    setNote('');
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 22 }}>小店</h1>
      <ErrorBanner message={error} onClose={() => setError(null)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 20, marginTop: 16 }}>
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, margin: '0 0 12px' }}>{editingId ? '编辑小店' : '新增小店'}</h2>
          {!editingId && (
            <>
              <label style={labelStyle}>店名 *</label>
              <input style={{ ...inputStyle, width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>联系人</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>电话</label>
                  <input style={{ ...inputStyle, width: '100%' }} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
              <label style={{ ...labelStyle, marginTop: 10 }}>
                默认我方分成比例（{Math.round(share * 100)}%，我方 : 店方 = {shareLabel(share)}）
              </label>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={share}
                onChange={(e) => setShare(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <label style={{ ...labelStyle, marginTop: 10 }}>备注（对账日等）</label>
              <input style={{ ...inputStyle, width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} />
              <button
                style={{ ...btnPrimary, marginTop: 14, width: '100%' }}
                onClick={() =>
                  run(() => {
                    if (!name.trim()) throw new Error('店名必填');
                    addShop({
                      name: name.trim(),
                      contact: contact.trim() || undefined,
                      phone: phone.trim() || undefined,
                      defaultOurShare: share,
                      note: note.trim() || undefined,
                    });
                    reset();
                  })
                }
              >
                添加
              </button>
            </>
          )}
          {editingId && (
            <>
              <label style={labelStyle}>备注修改后失焦即保存</label>
              <textarea
                style={{ ...inputStyle, width: '100%', minHeight: 80 }}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  style={btnPrimary}
                  onClick={() =>
                    run(() => {
                      updateShop(editingId, { note: editNote.trim() || undefined });
                      setEditingId(null);
                    })
                  }
                >
                  保存
                </button>
                <button
                  style={btnSmall}
                  onClick={() => {
                    setEditingId(null);
                    setError(null);
                  }}
                >
                  取消
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shops.map((sh) => (
            <div key={sh.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{sh.name}</strong>
                  <span style={{ marginLeft: 12, fontSize: 13, color: C.muted }}>
                    默认分成 我方 : 店方 = {shareLabel(sh.defaultOurShare)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={btnSmall}
                    onClick={() => {
                      setEditingId(sh.id);
                      setEditNote(sh.note ?? '');
                      setError(null);
                    }}
                  >
                    改备注
                  </button>
                  <button style={btnDanger} onClick={() => run(() => deleteShop(sh.id))}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
                {[sh.contact, sh.phone, sh.note].filter(Boolean).join(' · ')}
              </div>
            </div>
          ))}
          {shops.length === 0 && (
            <div style={{ ...cardStyle, color: C.muted, textAlign: 'center', padding: 32 }}>
              还没有小店，先在左边添加第一家寄售店
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
