import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
const glyphs = text => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)];

// jsdom has no layout. Supply deterministic character rectangles with wrapping;
// the browser checks cover actual font metrics, scrolling, and viewport sizes.
function mount(t, body, redactionStyle = 'full') {
  const frames = [];
  const dom = new JSDOM(html, {
    url: 'https://linebyline.test/', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(win) {
      win.ResizeObserver = class { observe() {} };
      win.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
      win.scrollBy = () => {};
      win.HTMLElement.prototype.setPointerCapture = () => {};
      win.localStorage.setItem('line-by-line-memorize:script', body);
      win.localStorage.setItem('line-by-line-memorize:omit', '2');
      win.localStorage.setItem('line-by-line-memorize:redaction-style', redactionStyle);
      win.HTMLElement.prototype.getBoundingClientRect = function () {
        if (this.matches('.practice-line')) return rect(10, 100 + Number(this.dataset.line) * 200, 120, Math.max(1, Math.ceil(glyphs(this.textContent).length / 12)) * 20);
        return rect(0, 0, 200, 500);
      };
      win.Range.prototype.getClientRects = function () {
        const node = this.startContainer, row = node.parentElement?.closest('.practice-line');
        if (!row || node.nodeType !== win.Node.TEXT_NODE) return [];
        const walker = win.document.createTreeWalker(row, win.NodeFilter.SHOW_TEXT);
        let before = '', current;
        while ((current = walker.nextNode()) && current !== node) before += current.textContent;
        const column = glyphs(before + node.textContent.slice(0, this.startOffset)).length;
        return [rect(10 + column % 12 * 10, 100 + Number(row.dataset.line) * 200 + Math.floor(column / 12) * 20, 10, 20)];
      };
      // Reproduce browsers that skip redaction bars and hit the first line instead.
      win.document.caretRangeFromPoint = () => {
        const range = win.document.createRange();
        range.setStart(win.document.querySelector('.practice-line').firstChild, 0);
        return range;
      };
    },
  });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  function click(rowIndex, localOffset, target) {
    const row = document.querySelectorAll('.practice-line')[rowIndex];
    const column = glyphs(row.textContent.slice(0, localOffset)).length;
    (target || row).dispatchEvent(new dom.window.MouseEvent('dblclick', {
      bubbles: true, cancelable: true,
      clientX: 10 + column % 12 * 10 + 2,
      clientY: 100 + rowIndex * 200 + Math.floor(column / 12) * 20 + 10,
    }));
    return document.querySelector('.inline-editor');
  }
  return { dom, document, frames, click };
}

for (const style of ['full', 'half', 'first-letter']) {
  test(`double-click maps a ${style} redaction to its source word despite incorrect native hit-testing`, t => {
    const body = 'repeated words here\n\n  repeated repeated repeated TargetWord';
    const f = mount(t, body, style), row = f.document.querySelectorAll('.practice-line')[2];
    const wordStart = row.textContent.indexOf('TargetWord');
    // Pick a character inside the hidden suffix in every mode.
    const editor = f.click(2, wordStart + 7, row.querySelector('.word-hidden:last-child'));
    assert.equal(editor.selectionStart, body.indexOf('TargetWord') + 7);
    assert.equal(editor.selectionEnd, editor.selectionStart);
    assert.equal(editor.value, body);
  });
}

test('visible wrapped words after emoji, repeated text, tabs, and blank lines keep their exact UTF-16 offset', t => {
  const body = 'repeated repeated\n\n  😀e\u0301\trepeated repeated repeated destination ending';
  const f = mount(t, body), row = f.document.querySelectorAll('.practice-line')[2];
  const local = row.textContent.indexOf('repeated', row.textContent.indexOf('repeated') + 1) + 3;
  const editor = f.click(2, local);
  assert.equal(editor.selectionStart, body.lastIndexOf('\n') + 1 + local);
  assert.equal(editor.value, body);
});

