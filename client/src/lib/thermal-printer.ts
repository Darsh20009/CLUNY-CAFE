// ── Thermal Printer — Web Serial API + ESC/POS ──────────────────────────────
// Supports: Epson, Bixolon, Xprinter and most 80mm USB thermal printers.

const ESC = 0x1b;
const GS  = 0x1d;
const NUL = 0x00;

const CMD = {
  INIT:        [ESC, 0x40],
  BOLD_ON:     [ESC, 0x45, 0x01],
  BOLD_OFF:    [ESC, 0x45, 0x00],
  ALIGN_L:     [ESC, 0x61, 0x00],
  ALIGN_C:     [ESC, 0x61, 0x01],
  ALIGN_R:     [ESC, 0x61, 0x02],
  FONT_NORMAL: [ESC, 0x21, 0x00],
  FONT_WIDE:   [ESC, 0x21, 0x20],
  FONT_DOUBLE: [ESC, 0x21, 0x11],
  FEED:        [ESC, 0x64, 0x03],
  FEED1:       [ESC, 0x64, 0x01],
  CUT_FULL:    [GS,  0x56, 0x41, NUL],
  CUT_PARTIAL: [GS,  0x56, 0x42, NUL],
  DIVIDER:     '─'.repeat(32),
};

function bytes(...cmds: (number[] | number)[]): Uint8Array {
  const flat: number[] = [];
  for (const c of cmds) Array.isArray(c) ? flat.push(...c) : flat.push(c);
  return new Uint8Array(flat);
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text + '\n');
}

function encodeLine(text: string, align: 'left' | 'center' | 'right' = 'right'): number[] {
  const alignCmd = align === 'center' ? CMD.ALIGN_C : align === 'right' ? CMD.ALIGN_R : CMD.ALIGN_L;
  return [...alignCmd, ...new TextEncoder().encode(text + '\n')];
}

function encodeRow(label: string, value: string, width = 32): number[] {
  const pad = Math.max(1, width - label.length - value.length);
  return [...CMD.ALIGN_L, ...new TextEncoder().encode(`${label}${' '.repeat(pad)}${value}\n`)];
}

// ── State ────────────────────────────────────────────────────────────────────

let _port: any = null;  // SerialPort
let _writer: any = null; // WritableStreamDefaultWriter

export function isWebSerialSupported(): boolean {
  return 'serial' in navigator;
}

export function isPrinterConnected(): boolean {
  return _port !== null && _writer !== null;
}

export async function connectPrinter(): Promise<{ ok: boolean; error?: string }> {
  if (!isWebSerialSupported()) {
    return { ok: false, error: 'Web Serial غير مدعوم في هذا المتصفح. استخدم Chrome أو Edge.' };
  }
  try {
    _port = await (navigator as any).serial.requestPort();
    await _port.open({ baudRate: 9600 });
    _writer = _port.writable.getWriter();
    return { ok: true };
  } catch (e: any) {
    _port = null; _writer = null;
    if (e?.name === 'NotFoundError') return { ok: false, error: 'لم يتم اختيار طابعة.' };
    return { ok: false, error: `فشل الاتصال: ${e?.message || e}` };
  }
}

export async function disconnectPrinter(): Promise<void> {
  try {
    if (_writer) { _writer.releaseLock(); _writer = null; }
    if (_port) { await _port.close(); _port = null; }
  } catch { /* ignore */ }
}

async function writeBytes(data: Uint8Array): Promise<void> {
  if (!_writer) throw new Error('Printer not connected');
  await _writer.write(data);
}

export async function testPrint(): Promise<{ ok: boolean; error?: string }> {
  if (!isPrinterConnected()) return { ok: false, error: 'الطابعة غير متصلة' };
  try {
    const buf: number[] = [
      ...CMD.INIT,
      ...CMD.ALIGN_C, ...CMD.BOLD_ON, ...CMD.FONT_WIDE,
      ...new TextEncoder().encode('CLUNY CAFE\n'),
      ...CMD.FONT_NORMAL, ...CMD.BOLD_OFF,
      ...new TextEncoder().encode('اختبار الطباعة\n'),
      ...new TextEncoder().encode(new Date().toLocaleString('ar-SA') + '\n'),
      ...CMD.FEED,
      ...CMD.CUT_PARTIAL,
    ];
    await writeBytes(new Uint8Array(buf));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطأ في الطباعة' };
  }
}

