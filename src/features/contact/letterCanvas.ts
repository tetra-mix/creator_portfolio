import * as THREE from 'three';

// Which part of the letter a tap landed on. A field moves the caret there;
// 'send' submits; null is a tap on dead space.
export type LetterField = 'subject' | 'email' | 'message';
export type LetterHit = LetterField | 'send' | null;

// Submission lifecycle shown on the sheet's Send button / status line.
export type LetterStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface LetterValues {
  subject: string;
  email: string;
  message: string;
}

// A rectangular hit region in normalized letter UV space (0..1, origin bottom-left
// like three.js UVs). Used by interactions.ts to map a raycast UV to a field.
export interface LetterRegion {
  field: LetterHit;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface LetterCanvas {
  texture: THREE.CanvasTexture;
  // Redraw the whole sheet for the given field values, highlighting `active`
  // and blinking its caret when `caretVisible`. `status` drives the Send button
  // label and a status line (defaults to 'idle').
  draw(
    values: LetterValues,
    active: LetterField,
    caretVisible: boolean,
    writing: boolean,
    status?: LetterStatus,
  ): void;
  // Map a UV hit (three.js convention: v=0 bottom) to a field/button/null.
  hitTest(u: number, v: number): LetterHit;
}

// Portrait sheet matching CONFIG.letter.size aspect (2.2 : 3.0).
const LOGICAL_W = 308;
const LOGICAL_H = 420;
const MARGIN_X = 26;
const LABEL_FONT = "600 11px Georgia, 'Times New Roman', serif";
const TEXT_FONT = "15px 'Comic Sans MS', 'Segoe Print', 'Bradley Hand', cursive";
const LINE_GAP = 20; // ruled-line spacing in the message body (smaller than before)

// Vertical layout in canvas pixels (top = 0). Each field has a label row and a
// content area; the message area runs to near the bottom of the sheet.
const LAYOUT = {
  headerY: 46,
  subjectLabelY: 82,
  subjectTop: 88,
  subjectBottom: 120,
  emailLabelY: 140,
  emailTop: 146,
  emailBottom: 178,
  messageLabelY: 198,
  messageTop: 204,
  messageBottom: 350, // shortened to make room for the Send button below
  // Send button + status line near the bottom of the sheet.
  sendTop: 364,
  sendBottom: 396,
  statusY: 412,
};
// Send button horizontal extent (canvas px).
const SEND_X0 = MARGIN_X;
const SEND_X1 = LOGICAL_W - MARGIN_X;

export function createLetterCanvas(): LetterCanvas {
  const canvas = document.createElement('canvas');
  const scale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  canvas.width = Math.floor(LOGICAL_W * scale);
  canvas.height = Math.floor(LOGICAL_H * scale);
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  if (!ctx) {
    return { texture, draw: () => {}, hitTest: () => null };
  }
  ctx.scale(scale, scale);

  // Tap regions in pixel space; converted to UV in hitTest.
  const regions: Array<{ field: LetterHit; x0: number; y0: number; x1: number; y1: number }> = [
    {
      field: 'subject',
      x0: MARGIN_X,
      y0: LAYOUT.subjectLabelY - 8,
      x1: LOGICAL_W - MARGIN_X,
      y1: LAYOUT.subjectBottom,
    },
    {
      field: 'email',
      x0: MARGIN_X,
      y0: LAYOUT.emailLabelY - 8,
      x1: LOGICAL_W - MARGIN_X,
      y1: LAYOUT.emailBottom,
    },
    {
      field: 'message',
      x0: MARGIN_X,
      y0: LAYOUT.messageLabelY - 8,
      x1: LOGICAL_W - MARGIN_X,
      y1: LAYOUT.messageBottom,
    },
    {
      field: 'send',
      x0: SEND_X0,
      y0: LAYOUT.sendTop,
      x1: SEND_X1,
      y1: LAYOUT.sendBottom,
    },
  ];

  function hitTest(u: number, v: number): LetterHit {
    const x = u * LOGICAL_W;
    const y = (1 - v) * LOGICAL_H; // three.js UV v=0 is bottom; canvas y=0 is top
    for (const r of regions) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.field;
    }
    return null;
  }

  // Wrap a string to the writing column at the body font.
  function wrapLines(text: string, maxW: number): string[] {
    ctx!.font = TEXT_FONT;
    const out: string[] = [];
    for (const para of text.split('\n')) {
      if (para === '') {
        out.push('');
        continue;
      }
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx!.measureText(next).width > maxW && line) {
          out.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      out.push(line);
    }
    return out;
  }

  function caretAt(x: number, y: number) {
    const c = ctx!;
    c.strokeStyle = 'rgba(47, 42, 58, 0.9)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x, y - 13);
    c.lineTo(x, y + 3);
    c.stroke();
  }

  function label(text: string, y: number, active: boolean) {
    const c = ctx!;
    c.fillStyle = active ? 'rgba(150, 90, 40, 0.95)' : 'rgba(120, 100, 70, 0.7)';
    c.font = LABEL_FONT;
    c.textBaseline = 'alphabetic';
    c.fillText(text, MARGIN_X, y);
  }

  function underline(top: number, bottom: number, active: boolean) {
    const c = ctx!;
    c.strokeStyle = active ? 'rgba(150, 90, 40, 0.55)' : 'rgba(150, 120, 80, 0.3)';
    c.lineWidth = active ? 1.4 : 1;
    c.beginPath();
    c.moveTo(MARGIN_X, bottom);
    c.lineTo(LOGICAL_W - MARGIN_X, bottom);
    c.stroke();
    void top;
  }