test('double-clicking a blank line edits that line and preserves all intentional newlines', t => {
  const f = mount(t, 'One\n\n\nTwo'), editor = f.click(1, 0);
  assert.equal(editor.selectionStart, 4);
  editor.setRangeText('Inserted');
  editor.dispatchEvent(new f.dom.window.Event('input'));
  editor.blur();
  assert.equal(f.dom.window.lineByLineApp.getState().body, 'One\nInserted\n\nTwo');
});

test('clicks in preview padding use the closest line rather than the start of the file', t => {
  const body = 'First\nSecond\nThird';
  const f = mount(t, body), editor = f.click(2, 2, f.document.getElementById('preview'));
  assert.equal(editor.selectionStart, body.indexOf('Third') + 2);
});

test('the deferred caret correction never overrides a subsequent keypress or edit', t => {
  const f = mount(t, 'First\nSecond line'), editor = f.click(1, 2);
  editor.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'End' }));
  editor.setSelectionRange(editor.value.length, editor.value.length);
  for (const callback of f.frames.splice(0)) callback();
  assert.equal(editor.selectionStart, editor.value.length);
});

function pointer(f, target, type, { pointerId = 1, button = 0, isPrimary = true } = {}) {
  const event = new f.dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button });
  Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: isPrimary } });
  target.dispatchEvent(event);
}

for (const practice of [false, true]) {
  test(`hold inside the script peeks only while pressed in ${practice ? 'practice' : 'normal'} mode`, t => {
    const f = mount(t, 'First line with answers\nSecond line with answers');
    if (practice) f.document.getElementById('toggleEditor').click();
    const preview = f.document.getElementById('preview'), word = preview.querySelector('.word-hidden');
    const hiddenCount = preview.querySelectorAll('.word-hidden').length;
    pointer(f, word, 'pointerdown');
    assert.equal(preview.querySelectorAll('.revealed').length, hiddenCount);
    assert.equal(word.isConnected, true, 'Peeking must preserve the double-click target');
    assert.equal(word.getAttribute('aria-label'), word.textContent);
    pointer(f, preview, 'pointerup');
    assert.equal(preview.querySelectorAll('.revealed').length, 0);
    assert.equal(word.getAttribute('aria-label'), 'hidden text');
    assert.equal(f.document.getElementById('omit').value, '2');
    assert.equal(f.dom.window.lineByLineApp.getState().body, 'First line with answers\nSecond line with answers');
  });
}

for (const release of ['pointercancel', 'lostpointercapture', 'blur']) {
  test(`${release} cannot leave normal-mode answers revealed`, t => {
    const f = mount(t, 'First line with answers'), preview = f.document.getElementById('preview');
    pointer(f, preview, 'pointerdown');
    assert.ok(preview.querySelector('.revealed'));
    if (release === 'blur') f.dom.window.dispatchEvent(new f.dom.window.Event('blur'));
    else pointer(f, preview, release);
    assert.equal(preview.querySelectorAll('.revealed').length, 0);
  });
}

test('secondary clicks and other pointers do not interfere with the active hold', t => {
  const f = mount(t, 'First line with answers'), preview = f.document.getElementById('preview');
  pointer(f, preview, 'pointerdown', { button: 2 });
  assert.equal(preview.querySelector('.revealed'), null);
  pointer(f, preview, 'pointerdown');
  pointer(f, preview, 'pointerdown', { pointerId: 2, isPrimary: false });
  pointer(f, preview, 'pointerup', { pointerId: 2, isPrimary: false });
  assert.ok(preview.querySelector('.revealed'));
  pointer(f, preview, 'pointerup');
  assert.equal(preview.querySelector('.revealed'), null);
});

test('two press/release clicks still open the editor at the clicked word', t => {
  const body = 'First repeated line\n\nSecond repeated line with answers';
  const f = mount(t, body), row = f.document.querySelectorAll('.practice-line')[2], word = row.querySelector('.word-hidden');
  for (let i = 0; i < 2; i++) { pointer(f, word, 'pointerdown'); pointer(f, word, 'pointerup'); }
  const editor = f.click(2, row.textContent.indexOf('with') + 1, word);
  assert.equal(editor.selectionStart, body.indexOf('with') + 1);
  assert.equal(editor.value, body);
  // The editor is a separate control and keeps normal selection and input behavior.
  pointer(f, editor, 'pointerdown');
  assert.equal(f.document.querySelector('.inline-editor'), editor);
});