interface ThermalReceiptData {
  orderNumber: string;
  date: string;
  employeeName: string;
  tableNumber?: string;
  orderType?: string;
  customerName?: string;
  items: Array<{
    nameAr: string;
    quantity: number;
    price: number;
    addons?: Array<{ nameAr: string; price?: number }>;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  splitCash?: number;
  splitCard?: number;
  discount?: number;
  vatNumber?: string;
  crNumber?: string;
}

export async function printReceiptToThermal(data: ThermalReceiptData): Promise<{ ok: boolean; error?: string }> {
  if (!isPrinterConnected()) return { ok: false, error: 'الطابعة غير متصلة' };
  try {
    const enc = new TextEncoder();
    const buf: number[] = [];

    const line = (text: string) => buf.push(...enc.encode(text + '\n'));
    const center = (text: string) => { buf.push(...CMD.ALIGN_C, ...enc.encode(text + '\n')); };
    const bold = (on: boolean) => buf.push(...(on ? CMD.BOLD_ON : CMD.BOLD_OFF));
    const row = (l: string, r: string) => {
      const pad = Math.max(1, 32 - l.length - r.length);
      buf.push(...CMD.ALIGN_L, ...enc.encode(`${l}${' '.repeat(pad)}${r}\n`));
    };
    const divider = () => { buf.push(...CMD.ALIGN_L, ...enc.encode('--------------------------------\n')); };

    buf.push(...CMD.INIT);

    // Header
    buf.push(...CMD.ALIGN_C, ...CMD.BOLD_ON, ...CMD.FONT_WIDE);
    line('CLUNY CAFE');
    buf.push(...CMD.FONT_NORMAL, ...CMD.BOLD_OFF);
    center('كـلـونـي كافيه');
    center('www.cluny.cafe');
    if (data.vatNumber) center(`VAT: ${data.vatNumber}`);
    divider();

    // Order info
    buf.push(...CMD.ALIGN_C, ...CMD.BOLD_ON);
    line(`# ${data.orderNumber}`);
    buf.push(...CMD.BOLD_OFF);
    center(new Date(data.date).toLocaleString('ar-SA'));
    if (data.tableNumber) center(`طاولة: ${data.tableNumber}`);
    if (data.customerName && data.customerName !== 'عميل نقدي') center(`العميل: ${data.customerName}`);
    center(`الكاشير: ${data.employeeName}`);
    divider();

    // Items
    buf.push(...CMD.ALIGN_L);
    for (const item of data.items) {
      const lineTotal = (item.price * item.quantity).toFixed(2);
      row(`${item.nameAr} x${item.quantity}`, `${lineTotal}`);
      if (item.addons?.length) {
        for (const a of item.addons) {
          buf.push(...enc.encode(`   + ${a.nameAr}\n`));
        }
      }
    }
    divider();

    // Totals
    row('المجموع قبل الضريبة:', `${data.subtotal.toFixed(2)}`);
    row('ضريبة 15%:', `${data.vatAmount.toFixed(2)}`);
    if (data.discount && data.discount > 0) row('الخصم:', `-${data.discount.toFixed(2)}`);
    buf.push(...CMD.BOLD_ON, ...CMD.FONT_WIDE);
    row('الإجمالي:', `${data.total.toFixed(2)}`);
    buf.push(...CMD.FONT_NORMAL, ...CMD.BOLD_OFF);

    // Payment
    divider();
    const payLabel = data.paymentMethod === 'split' ? 'دفع مجزأ' :
                     data.paymentMethod === 'cash' ? 'نقدي' :
                     data.paymentMethod === 'card' ? 'شبكة' : data.paymentMethod;
    row('طريقة الدفع:', payLabel);
    if (data.paymentMethod === 'split' && data.splitCash != null && data.splitCard != null) {
      row('  نقدي:', `${Number(data.splitCash).toFixed(2)}`);
      row('  شبكة:', `${Number(data.splitCard).toFixed(2)}`);
    }
    divider();

    // Footer
    buf.push(...CMD.ALIGN_C);
    line('شكراً لزيارتكم');
    line('الأسعار شاملة ضريبة القيمة المضافة');

    buf.push(...CMD.FEED, ...CMD.CUT_PARTIAL);

    await writeBytes(new Uint8Array(buf));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطأ في الطباعة' };
  }
}
