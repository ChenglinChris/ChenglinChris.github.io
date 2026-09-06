(() => {
  'use strict';

  const STORAGE_KEY = 'chenglin-liu-academic-homepage-v1';
  const editableSelector = '[data-edit-key]';
  const editableLinkSelector = '[data-edit-href]';
  let editing = false;
  let defaultState;
  let toastTimer;
  let collections;
  let defaultCollections;
  let workingCollections;
  let activeContentCategory = 'publications';
  let activeContentItemId = null;

  const categoryLabels = {
    publications: 'Publications',
    research: 'Research',
    education: 'Education',
    experience: 'Experience',
    service: 'Service',
    activities: 'Activities',
  };

  const contentSchemas = {
    publications: [
      { name: 'title', label: 'Title', type: 'textarea', wide: true, required: true },
      { name: 'authors', label: 'Authors', type: 'textarea', wide: true },
      { name: 'venue', label: 'Venue and year' },
      { name: 'statusLabel', label: 'Status label' },
      { name: 'statusGroup', label: 'Filter group', type: 'select', options: [['published', 'Published & accepted'], ['in-progress', 'In progress']] },
      { name: 'index', label: 'Display index' },
      { name: 'linkLabel', label: 'Link label' },
      { name: 'url', label: 'Paper, DOI, preprint, or code URL', type: 'url', wide: true },
    ],
    research: [
      { name: 'number', label: 'Display number' },
      { name: 'title', label: 'Title', wide: true, required: true },
      { name: 'body', label: 'Description', type: 'textarea', wide: true },
    ],
    education: [
      { name: 'time', label: 'Dates' },
      { name: 'title', label: 'Degree or programme', wide: true, required: true },
      { name: 'place', label: 'Institution and location', type: 'textarea', wide: true },
    ],
    experience: [
      { name: 'time', label: 'Dates' },
      { name: 'title', label: 'Position and organisation', wide: true, required: true },
      { name: 'url', label: 'Optional link', type: 'url', wide: true },
    ],
    service: [
      { name: 'time', label: 'Dates' },
      { name: 'title', label: 'Role and organisation', type: 'textarea', wide: true, required: true },
      { name: 'url', label: 'Optional link', type: 'url', wide: true },
    ],
    activities: [
      { name: 'type', label: 'Card type', type: 'select', options: [['image', 'Image card'], ['text', 'Text-only card']] },
      { name: 'layout', label: 'Grid layout', type: 'select', options: [['standard', 'Standard'], ['tall', 'Tall'], ['wide', 'Wide']] },
      { name: 'title', label: 'Activity name(s)', type: 'textarea', wide: true, required: true },
      { name: 'description', label: 'Description', type: 'textarea', wide: true },
      { name: 'imageSrc', label: 'Image path or HTTPS URL', wide: true },
      { name: 'alt', label: 'Image alternative text', wide: true },
    ],
  };

  const byId = (id) => document.getElementById(id);
  const editableElements = () => [...document.querySelectorAll(editableSelector)];
  const editableLinks = () => [...document.querySelectorAll(editableLinkSelector)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const makeId = (category) => `cms-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const text = (root, selector) => root.querySelector(selector)?.textContent.trim() || '';

  function extractCollections() {
    return {
      publications: [...document.querySelectorAll('.publication-list > [data-publication-id]')].map((item) => {
        const link = item.querySelector('.pub-links a');
        const statusPill = item.querySelector('.status-pill');
        return {
          id: item.dataset.blockId || item.dataset.publicationId,
          publicationId: item.dataset.publicationId,
          index: text(item, '.pub-index'),
          statusGroup: item.dataset.status || 'in-progress',
          statusLabel: statusPill?.textContent.trim() || '',
          statusTone: [...(statusPill?.classList || [])].find((name) => name !== 'status-pill') || '',
          venue: text(item, '.pub-meta span:last-child'),
          title: text(item, 'h3'),
          authors: text(item, '.authors'),
          url: link?.getAttribute('href') || '',
          linkLabel: link?.textContent.replace('↗', '').trim() || '',
          titleKey: item.querySelector('h3')?.dataset.editKey || '',
          authorsKey: item.querySelector('.authors')?.dataset.editKey || '',
          linkKey: link?.dataset.editHref || '',
          hidden: item.classList.contains('content-hidden'),
        };
      }),
      research: [...document.querySelectorAll('.interest-grid > article')].map((item) => ({
        id: item.dataset.blockId,
        number: text(item, '.interest-number'),
        title: text(item, 'h3'),
        body: text(item, 'p'),
        titleKey: item.querySelector('h3')?.dataset.editKey || '',
        bodyKey: item.querySelector('p')?.dataset.editKey || '',
        hidden: item.classList.contains('content-hidden'),
      })),
      education: [...document.querySelectorAll('.timeline > article')].map((item) => ({
        id: item.dataset.blockId,
        time: text(item, 'time'),
        title: text(item, 'h3'),
        place: text(item, 'p'),
        titleKey: item.querySelector('h3')?.dataset.editKey || '',
        placeKey: item.querySelector('p')?.dataset.editKey || '',
        hidden: item.classList.contains('content-hidden'),
      })),
      experience: extractSimpleList('.journey-columns > div:nth-child(1) .clean-list'),
      service: extractSimpleList('.journey-columns > div:nth-child(2) .clean-list'),
      activities: [...document.querySelectorAll('.hobby-grid > article')].map((item) => {
        const image = item.querySelector('img');
        const names = [...item.querySelectorAll('.activity-names h3')].map((heading) => heading.textContent.trim());
        const heading = item.querySelector('.hobby-caption h3');
        return {
          id: item.dataset.blockId,
          hobbyId: item.dataset.hobby || item.dataset.blockId,
          type: image ? 'image' : 'text',
          layout: item.classList.contains('tall') ? 'tall' : item.classList.contains('wide') ? 'wide' : 'standard',
          title: image ? heading?.textContent.trim() || '' : names.join('\n'),
          description: text(item, ':scope > p'),
          imageSrc: image?.getAttribute('src') || '',
          alt: image?.getAttribute('alt') || '',
          titleKey: heading?.dataset.editKey || '',
          descriptionKey: item.querySelector(':scope > p')?.dataset.editKey || '',
          hidden: item.classList.contains('content-hidden'),
        };
      }),
    };
  }

  function extractSimpleList(selector) {
    return [...document.querySelectorAll(`${selector} > li`)].map((item) => {
      const link = item.querySelector('a');
      const titleElement = item.querySelector('strong');
      return {
        id: item.dataset.blockId,
        time: text(item, ':scope > span'),
        title: titleElement?.textContent.trim() || '',
        url: link?.getAttribute('href') || '',
        titleKey: titleElement?.dataset.editKey || '',
        linkKey: link?.dataset.editHref || '',
        hidden: item.classList.contains('content-hidden'),
      };
    });
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function markManaged(node, item, label) {
    node.dataset.removable = '';
    node.dataset.blockId = item.id;
    node.dataset.blockLabel = label;
    node.classList.toggle('content-hidden', Boolean(item.hidden));
    return node;
  }

  function appendHighlightedName(node, authors) {
    const parts = String(authors || '').split(/(Chenglin Liu)/g);
    parts.forEach((part) => node.append(part === 'Chenglin Liu' ? element('strong', '', part) : document.createTextNode(part)));
  }

  function renderCollections() {
    if (!collections) return;
    renderPublications();
    renderResearch();
    renderEducation();
    renderSimpleList('experience', '.journey-columns > div:nth-child(1) .clean-list');
    renderSimpleList('service', '.journey-columns > div:nth-child(2) .clean-list');
    renderActivities();
    decorateRemovableBlocks();
    setEditing(editing);
  }

  function renderPublications() {
    const container = document.querySelector('.publication-list');
    container.replaceChildren(...collections.publications.map((item, position) => {
      const article = markManaged(element('article', 'publication'), item, `Publication — ${item.title}`);
      article.dataset.publicationId = item.publicationId || item.id;
      article.dataset.status = item.statusGroup || 'in-progress';
      article.append(element('div', 'pub-index', item.index || String(position + 1).padStart(2, '0')));
      const content = element('div');
      const meta = element('div', 'pub-meta');
      const tone = item.statusTone || (item.statusGroup === 'published' ? 'published' : 'working');
      meta.append(element('span', `status-pill ${tone}`, item.statusLabel || 'In progress'), element('span', '', item.venue || 'Venue'));
      const heading = element('h3', '', item.title);
      heading.dataset.editKey = item.titleKey || `cms.${item.id}.title`;
      const authors = element('p', 'authors');
      authors.dataset.editKey = item.authorsKey || `cms.${item.id}.authors`;
      appendHighlightedName(authors, item.authors);
      content.append(meta, heading, authors);
      if (item.url && isSafeLink(item.url)) {
        const links = element('div', 'pub-links');
        const link = element('a', '', `${item.linkLabel || 'Link'} `);
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.editHref = item.linkKey || `cms.${item.id}.url`;
        link.append(element('span', '', '↗'));
        link.lastChild.setAttribute('aria-hidden', 'true');
        links.append(link);
        content.append(links);
      }
      article.append(content);
      return article;
    }));
  }

  function renderResearch() {
    const container = document.querySelector('.interest-grid');
    container.replaceChildren(...collections.research.map((item, position) => {
      const article = markManaged(element('article'), item, `Research interest — ${item.title}`);
      const heading = element('h3', '', item.title);
      const body = element('p', '', item.body);
      heading.dataset.editKey = item.titleKey || `cms.${item.id}.title`;
      body.dataset.editKey = item.bodyKey || `cms.${item.id}.body`;
      article.append(element('span', 'interest-number', item.number || String(position + 1).padStart(2, '0')), heading, body);
      return article;
    }));
  }

  function renderEducation() {
    const container = document.querySelector('.timeline');
    container.replaceChildren(...collections.education.map((item) => {
      const article = markManaged(element('article'), item, `Education — ${item.title}`);
      const content = element('div');
      const heading = element('h3', '', item.title);
      const place = element('p', '', item.place);
      heading.dataset.editKey = item.titleKey || `cms.${item.id}.title`;
      place.dataset.editKey = item.placeKey || `cms.${item.id}.place`;
      content.append(heading, place);
      article.append(element('time', '', item.time), content);
      return article;
    }));
  }

  function renderSimpleList(category, selector) {
    const container = document.querySelector(selector);
    container.replaceChildren(...collections[category].map((item) => {
      const row = markManaged(element('li'), item, `${categoryLabels[category]} — ${item.title}`);
      const strong = element('strong');
      if (item.url && isSafeLink(item.url)) {
        const link = element('a', '', item.title);
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.editHref = item.linkKey || `cms.${item.id}.url`;
        strong.append(link);
      } else {
        strong.textContent = item.title;
        strong.dataset.editKey = item.titleKey || `cms.${item.id}.title`;
      }
      row.append(element('span', '', item.time), strong);
      return row;
    }));
  }

  function renderActivities() {
    const container = document.querySelector('.hobby-grid');
    container.replaceChildren(...collections.activities.map((item, position) => {
      const layout = item.layout && item.layout !== 'standard' ? ` ${item.layout}` : '';
      if (item.type === 'image' && item.imageSrc) {
        const article = markManaged(element('article', `hobby hobby-image${layout}`), item, `Activity — ${item.title}`);
        article.dataset.hobby = item.hobbyId || item.id;
        const image = element('img');
        image.src = item.imageSrc;
        image.alt = item.alt || `${item.title} activity`;
        const caption = element('div', 'hobby-caption');
        const heading = element('h3', '', item.title);
        heading.dataset.editKey = item.titleKey || `cms.${item.id}.title`;
        caption.append(element('span', '', String(position + 1).padStart(2, '0')), heading);
        article.append(image, caption);
        return article;
      }
      const article = markManaged(element('article', 'hobby hobby-text'), item, `Activities — ${item.title.replace(/\n/g, ', ')}`);
      article.dataset.hobby = item.hobbyId || item.id;
      const names = element('div', 'activity-names');
      item.title.split(/\n|,/).map((name) => name.trim()).filter(Boolean).forEach((name, index) => {
        const heading = element('h3', '', name);
        heading.dataset.editKey = `cms.${item.id}.activity.${index}`;
        names.append(heading);
      });
      const description = element('p', '', item.description || 'Movement, teamwork, and curiosity beyond research.');
      description.dataset.editKey = item.descriptionKey || `cms.${item.id}.description`;
      article.append(element('div', 'basketball-lines'), element('span', '', 'MORE ACTIVITIES'), names, description);
      article.firstChild.setAttribute('aria-hidden', 'true');
      return article;
    }));
  }

  function collectState() {
    if (collections) collections = extractCollections();
    const text = {};
    const links = {};
    editableElements().forEach((element) => {
      text[element.dataset.editKey] = element.textContent.trim();
    });
    editableLinks().forEach((element) => {
      links[element.dataset.editHref] = element.getAttribute('href');
    });
    const hidden = [...document.querySelectorAll('[data-removable].content-hidden')]
      .map((element) => element.dataset.blockId);
    return { version: 1, text, links, hidden, collections: clone(collections) };
  }

  function applyState(state) {
    if (!state || typeof state !== 'object') return;
    if (state.collections && typeof state.collections === 'object') {
      collections = clone(state.collections);
      renderCollections();
    }
    editableElements().forEach((element) => {
      const value = state.text?.[element.dataset.editKey];
      if (typeof value === 'string') element.textContent = value;
    });
    editableLinks().forEach((element) => {
      const value = state.links?.[element.dataset.editHref];
      if (typeof value === 'string' && isSafeLink(value)) element.setAttribute('href', value);
    });
    const hiddenBlocks = new Set(Array.isArray(state.hidden) ? state.hidden : []);
    document.querySelectorAll('[data-removable]').forEach((element) => {
      element.classList.toggle('content-hidden', hiddenBlocks.has(element.dataset.blockId));
    });
  }

  function isSafeLink(value) {
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function loadSavedState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyState(JSON.parse(raw));
    } catch (error) {
      console.warn('Saved homepage content could not be loaded.', error);
      showToast('Saved content could not be loaded. The CV-based version is displayed.');
    }
  }

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function setEditing(nextEditing) {
    editing = nextEditing;
    document.body.classList.toggle('editing', editing);
    byId('editor-bar').hidden = !editing;
    const toggle = byId('edit-toggle');
    toggle.setAttribute('aria-pressed', String(editing));
    toggle.querySelector('span').textContent = editing ? 'Finish editing' : 'Edit page';

    editableElements().forEach((element) => {
      if (editing) {
        element.setAttribute('contenteditable', 'true');
        element.setAttribute('spellcheck', 'true');
        element.setAttribute('role', 'textbox');
      } else {
        element.removeAttribute('contenteditable');
        element.removeAttribute('spellcheck');
        element.removeAttribute('role');
      }
    });
  }

  function saveLocally() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      setEditing(false);
      showToast('Changes saved in this browser.');
    } catch (error) {
      console.error(error);
      showToast('Unable to save locally. Export a JSON backup instead.');
    }
  }

  function exportContent() {
    const payload = {
      ...collectState(),
      exportedAt: new Date().toISOString(),
      note: 'Editable content for Chenglin Liu academic homepage',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'chenglin-liu-homepage-content.json';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Editable content exported as JSON.');
  }

  async function importContent(file) {
    if (!file) return;
    try {
      const state = JSON.parse(await file.text());
      if (state.version !== 1 || !state.text || !state.links) throw new Error('Unsupported content file');
      for (const value of Object.values(state.links)) {
        if (typeof value !== 'string' || !isSafeLink(value)) throw new Error('Unsafe or invalid link');
      }
      applyState(state);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
      buildLinkFields();
      showToast('Content imported and saved locally.');
    } catch (error) {
      console.error(error);
      showToast('That file is not a valid homepage content export.');
    } finally {
      byId('import-content').value = '';
    }
  }

  function linkLabel(link) {
    const aria = link.getAttribute('aria-label');
    if (aria) return aria;
    const text = link.textContent.replace('↗', '').trim();
    const publication = link.closest('[data-publication-id]');
    if (publication) {
      const title = publication.querySelector('h3')?.textContent.trim() || publication.dataset.publicationId;
      return `${text} — ${title}`;
    }
    return text || link.dataset.editHref;
  }

  function buildLinkFields() {
    const container = byId('link-fields');
    container.replaceChildren();
    editableLinks().forEach((link, index) => {
      const row = document.createElement('div');
      row.className = 'link-field';
      const label = document.createElement('label');
      const input = document.createElement('input');
      const inputId = `editable-link-${index}`;
      label.htmlFor = inputId;
      label.title = linkLabel(link);
      label.textContent = linkLabel(link);
      input.id = inputId;
      input.type = 'url';
      input.value = link.getAttribute('href') || '';
      input.dataset.linkKey = link.dataset.editHref;
      input.autocomplete = 'off';
      row.append(label, input);
      container.append(row);
    });
  }

  function decorateRemovableBlocks() {
    document.querySelectorAll('[data-removable]').forEach((block) => {
      if (block.querySelector(':scope > .remove-block')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'remove-block';
      button.setAttribute('aria-label', `Hide ${block.dataset.blockLabel}`);
      button.title = 'Hide this block';
      button.textContent = '×';
      button.addEventListener('click', () => {
        block.classList.add('content-hidden');
        showToast('Block hidden. Use Manage blocks to restore it.');
      });
      block.append(button);
    });
  }

  function buildBlockFields() {
    const container = byId('block-fields');
    container.replaceChildren();
    document.querySelectorAll('[data-removable]').forEach((block, index) => {
      const row = document.createElement('div');
      row.className = 'block-field';
      const input = document.createElement('input');
      const label = document.createElement('label');
      const inputId = `block-toggle-${index}`;
      input.id = inputId;
      input.type = 'checkbox';
      input.checked = !block.classList.contains('content-hidden');
      input.dataset.blockToggle = block.dataset.blockId;
      label.htmlFor = inputId;
      label.textContent = block.dataset.blockLabel;
      row.append(input, label);
      container.append(row);
    });
  }

  function applyBlockFields() {
    byId('block-fields').querySelectorAll('input').forEach((input) => {
      const block = document.querySelector(`[data-block-id="${CSS.escape(input.dataset.blockToggle)}"]`);
      block?.classList.toggle('content-hidden', !input.checked);
    });
    showToast('Page blocks updated. Use Save locally to keep this layout.');
  }

  function applyLinkFields(event) {
    const invalid = [];
    byId('link-fields').querySelectorAll('input').forEach((input) => {
      const value = input.value.trim();
      if (!isSafeLink(value)) {
        invalid.push(input);
        return;
      }
      document.querySelectorAll(`[data-edit-href="${CSS.escape(input.dataset.linkKey)}"]`).forEach((link) => link.setAttribute('href', value));
    });
    if (invalid.length) {
      event.preventDefault();
      invalid[0].focus();
      showToast('Please enter a complete http, https, or mailto link.');
      return;
    }
    showToast('Links updated. Use Save locally to keep them.');
  }

  function contentItemSummary(item) {
    return item.venue || item.place || item.description || item.time || (item.type === 'image' ? 'Image card' : 'Text-only card');
  }

  function openContentManager() {
    collections = extractCollections();
    workingCollections = clone(collections);
    activeContentCategory = 'publications';
    activeContentItemId = null;
    showContentList();
    byId('content-dialog').showModal();
  }

  function showContentList() {
    byId('content-list-panel').hidden = false;
    byId('content-item-editor').hidden = true;
    byId('content-category-title').textContent = categoryLabels[activeContentCategory];
    document.querySelectorAll('[data-content-category]').forEach((button) => {
      button.classList.toggle('active', button.dataset.contentCategory === activeContentCategory);
    });
    renderContentItemList();
  }

  function renderContentItemList() {
    const container = byId('content-item-list');
    container.replaceChildren();
    const items = workingCollections[activeContentCategory];
    if (!items.length) {
      container.append(element('p', 'content-empty', 'No items yet. Add the first one.'));
      return;
    }
    items.forEach((item, index) => {
      const row = element('div', 'content-item-row');
      row.dataset.contentItemId = item.id;
      const copy = element('div', 'content-item-copy');
      copy.append(element('strong', '', item.title || 'Untitled item'), element('small', '', contentItemSummary(item)));
      const controls = element('div', 'content-item-controls');
      const visibility = element('label', 'visibility-switch');
      const checkbox = element('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !item.hidden;
      checkbox.setAttribute('aria-label', `Show ${item.title || 'item'}`);
      checkbox.addEventListener('change', () => { item.hidden = !checkbox.checked; });
      visibility.append(checkbox, document.createTextNode('Show'));
      controls.append(visibility);
      [
        ['up', '↑', 'Move up'],
        ['down', '↓', 'Move down'],
        ['edit', '✎', 'Edit'],
        ['delete', '×', 'Delete'],
      ].forEach(([action, label, title]) => {
        const button = element('button', '', label);
        button.type = 'button';
        button.dataset.action = action;
        button.title = `${title} ${item.title || 'item'}`;
        button.setAttribute('aria-label', `${title} ${item.title || 'item'}`);
        button.disabled = (action === 'up' && index === 0) || (action === 'down' && index === items.length - 1);
        button.addEventListener('click', () => handleContentAction(action, index));
        controls.append(button);
      });
      row.append(copy, controls);
      container.append(row);
    });
  }

  function handleContentAction(action, index) {
    const items = workingCollections[activeContentCategory];
    if (action === 'up' && index > 0) [items[index - 1], items[index]] = [items[index], items[index - 1]];
    if (action === 'down' && index < items.length - 1) [items[index + 1], items[index]] = [items[index], items[index + 1]];
    if (action === 'delete') items.splice(index, 1);
    if (action === 'edit') {
      openContentItemEditor(items[index]);
      return;
    }
    renderContentItemList();
  }

  function newContentItem(category) {
    const base = { id: makeId(category), title: '', hidden: false };
    if (category === 'publications') return { ...base, publicationId: base.id, index: 'NEW', statusGroup: 'in-progress', statusLabel: 'In progress', statusTone: 'working', authors: '', venue: '', url: '', linkLabel: 'Paper' };
    if (category === 'research') return { ...base, number: String(workingCollections.research.length + 1).padStart(2, '0'), body: '' };
    if (category === 'education') return { ...base, time: '', place: '' };
    if (category === 'experience' || category === 'service') return { ...base, time: '', url: '' };
    return { ...base, type: 'text', layout: 'standard', description: '', imageSrc: '', alt: '', hobbyId: base.id };
  }

  function openContentItemEditor(item) {
    activeContentItemId = item?.id || null;
    const draft = item ? clone(item) : newContentItem(activeContentCategory);
    if (!activeContentItemId) activeContentItemId = draft.id;
    byId('content-list-panel').hidden = true;
    byId('content-item-editor').hidden = false;
    byId('content-editor-title').textContent = item ? `Edit ${categoryLabels[activeContentCategory].slice(0, -1) || 'item'}` : `Add to ${categoryLabels[activeContentCategory]}`;
    buildContentItemForm(draft);
  }

  function buildContentItemForm(item) {
    const container = byId('content-item-form');
    container.replaceChildren();
    container.dataset.itemId = item.id;
    contentSchemas[activeContentCategory].forEach((field) => {
      const wrapper = element('div', `content-form-field${field.wide ? ' wide' : ''}`);
      const inputId = `content-field-${activeContentCategory}-${field.name}`;
      const label = element('label', '', field.label);
      label.htmlFor = inputId;
      let input;
      if (field.type === 'textarea') input = element('textarea');
      else if (field.type === 'select') {
        input = element('select');
        field.options.forEach(([value, caption]) => {
          const option = element('option', '', caption);
          option.value = value;
          input.append(option);
        });
      } else {
        input = element('input');
        input.type = field.type || 'text';
      }
      input.id = inputId;
      input.name = field.name;
      input.value = item[field.name] || '';
      if (field.required) input.required = true;
      wrapper.append(label, input);
      container.append(wrapper);
    });
  }

  function saveContentItem() {
    const container = byId('content-item-form');
    const existing = workingCollections[activeContentCategory].find((item) => item.id === activeContentItemId);
    const item = existing || newContentItem(activeContentCategory);
    item.id = container.dataset.itemId;
    contentSchemas[activeContentCategory].forEach((field) => {
      item[field.name] = container.querySelector(`[name="${field.name}"]`).value.trim();
    });
    if (!item.title) {
      container.querySelector('[name="title"]').focus();
      showToast('Please add a title or activity name.');
      return;
    }
    if (item.url && !isSafeLink(item.url)) {
      container.querySelector('[name="url"]').focus();
      showToast('Please use a complete HTTPS link or leave it empty.');
      return;
    }
    if (!existing) {
      item.publicationId ||= item.id;
      item.hobbyId ||= item.id;
      workingCollections[activeContentCategory].push(item);
    }
    showContentList();
  }

  function applyManagedContent(event) {
    event.preventDefault();
    collections = clone(workingCollections);
    renderCollections();
    byId('content-dialog').close();
    showToast('Content updated. Use Save locally to keep it.');
  }

  function configureContentManager() {
    document.querySelectorAll('[data-content-category]').forEach((button) => {
      button.addEventListener('click', () => {
        activeContentCategory = button.dataset.contentCategory;
        activeContentItemId = null;
        showContentList();
      });
    });
    byId('content-manager').addEventListener('click', openContentManager);
    byId('add-content-item').addEventListener('click', () => openContentItemEditor(null));
    byId('cancel-content-item').addEventListener('click', showContentList);
    byId('save-content-item').addEventListener('click', saveContentItem);
    byId('apply-content').addEventListener('click', applyManagedContent);
  }

  function configureFilters() {
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle('active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('[data-publication-id]').forEach((publication) => {
          publication.hidden = filter !== 'all' && publication.dataset.status !== filter;
        });
      });
    });
  }

  function configureNavigation() {
    const menu = byId('menu-toggle');
    const links = byId('nav-links');
    menu.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
    links.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      links.classList.remove('open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  function configureEditor() {
    byId('edit-toggle').addEventListener('click', () => setEditing(!editing));
    byId('save-edits').addEventListener('click', saveLocally);
    byId('export-content').addEventListener('click', exportContent);
    byId('import-content').addEventListener('change', (event) => importContent(event.target.files[0]));
    byId('edit-links').addEventListener('click', () => {
      buildLinkFields();
      byId('link-dialog').showModal();
    });
    byId('apply-links').addEventListener('click', applyLinkFields);
    byId('manage-blocks').addEventListener('click', () => {
      buildBlockFields();
      byId('block-dialog').showModal();
    });
    byId('apply-blocks').addEventListener('click', applyBlockFields);
    byId('reset-content').addEventListener('click', () => byId('reset-dialog').showModal());
    byId('confirm-reset').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      collections = clone(defaultCollections);
      renderCollections();
      applyState(defaultState);
      setEditing(false);
      showToast('CV-based content restored.');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && editing && !document.querySelector('dialog[open]')) setEditing(false);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const ownerMode = new URLSearchParams(window.location.search).get('edit') === '1';
    document.documentElement.classList.toggle('owner-mode', ownerMode);
    collections = extractCollections();
    defaultCollections = clone(collections);
    decorateRemovableBlocks();
    defaultState = collectState();
    loadSavedState();
    configureNavigation();
    configureFilters();
    configureEditor();
    configureContentManager();
    byId('current-year').textContent = new Date().getFullYear();
  });
})();