for (const style of ['full', 'half', 'first-letter']) {
  test(`practice double-click edits a ${style} redaction at the clicked character and Escape saves without leaving practice`, t => {
    const body = 'First repeated line\n\nSecond repeated line with answers';
    const f = mount(t, body, style);
    f.document.getElementById('toggleEditor').click();
    const preview = f.document.getElementById('preview');
    preview.scrollTop = 120;
    const row = preview.querySelectorAll('.practice-line')[2], word = row.querySelector('.word-hidden:last-child');
    for (let i = 0; i < 2; i++) { pointer(f, word, 'pointerdown'); pointer(f, word, 'pointerup'); }
    const editor = f.click(2, row.textContent.indexOf('answers') + 5, word);
    assert.ok(editor);
    assert.equal(editor.selectionStart, body.indexOf('answers') + 5);
    assert.equal(f.document.body.classList.contains('practice-mode'), true);
    assert.equal(f.document.getElementById('autoScroll').hidden, true);
    editor.setRangeText('EDIT');
    editor.dispatchEvent(new f.dom.window.Event('input'));
    editor.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    const expected = body.replace('answers', 'answeEDITrs');
    assert.equal(f.document.querySelector('.inline-editor'), null);
    assert.equal(f.document.body.classList.contains('practice-mode'), true);
    assert.equal(f.dom.window.lineByLineApp.getState().body, expected);
    assert.equal(f.dom.window.localStorage.getItem('line-by-line-memorize:script'), expected);
    assert.equal(preview.scrollTop, 120);
    assert.equal(f.document.getElementById('omit').value, '2');
    assert.equal(preview.querySelectorAll('.revealed').length, 0);
    f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(f.document.body.classList.contains('practice-mode'), false);
  });
}

test('practice editing pauses auto-scroll, preserves typing shortcuts, and saves on exit', t => {
  const f = mount(t, 'First line\nSecond line with answers');
  f.document.getElementById('toggleEditor').click();
  const autoScroll = f.document.getElementById('autoScroll');
  Object.defineProperty(f.document.getElementById('preview'), 'scrollHeight', { value: 2000 });
  f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));
  autoScroll.click();
  assert.equal(autoScroll.getAttribute('aria-pressed'), 'true');
  const editor = f.click(1, 2);
  assert.equal(autoScroll.getAttribute('aria-pressed'), 'false');
  for (const key of ['ArrowUp', 'ArrowRight', ' ', '+']) {
    const event = new f.dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ctrlKey: key === '+' });
    editor.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  editor.setRangeText('EDIT');
  f.document.getElementById('exitPractice').click();
  assert.equal(f.document.querySelector('.inline-editor'), null);
  assert.equal(f.document.body.classList.contains('practice-mode'), false);
  assert.equal(f.dom.window.lineByLineApp.getState().body, 'First line\nSeEDITcond line with answers');
  assert.equal(f.document.getElementById('omit').value, '2');
});

for (const [style, visible] of [
  ['full', ['“,”', "'", '—...', '(!)', '「，！」']],
  ['half', ['“Hel,”', "ca'", 'stop—...', '(aga!)', '「你好，！」']],
  ['first-letter', ['“H,”', "c'", 's—...', '(a!)', '「你，！」']],
]) {
  test(`${style} redaction preserves punctuation and counts hints from word characters`, t => {
    const words = ['“Hello,”', "can't", 'stop—now...', '(again!)', '「你好，世界！」'];
    const body = words.join('  \t');
    const f = mount(t, body, style), slider = f.document.getElementById('omit');
    slider.value = slider.max;
    slider.dispatchEvent(new f.dom.window.Event('input'));
    const preview = f.document.getElementById('preview');
    assert.equal(preview.textContent, body, 'Source characters and whitespace must remain in order');
    for (const hidden of preview.querySelectorAll('.word-hidden')) assert.doesNotMatch(hidden.textContent, /\p{P}/u);
    const shown = preview.cloneNode(true);
    for (const hidden of shown.querySelectorAll('.word-hidden')) hidden.remove();
    assert.equal(shown.textContent, visible.join('  \t'));
    pointer(f, preview, 'pointerdown');
    assert.equal(preview.querySelectorAll('.revealed').length, preview.querySelectorAll('.word-hidden').length);
    pointer(f, preview, 'pointerup');
    assert.equal(preview.querySelector('.revealed'), null);
  });
}

