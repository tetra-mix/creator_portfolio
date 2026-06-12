import type { LetterCanvas, LetterField, LetterStatus, LetterValues } from './letterCanvas';

// Formspree endpoint for this site's contact form.
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xvznvpqz';

// Letter writing controller. No modal: the user writes directly onto the 3D
// sheet, which has three fields (subject / email / message) plus a Send button.
// A single hidden <textarea> captures keystrokes for whichever field is active;
// tapping a region on the paper switches the active field (driven from
// interactions.ts via the canvas hitTest).
export interface LetterWriter {
  // Enter writing mode and focus the given field (opens the mobile keyboard).
  begin(field?: LetterField): void;
  // Switch the active field (e.g. the user tapped another region).
  focusField(field: LetterField): void;
  // Submit the letter to Formspree. `onSent` runs once on a successful send
  // (used to play the "letter flies off" animation). No-op while already
  // sending or already sent (prevents duplicate submissions).
  submit(onSent?: () => void): void;
  // Clear all fields back to a blank, idle letter (after a successful post).
  reset(): void;
  // Leave writing mode.
  end(): void;
  dispose(): void;
}

export function createLetterWriter(letter: LetterCanvas): LetterWriter {
  const values: LetterValues = { subject: '', email: '', message: '' };
  let active: LetterField = 'subject';
  let writing = false;
  let caretOn = true;
  let blinkTimer = 0;
  let status: LetterStatus = 'idle';

  // One hidden, focusable textarea reused for every field. Parked at the corner,
  // invisible, but a real input so desktop focus + the mobile keyboard work.
  const input = document.createElement('textarea');
  input.id = 'letter-input';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Write your message');
  input.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:1px',
    'height:1px',
    'opacity:0',
    'color:transparent',
    'background:transparent',
    'caret-color:transparent',
    'border:0',
    'outline:none',
    'padding:0',
    'margin:0',
    'resize:none',
    'overflow:hidden',
    'z-index:5',
  ].join(';');
  document.body.appendChild(input);

  const render = () => letter.draw(values, active, writing && caretOn, writing, status);

  // Email/subject are single-line: collapse newlines as the user types.
  const onInput = () => {
    caretOn = true;
    const v = active === 'message' ? input.value : input.value.replace(/\n/g, '');
    values[active] = v;
    // Editing after a send/error clears the status so the button returns to idle.
    if (status === 'sent' || status === 'error') status = 'idle';
    render();
  };
  input.addEventListener('input', onInput);

  // Enter advances subject -> email -> message (message keeps newlines).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && active !== 'message') {
      e.preventDefault();
      focusField(active === 'subject' ? 'email' : 'message');
    }
  };
  input.addEventListener('keydown', onKeyDown);

  // Keep focus on the field while writing so desktop typing never silently stops.
  const onFocusOut = () => {
    if (!writing) return;
    window.setTimeout(() => {
      if (writing) input.focus({ preventScroll: true });
    }, 0);
  };
  input.addEventListener('focusout', onFocusOut);

  const startBlink = () => {
    window.clearInterval(blinkTimer);
    caretOn = true;
    render();
    blinkTimer = window.setInterval(() => {
      caretOn = !caretOn;
      render();
    }, 530);
  };
  const stopBlink = () => {
    window.clearInterval(blinkTimer);
    blinkTimer = 0;
  };

  function focusField(field: LetterField) {
    active = field;
    input.value = values[field];
    // Move the textarea caret to the end of the existing content.
    const len = input.value.length;
    input.setSelectionRange(len, len);
    input.focus({ preventScroll: true });
    caretOn = true;
    render();
  }

  return {
    begin(field: LetterField = 'subject') {
      writing = true;
      focusField(field); // focus() runs in the tap gesture -> mobile keyboard
      startBlink();
    },
    focusField,
    submit(onSent?: () => void) {
      // Block while a request is in flight AND after a success, so the in-flight
      // letter (which is flying off) can't be submitted again.
      if (status === 'sending' || status === 'sent') return;

      // Minimal client-side validation; mirror what Formspree expects.
      const email = values.email.trim();
      const message = values.message.trim();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk || !message) {
        status = 'error';
        // Re-enter writing mode and focus the field that needs fixing so the
        // caret blinks and keystrokes are captured even if Send was tapped
        // after focus was lost.
        writing = true;
        focusField(!emailOk ? 'email' : 'message');
        startBlink();
        return;
      }

      status = 'sending';
      // Stop editing UI while the request is in flight.
      writing = false;
      input.blur();
      stopBlink();
      render();

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          subject: values.subject.trim() || '(no subject)',
          email,
          message,
          // To harden against spam later, add Formspree's honeypot ("_gotcha":
          // "") or a reCAPTCHA token here.
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Formspree responded ${res.status}`);
          status = 'sent';
          render();
          onSent?.();
        })
        .catch((err) => {
          console.error('[contact] send failed', err);
          status = 'error';
          render();
        });
    },
    reset() {
      values.subject = '';
      values.email = '';
      values.message = '';
      active = 'subject';
      writing = false;
      status = 'idle';
      input.value = '';
      input.blur();
      stopBlink();
      render();
    },
    end() {
      writing = false;
      input.blur();
      stopBlink();
      render();
    },
    dispose() {
      stopBlink();
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('focusout', onFocusOut);
      input.remove();
    },
  };
}
