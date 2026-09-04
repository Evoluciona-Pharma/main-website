/*
 * Casa Pharma RX — multi-step forms (front end)
 *
 * Behaviour only; the markup in the HTML files is the spec. Handles:
 *   - showing one step at a time, progress segments and "Step 1 of 4"
 *   - Back / Continue, Enter to advance, focus on the step heading
 *   - validation on Continue with per-field messages from data-* attributes
 *   - selected-state classes for choice buttons, tile counter, "Other" hint
 *   - a draft in sessionStorage so a reload resumes on the same step
 *   - submit: no network in this prototype; shows the confirmation panel
 *     and logs the payload to the console
 */
(function () {
  'use strict';

  var STORAGE_PREFIX = 'casa-form-';

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function storage() {
    try { return window.sessionStorage; } catch (e) { return null; }
  }

  function StepForm(form) {
    this.form = form;
    this.id = form.getAttribute('data-form-id') || 'form';
    this.steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
    this.segments = Array.prototype.slice.call(form.querySelectorAll('.progress__segments li'));
    this.trackItems = Array.prototype.slice.call(form.querySelectorAll('.progress__track li'));
    this.fill = form.querySelector('.progress__fill');
    this.progressText = form.querySelector('[data-progress-text]');
    this.progressTitle = form.querySelector('[data-progress-title]');
    this.confirmation = document.querySelector('[data-confirmation-for="' + this.id + '"]');
    this.current = 0;
    this.maxReached = 0;
    this.sent = false;

    var self = this;
    this.steps.forEach(function (step, index) {
      var back = step.querySelector('[data-back]');
      var next = step.querySelector('[data-next]');
      if (back) { back.addEventListener('click', function () { self.goTo(index - 1); }); }
      if (next) { next.addEventListener('click', function () { self.goTo(index + 1); }); }
    });
    /* Optional clickable step track (version 1): completed steps can be revisited */
    this.trackItems.forEach(function (item, index) {
      var button = item.querySelector('button');
      if (button) { button.addEventListener('click', function () { self.goTo(index); }); }
    });

    form.addEventListener('keydown', function (event) { self.onKeydown(event); });
    form.addEventListener('input', function (event) { self.onEdit(event); });
    form.addEventListener('change', function (event) { self.onEdit(event); });
    form.addEventListener('submit', function (event) { self.onSubmit(event); });

    /* Date of birth can never be in the future */
    form.querySelectorAll('input[type="date"][data-max="today"]').forEach(function (input) {
      input.max = new Date().toISOString().slice(0, 10);
    });

    form.querySelectorAll('.choice').forEach(function (choice) { self.syncChoice(choice); });
    form.querySelectorAll('[data-count]').forEach(function (node) { self.updateCount(node.closest('.field')); });
    form.querySelectorAll('[data-hint-for]').forEach(function (hint) { self.updateHint(hint); });

    this.restoreDraft();
    this.show(this.current, { focus: false, scroll: false });
    form.classList.add('is-ready');
  }

  /* ---------- navigation ---------- */

  StepForm.prototype.goTo = function (target) {
    if (this.sent || target < 0 || target >= this.steps.length || target === this.current) { return; }
    if (target > this.current) {
      for (var i = this.current; i < target; i++) {
        if (!this.validateStep(i, { focus: true })) {
          if (i !== this.current) { this.show(i, { focus: false, scroll: true }); }
          return;
        }
      }
    }
    this.show(target, { focus: true, scroll: true });
  };

  StepForm.prototype.show = function (index, opts) {
    var total = this.steps.length;
    this.current = index;
    this.maxReached = Math.max(this.maxReached, index);

    this.steps.forEach(function (step, i) {
      step.hidden = i !== index;
      if (i !== index) {
        var alert = step.querySelector('.step__alert');
        if (alert) { alert.hidden = true; }
      }
    });
    this.segments.forEach(function (seg, i) {
      seg.classList.toggle('is-done', i < index);
      seg.classList.toggle('is-current', i === index);
    });
    if (this.progressText) { this.progressText.textContent = 'Step ' + (index + 1) + ' of ' + total; }

    var title = this.steps[index].querySelector('.step__title');
    var self = this;
    this.trackItems.forEach(function (item, i) {
      item.classList.toggle('is-current', i === index);
      item.classList.toggle('is-done', i < index);
      if (i === index) { item.setAttribute('aria-current', 'step'); } else { item.removeAttribute('aria-current'); }
      var button = item.querySelector('button');
      if (button) { button.disabled = i > self.maxReached; }
    });
    if (this.fill) { this.fill.style.width = Math.round(((index + 1) / total) * 100) + '%'; }
    if (this.progressTitle && title) { this.progressTitle.textContent = title.textContent.trim(); }
    if (opts.scroll) {
      var top = this.form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: window.pageYOffset + top - 32, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }
    if (opts.focus && title) { title.focus({ preventScroll: true }); }
    this.saveDraftSoon();
  };

  StepForm.prototype.onKeydown = function (event) {
    if (event.key !== 'Enter' || event.defaultPrevented) { return; }
    var target = event.target;
    if (!target || target.tagName !== 'INPUT') { return; }
    if (['text', 'email', 'tel', 'number', 'date', 'url', 'search'].indexOf(target.type) === -1) { return; }
    if (this.current >= this.steps.length - 1) { return; }
    event.preventDefault();
    this.goTo(this.current + 1);
  };

  /* ---------- editing ---------- */

  StepForm.prototype.onEdit = function (event) {
    var target = event.target;
    var field = target.closest('.field');
    if (field) {
      if (event.type === 'change' || (target.type !== 'checkbox' && target.type !== 'radio')) { this.clearError(field); }
      var choice = target.closest('.choice');
      if (choice) {
        var self = this;
        field.querySelectorAll('.choice').forEach(function (node) { self.syncChoice(node); });
      }
      this.updateCount(field);
      var hint = field.querySelector('[data-hint-for]');
      if (hint) { this.updateHint(hint); }
    }
    this.saveDraftSoon();
  };

  StepForm.prototype.syncChoice = function (choice) {
    var input = choice.querySelector('input');
    choice.classList.toggle('is-checked', !!(input && input.checked));
  };

  StepForm.prototype.updateCount = function (field) {
    var node = field && field.querySelector('[data-count]');
    if (!node) { return; }
    var n = field.querySelectorAll('input:checked').length;
    node.textContent = n === 0 ? 'None selected' : n + ' selected';
  };

  StepForm.prototype.updateHint = function (hint) {
    var wanted = hint.getAttribute('data-hint-for');
    var field = hint.closest('.field');
    var on = Array.prototype.some.call(field.querySelectorAll('input:checked'), function (input) { return input.value === wanted; });
    hint.hidden = !on;
  };

  /* ---------- validation ---------- */

  StepForm.prototype.validateStep = function (index, opts) {
    var self = this;
    var step = this.steps[index];
    var fields = Array.prototype.slice.call(step.querySelectorAll('.field'));
    var problems = [];

    fields.forEach(function (field) {
      var message = self.validateField(field);
      if (message) {
        problems.push({ field: field, message: message });
        if (!opts.silent) { self.showError(field, message); }
      } else if (!opts.silent) {
        self.clearError(field);
      }
    });
    if (opts.silent) { return problems.length === 0; }

    var alert = step.querySelector('.step__alert');
    if (problems.length) {
      if (alert) {
        alert.textContent = problems.length === 1 ? 'Please fix the field highlighted below.' : 'Please fix the ' + problems.length + ' fields highlighted below.';
        alert.hidden = false;
      }
      if (opts.focus) { this.focusField(problems[0].field); }
      return false;
    }
    if (alert) { alert.hidden = true; }
    return true;
  };

  StepForm.prototype.validateField = function (field) {
    var required = field.querySelector('[required]') !== null || field.hasAttribute('data-required');
    var msgRequired = field.getAttribute('data-message-required') || 'This field is required.';
    var msgInvalid = field.getAttribute('data-message-invalid') || 'Please check this field.';

    /* choice groups (checkbox / radio) */
    var boxes = field.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    if (boxes.length) {
      var min = parseInt(field.getAttribute('data-min') || (required ? '1' : '0'), 10);
      if (field.querySelectorAll('input:checked').length < min) { return msgRequired; }
      return null;
    }

    var control = field.querySelector('input, select, textarea');
    if (!control) { return null; }
    var value = (control.value || '').trim();
    if (!value) { return required ? msgRequired : null; }

    if (control.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { return msgInvalid; }
    if (control.type === 'tel') {
      var digits = value.replace(/\D/g, '');
      var minDigits = parseInt(control.getAttribute('data-min-digits') || '10', 10);
      if (digits.length < minDigits || digits.length > 15 || /[^0-9\s()+.\-]/.test(value)) { return msgInvalid; }
    }
    if (control.type === 'number') {
      var n = Number(value);
      if (!/^-?\d+$/.test(value) || (control.min !== '' && n < Number(control.min)) || (control.max !== '' && n > Number(control.max))) { return msgInvalid; }
    }
    if (control.type === 'date') {
      var parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
      var valid = date && !isNaN(date.getTime()) && date.getMonth() === Number(parts[2]) - 1;
      if (!valid || (control.max && value > control.max) || (control.min && value < control.min)) { return msgInvalid; }
    }
    return null;
  };

  StepForm.prototype.showError = function (field, message) {
    var note = field.querySelector('.field__error');
    if (!note) { return; }
    note.textContent = message;
    note.hidden = false;
    field.classList.add('is-invalid');
    field.querySelectorAll('input, select, textarea').forEach(function (control) {
      control.setAttribute('aria-invalid', 'true');
      if (note.id) { control.setAttribute('aria-describedby', note.id); }
    });
  };

  StepForm.prototype.clearError = function (field) {
    var note = field.querySelector('.field__error');
    if (note) { note.hidden = true; note.textContent = ''; }
    field.classList.remove('is-invalid');
    field.querySelectorAll('[aria-invalid]').forEach(function (control) {
      control.setAttribute('aria-invalid', 'false');
      control.removeAttribute('aria-describedby');
    });
    var step = field.closest('.step');
    var alert = step && step.querySelector('.step__alert');
    if (alert && !step.querySelector('.field.is-invalid')) { alert.hidden = true; }
  };

  StepForm.prototype.focusField = function (field) {
    var control = field.querySelector('input:not([type="hidden"]), select, textarea');
    if (!control) { return; }
    control.focus({ preventScroll: true });
    var rect = field.getBoundingClientRect();
    if (rect.top < 24 || rect.bottom > window.innerHeight) {
      window.scrollTo({ top: window.pageYOffset + rect.top - 40, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  };

  /* ---------- submit ---------- */

  StepForm.prototype.onSubmit = function (event) {
    event.preventDefault();
    if (this.sent) { return; }
    if (!this.validateStep(this.current, { focus: true })) { return; }

    var self = this;
    var data = new FormData(this.form);
    var entries = [];
    data.forEach(function (value, key) { entries.push([key, value]); });
    console.log('[casa-forms] submit ' + this.id, entries);

    this.form.classList.add('is-sending');
    window.setTimeout(function () {
      self.form.classList.remove('is-sending');
      self.sent = true;
      self.clearDraft();
      self.form.hidden = true;
      if (self.confirmation) {
        self.confirmation.hidden = false;
        var top = self.confirmation.getBoundingClientRect().top;
        if (top < 24 || top > window.innerHeight * 0.5) {
          window.scrollTo({ top: window.pageYOffset + top - 32, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }
        self.confirmation.focus({ preventScroll: true });
      }
    }, 900);
  };

  /* ---------- draft ---------- */

  StepForm.prototype.collect = function () {
    var values = {};
    this.form.querySelectorAll('.field input, .field select, .field textarea').forEach(function (control) {
      if (!control.name || control.type === 'hidden' || control.closest('.consent')) { return; }
      if (control.type === 'checkbox' || control.type === 'radio') {
        if (!values[control.name]) { values[control.name] = []; }
        if (control.checked) { values[control.name].push(control.value); }
      } else {
        values[control.name] = control.value;
      }
    });
    return values;
  };

  StepForm.prototype.saveDraftSoon = function () {
    var self = this;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(function () { self.saveDraft(); }, 150);
  };

  StepForm.prototype.saveDraft = function () {
    var store = storage();
    if (!store || this.sent) { return; }
    try { store.setItem(STORAGE_PREFIX + this.id, JSON.stringify({ step: this.current, values: this.collect() })); } catch (e) { /* ignore */ }
  };

  StepForm.prototype.clearDraft = function () {
    var store = storage();
    if (!store) { return; }
    try { store.removeItem(STORAGE_PREFIX + this.id); } catch (e) { /* ignore */ }
  };

  StepForm.prototype.restoreDraft = function () {
    var store = storage();
    if (!store) { return; }
    var draft = null;
    try { draft = JSON.parse(store.getItem(STORAGE_PREFIX + this.id) || 'null'); } catch (e) { return; }
    if (!draft || !draft.values) { return; }

    var self = this;
    this.form.querySelectorAll('.field input, .field select, .field textarea').forEach(function (control) {
      if (!control.name || control.type === 'hidden' || control.closest('.consent') || !(control.name in draft.values)) { return; }
      var saved = draft.values[control.name];
      if (control.type === 'checkbox' || control.type === 'radio') {
        control.checked = Array.isArray(saved) && saved.indexOf(control.value) !== -1;
      } else {
        control.value = saved;
      }
    });
    this.form.querySelectorAll('.choice').forEach(function (choice) { self.syncChoice(choice); });
    this.form.querySelectorAll('[data-count]').forEach(function (node) { self.updateCount(node.closest('.field')); });
    this.form.querySelectorAll('[data-hint-for]').forEach(function (hint) { self.updateHint(hint); });

    var target = Math.min(Number(draft.step) || 0, this.steps.length - 1);
    for (var i = 0; i < target; i++) {
      if (!this.validateStep(i, { silent: true })) { target = i; break; }
    }
    this.current = target;
    this.maxReached = target;
  };

  /* ---------- boot ---------- */

  document.querySelectorAll('form[data-steps]').forEach(function (form) { new StepForm(form); });
})();