test('standalone punctuation stays visible without adding redaction steps', t => {
  const f = mount(t, 'First — second ... third!'), slider = f.document.getElementById('omit');
  assert.equal(slider.max, '3');
  slider.value = '1';
  slider.dispatchEvent(new f.dom.window.Event('input'));
  const preview = f.document.getElementById('preview'), shown = preview.cloneNode(true);
  for (const hidden of shown.querySelectorAll('.word-hidden')) hidden.remove();
  assert.equal(shown.textContent, 'First — second ... !');
  assert.equal(preview.querySelector('.word-hidden').textContent, 'third');
  assert.equal(f.document.getElementById('amount').textContent, '1 word redacted');
});

test('punctuation-only lines require no redaction and never show a peek button', t => {
  const f = mount(t, '... — !!!\n“” ()'), slider = f.document.getElementById('omit');
  assert.equal(slider.max, '0');
  assert.equal(f.document.querySelector('.word-hidden'), null);
  assert.equal(f.document.getElementById('reveal').hidden, true);
  assert.equal(f.document.getElementById('preview').children[0].textContent, '... — !!!');
});

test('double-clicking preserved punctuation keeps its exact source offset in practice', t => {
  const body = 'First line\n“can\'t,” stop—now!';
  const f = mount(t, body);
  f.document.getElementById('toggleEditor').click();
  const editor = f.click(1, body.split('\n')[1].indexOf(','));
  assert.equal(editor.selectionStart, body.indexOf(','));
  assert.equal(editor.value, body);
});

test('empty and whitespace-only scripts stay editable with a placeholder and disabled practice', t => {
  const f = mount(t, '   \n  '), editor = f.document.querySelector('.inline-editor');
  assert.ok(editor);
  assert.equal(editor.value, '');
  assert.equal(editor.placeholder, 'Add your script here to start practicing.');
  assert.equal(f.document.getElementById('toggleEditor').disabled, true);
  editor.value = '  \n  ';
  editor.dispatchEvent(new f.dom.window.Event('input'));
  editor.blur();
  assert.equal(editor.value, '');
  assert.equal(f.dom.window.localStorage.getItem('line-by-line-memorize:script'), '');
  assert.equal(f.document.getElementById('reveal').disabled, true);
  editor.value = 'Hello!';
  editor.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(f.document.getElementById('toggleEditor').disabled, false);
  editor.focus();
  editor.blur();
  assert.equal(f.document.getElementById('preview').textContent, 'Hello!');
});

test('loading another script replaces an empty editor', t => {
  const f = mount(t, '');
  f.dom.window.lineByLineApp.loadState({body:'Loaded script!', redaction:0});
  assert.equal(f.document.querySelector('.inline-editor'), null);
  assert.equal(f.document.getElementById('preview').textContent, 'Loaded script!');
});


test('one word enables the slider while entering a previously empty script', t => {
  const f = mount(t, ''), editor = f.document.querySelector('.inline-editor'), slider = f.document.getElementById('omit');
  editor.value = 'Hello!';
  editor.dispatchEvent(new f.dom.window.Event('input'));
  assert.equal(slider.disabled, false);
  assert.equal(slider.max, '1');
  editor.focus(); editor.blur();
  slider.value = '1'; slider.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  assert.equal(f.document.querySelector('.word-hidden').textContent, 'Hello');
  assert.equal(f.document.getElementById('amount').textContent, '1 word redacted');
});