  // Rounded-rect path helper for the Send button.
  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = ctx!;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawSendButton(status: LetterStatus) {
    const c = ctx!;
    const x = SEND_X0;
    const y = LAYOUT.sendTop;
    const w = SEND_X1 - SEND_X0;
    const h = LAYOUT.sendBottom - LAYOUT.sendTop;

    // Button fill changes with status for clear feedback.
    const fill =
      status === 'sending'
        ? 'rgba(150, 120, 80, 0.45)'
        : status === 'sent'
          ? 'rgba(70, 130, 80, 0.9)'
          : status === 'error'
            ? 'rgba(170, 70, 60, 0.9)'
            : 'rgba(150, 90, 40, 0.92)';
    roundRect(x, y, w, h, 8);
    c.fillStyle = fill;
    c.fill();

    const label =
      status === 'sending'
        ? 'Sending...'
        : status === 'sent'
          ? 'Sent'
          : status === 'error'
            ? 'Retry'
            : 'Send';
    c.fillStyle = '#faf3e0';
    c.font = "600 14px Georgia, 'Times New Roman', serif";
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + h / 2 + 1);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';

    // Status line under the button.
    const msg =
      status === 'sending'
        ? 'Posting your letter...'
        : status === 'sent'
          ? 'Thank you! Your letter is on its way.'
          : status === 'error'
            ? 'Could not send. Check your input and try again.'
            : '';
    if (msg) {
      c.fillStyle = status === 'error' ? 'rgba(170, 70, 60, 0.95)' : 'rgba(90, 70, 45, 0.85)';
      c.font = "600 10px Georgia, 'Times New Roman', serif";
      c.textAlign = 'center';
      c.fillText(msg, LOGICAL_W / 2, LAYOUT.statusY);
      c.textAlign = 'left';
    }
  }

  function draw(
    values: LetterValues,
    active: LetterField,
    caretVisible: boolean,
    writing: boolean,
    status: LetterStatus = 'idle',
  ): void {
    const c = ctx!;
    const maxW = LOGICAL_W - MARGIN_X * 2;

    // Paper + edge
    c.fillStyle = '#faf3e0';
    c.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    c.strokeStyle = 'rgba(150, 120, 80, 0.25)';
    c.lineWidth = 2;
    c.strokeRect(10, 10, LOGICAL_W - 20, LOGICAL_H - 20);

    // Header
    c.fillStyle = 'rgba(90, 70, 45, 0.9)';
    c.font = "600 22px Georgia, 'Times New Roman', serif";
    c.textBaseline = 'alphabetic';
    c.fillText('Contact', MARGIN_X, LAYOUT.headerY);
    c.strokeStyle = 'rgba(150, 120, 80, 0.4)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(MARGIN_X, LAYOUT.headerY + 12);
    c.lineTo(LOGICAL_W - MARGIN_X, LAYOUT.headerY + 12);
    c.stroke();

    // --- Subject ---
    label('Subject', LAYOUT.subjectLabelY, active === 'subject');
    underline(LAYOUT.subjectTop, LAYOUT.subjectBottom, active === 'subject');
    c.fillStyle = '#2f2a3a';
    c.font = TEXT_FONT;
    const subjY = LAYOUT.subjectBottom - 8;
    c.fillText(values.subject, MARGIN_X, subjY);
    if (active === 'subject' && caretVisible) {
      caretAt(MARGIN_X + c.measureText(values.subject).width + 1, subjY);
    }

    // --- Your e-mail address ---
    label('Your E-mail Address', LAYOUT.emailLabelY, active === 'email');
    underline(LAYOUT.emailTop, LAYOUT.emailBottom, active === 'email');
    c.fillStyle = '#2f2a3a';
    c.font = TEXT_FONT;
    const emailY = LAYOUT.emailBottom - 8;
    c.fillText(values.email, MARGIN_X, emailY);
    if (active === 'email' && caretVisible) {
      caretAt(MARGIN_X + c.measureText(values.email).width + 1, emailY);
    }

    // --- Message (ruled, multi-line) ---
    label('Message', LAYOUT.messageLabelY, active === 'message');
    c.strokeStyle = 'rgba(120, 140, 170, 0.3)';
    c.lineWidth = 1;
    for (let y = LAYOUT.messageTop + LINE_GAP; y <= LAYOUT.messageBottom; y += LINE_GAP) {
      c.beginPath();
      c.moveTo(MARGIN_X, y);
      c.lineTo(LOGICAL_W - MARGIN_X, y);
      c.stroke();
    }
    const lines = wrapLines(values.message, maxW);
    const firstRowY = LAYOUT.messageTop + LINE_GAP - 5;
    const maxRows =
      Math.floor((LAYOUT.messageBottom - (LAYOUT.messageTop + LINE_GAP)) / LINE_GAP) + 1;
    const visible = lines.slice(Math.max(0, lines.length - maxRows));
    c.fillStyle = '#2f2a3a';
    c.font = TEXT_FONT;
    visible.forEach((line, i) => {
      c.fillText(line, MARGIN_X, firstRowY + i * LINE_GAP);
    });
    if (active === 'message' && caretVisible) {
      const lastIdx = Math.max(0, visible.length - 1);
      const lastLine = visible[lastIdx] ?? '';
      caretAt(MARGIN_X + c.measureText(lastLine).width + 1, firstRowY + lastIdx * LINE_GAP);
    }

    drawSendButton(status);

    void writing;
    texture.needsUpdate = true;
  }

  draw({ subject: '', email: '', message: '' }, 'subject', false, false);
  return { texture, draw, hitTest };
}
