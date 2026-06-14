import * as THREE from 'three';

// Which part of the letter a tap landed on. A field moves the caret there;
// null is a tap on dead space. (Sending happens by clicking the desk post.)
export type LetterField = 'subject' | 'email' | 'message';
export type LetterHit = LetterField | null;

// Submission lifecycle. Surfaced via a separate status toast (see contactForm),
// not on the sheet itself.
export type LetterStatus = 'idle' | 'sending' | 'sent' | 'error';

export interface LetterValues {
  subject: string;
  email: string;
  message: string;
}

export interface LetterCanvas {
  texture: THREE.CanvasTexture;
  // Redraw the whole sheet for the given field values, highlighting `active`
  // and blinking its caret when `caretVisible`.
  draw(values: LetterValues, active: LetterField, caretVisible: boolean, writing: boolean): void;
  // Map a UV hit (three.js convention: v=0 bottom) to a field or null.
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
  messageBottom: 398, // runs to near the bottom (no Send button anymore)
};

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

  // Tap regions in pixel space; converted to UV in hitTest. Each field's band
  // extends to meet the next field's label so there are no dead gaps between
  // them — every tap on the sheet lands in the nearest field, which matters
  // because the tilted letter makes precise tapping harder in letter mode.
  const SUBJECT_EMAIL_SPLIT = (LAYOUT.subjectBottom + (LAYOUT.emailLabelY - 8)) / 2;
  const EMAIL_MSG_SPLIT = (LAYOUT.emailBottom + (LAYOUT.messageLabelY - 8)) / 2;
  const regions: Array<{ field: LetterHit; x0: number; y0: number; x1: number; y1: number }> = [
    {
      field: 'subject',
      x0: MARGIN_X,
      y0: 0,
      x1: LOGICAL_W - MARGIN_X,
      y1: SUBJECT_EMAIL_SPLIT,
    },
    {
      field: 'email',
      x0: MARGIN_X,
      y0: SUBJECT_EMAIL_SPLIT,
      x1: LOGICAL_W - MARGIN_X,
      y1: EMAIL_MSG_SPLIT,
    },
    {
      field: 'message',
      x0: MARGIN_X,
      y0: EMAIL_MSG_SPLIT,
      x1: LOGICAL_W - MARGIN_X,
      y1: LOGICAL_H,
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

  function draw(
    values: LetterValues,
    active: LetterField,
    caretVisible: boolean,
    writing: boolean,
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
    c.fillText('お問い合わせ (Contact)', MARGIN_X, LAYOUT.headerY);
    c.strokeStyle = 'rgba(150, 120, 80, 0.4)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(MARGIN_X, LAYOUT.headerY + 12);
    c.lineTo(LOGICAL_W - MARGIN_X, LAYOUT.headerY + 12);
    c.stroke();

    // --- Subject ---
    label('タイトル (Title)', LAYOUT.subjectLabelY, active === 'subject');
    underline(LAYOUT.subjectTop, LAYOUT.subjectBottom, active === 'subject');
    c.fillStyle = '#2f2a3a';
    c.font = TEXT_FONT;
    const subjY = LAYOUT.subjectBottom - 8;
    c.fillText(values.subject, MARGIN_X, subjY);
    if (active === 'subject' && caretVisible) {
      caretAt(MARGIN_X + c.measureText(values.subject).width + 1, subjY);
    }

    // --- Your e-mail address ---
    label('メールアドレス (E-mail Address)', LAYOUT.emailLabelY, active === 'email');
    underline(LAYOUT.emailTop, LAYOUT.emailBottom, active === 'email');
    c.fillStyle = '#2f2a3a';
    c.font = TEXT_FONT;
    const emailY = LAYOUT.emailBottom - 8;
    c.fillText(values.email, MARGIN_X, emailY);
    if (active === 'email' && caretVisible) {
      caretAt(MARGIN_X + c.measureText(values.email).width + 1, emailY);
    }

    // --- Message (ruled, multi-line) ---
    label('内容 (Message)', LAYOUT.messageLabelY, active === 'message');
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

    void writing;
    texture.needsUpdate = true;
  }

  draw({ subject: '', email: '', message: '' }, 'subject', false, false);
  return { texture, draw, hitTest };
}
