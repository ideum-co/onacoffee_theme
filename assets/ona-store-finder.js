/* ONA Store Finder — vanilla JS, one instance per section */
(function () {
  'use strict';

  const PAGE_SIZE = 12;

  const STYLE_ARRAY = [
    {elementType:"geometry",stylers:[{color:"#ececec"}]},
    {elementType:"labels.icon",stylers:[{visibility:"off"}]},
    {elementType:"labels.text.fill",stylers:[{color:"#7a7a7a"}]},
    {elementType:"labels.text.stroke",stylers:[{color:"#fafafa"}]},
    {featureType:"administrative.land_parcel",elementType:"labels.text.fill",stylers:[{color:"#cfcfcf"}]},
    {featureType:"poi",elementType:"geometry",stylers:[{color:"#f4f4f4"}]},
    {featureType:"poi",elementType:"labels.text.fill",stylers:[{color:"#8a8a8a"}]},
    {featureType:"poi.park",elementType:"geometry",stylers:[{color:"#dcdcdc"}]},
    {featureType:"poi.park",elementType:"labels.text.fill",stylers:[{color:"#b0b0b0"}]},
    {featureType:"road",elementType:"geometry",stylers:[{color:"#ffffff"}]},
    {featureType:"road.arterial",elementType:"labels.text.fill",stylers:[{color:"#8a8a8a"}]},
    {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#c2c2c2"}]},
    {featureType:"road.highway",elementType:"labels.text.fill",stylers:[{color:"#7a7a7a"}]},
    {featureType:"road.local",elementType:"labels.text.fill",stylers:[{color:"#b0b0b0"}]},
    {featureType:"transit.line",elementType:"geometry",stylers:[{color:"#dcdcdc"}]},
    {featureType:"transit.station",elementType:"geometry",stylers:[{color:"#ececec"}]},
    {featureType:"water",elementType:"geometry",stylers:[{color:"#c4c4c4"}]},
    {featureType:"water",elementType:"labels.text.fill",stylers:[{color:"#b0b0b0"}]}
  ];

  document.querySelectorAll('.ona-sf').forEach(initSection);

  function initSection(root) {
    const sectionId = root.dataset.sectionId;
    const cfg = (window.__onaSf || {})[sectionId] || {};
    const apiKey = cfg.apiKey;
    const fallbackLat = isFinite(cfg.fallbackLat) ? cfg.fallbackLat : -35.2809;
    const fallbackLng = isFinite(cfg.fallbackLng) ? cfg.fallbackLng : 149.1300;
    const markerIcon = cfg.markerIcon;

    const listEl = root.querySelector('[data-ona-sf-list]');
    const mapWrap = root.querySelector('[data-ona-sf-map-wrap]');
    const mapEl = mapWrap && mapWrap.querySelector('.ona-sf__map');
    const countEl = root.querySelector('[data-ona-sf-count]');
    const emptyEl = root.querySelector('[data-ona-sf-empty]');
    const searchInput = root.querySelector('.ona-sf__search');
    const nearMeBtn = root.querySelector('[data-ona-sf-near-me]');
    const layout = root.querySelector('[data-ona-sf-layout]');
    const cards = Array.from(root.querySelectorAll('[data-ona-sf-card]'));
    const distanceFilter = root.querySelector('[data-ona-sf-distance-filter]');
    const distanceSlider = root.querySelector('[data-ona-sf-distance-slider]');
    const distanceValueEl = root.querySelector('[data-ona-sf-distance-value]');
    const distanceAnchorEl = root.querySelector('[data-ona-sf-distance-anchor]');
    const distanceBubble = root.querySelector('[data-ona-sf-rs-bubble]');
    const paginationEl = root.querySelector('[data-ona-sf-pagination]');
    const pagePrevBtn = root.querySelector('[data-ona-sf-page-prev]');
    const pageNextBtn = root.querySelector('[data-ona-sf-page-next]');
    const pageListEl = root.querySelector('[data-ona-sf-page-list]');

    let activeTags = new Set();
    let activeStates = new Set();
    const AU_STATES = new Set(['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']);
    let userPos = null;
    let maxDistanceKm = Infinity;
    let currentPage = 1;
    let map = null;
    let mapInitPromise = null;
    let markers = new Map();
    let infoWindow = null;
    let mapBounds = null; // google.maps.LatLngBounds — when set, only stores within these bounds are visible
    let userPannedMap = false;
    let activeMarkerId = null; // ID of currently-clicked store — always kept visible
    let clusterer = null;
    let activeBouncingMarker = null;
    let initialUserPos = null; // captured from auto-geolocation on page load, preserved across Clear filters

    function haversineKm(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }

    function isValidCoord(lat, lng) {
      return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }
    function getCardData(card) {
      return {
        el: card,
        id: card.dataset.id,
        lat: parseFloat(card.dataset.lat),
        lng: parseFloat(card.dataset.lng),
        tags: (card.dataset.tags || '').split(',').filter(Boolean),
        searchText: card.dataset.searchText || '',
        title: card.querySelector('.ona-sf__card-title')?.textContent || '',
        address: card.querySelector('.ona-sf__card-address')?.textContent || '',
        hoursHtml: card.querySelector('.ona-sf__card-hours')?.innerHTML || '',
        directionsUrl: card.querySelector('.ona-sf__btn--primary')?.href || '',
        websiteUrl: card.querySelector('.ona-sf__btn:not(.ona-sf__btn--primary)')?.href || ''
      };
    }

    function isMapView() {
      return layout.getAttribute('data-view') === 'map';
    }

    function applyFilters(opts) {
      opts = opts || {};
      const tagSet = activeTags;
      let visibleAfterFilter = [];

      cards.forEach(card => {
        const d = getCardData(card);
        const matchTags = tagSet.size === 0 || d.tags.some(t => tagSet.has(t));
        let matchState = true;
        if (activeStates.size > 0) {
          const s = (card.dataset.state || '').toUpperCase();
          if (activeStates.has('__intl')) {
            // International = state not one of AU states
            matchState = !AU_STATES.has(s);
            // OR any explicit state also selected
            if (!matchState) matchState = activeStates.has(s);
          } else {
            matchState = activeStates.has(s);
          }
        }
        let matchDistance = true;
        if (userPos && isFinite(maxDistanceKm) && maxDistanceKm < Infinity) {
          if (!isValidCoord(d.lat, d.lng)) {
            matchDistance = false;
          } else {
            matchDistance = haversineKm(userPos.lat, userPos.lng, d.lat, d.lng) <= maxDistanceKm;
          }
        }
        // Map viewport filter: when map has been interacted with (panned/zoomed/searched),
        // only show stores whose markers fall within current map bounds.
        // Exception: the actively-clicked marker stays visible regardless of bounds.
        let matchBounds = true;
        if (mapBounds && userPannedMap) {
          if (activeMarkerId && card.dataset.id === activeMarkerId) {
            matchBounds = true;
          } else if (!isValidCoord(d.lat, d.lng)) {
            matchBounds = false;
          } else {
            matchBounds = mapBounds.contains(new google.maps.LatLng(d.lat, d.lng));
          }
        }
        const match = !searchFailed && matchTags && matchState && matchDistance && matchBounds;
        card.dataset.matchFilter = match ? '1' : '0';
        if (match) visibleAfterFilter.push(card);
      });

      // sort by distance if applicable
      if (userPos) {
        visibleAfterFilter.sort((a, b) => {
          const da = getCardData(a), db = getCardData(b);
          const distA = isFinite(da.lat) ? haversineKm(userPos.lat, userPos.lng, da.lat, da.lng) : Infinity;
          const distB = isFinite(db.lat) ? haversineKm(userPos.lat, userPos.lng, db.lat, db.lng) : Infinity;
          return distA - distB;
        });
      }
      // On mobile only: force the actively-selected card to the front of the list
      // so it's always reachable at the top after the list re-renders. Desktop keeps natural sort order.
      if (activeMarkerId && isMobileViewport()) {
        const activeIdx = visibleAfterFilter.findIndex(c => c.dataset.id === activeMarkerId);
        if (activeIdx > 0) {
          const [active] = visibleAfterFilter.splice(activeIdx, 1);
          visibleAfterFilter.unshift(active);
        }
      }
      if (userPos || (activeMarkerId && isMobileViewport())) {
        visibleAfterFilter.forEach(c => listEl.appendChild(c));
      }
      if (userPos) {
        cards.forEach(card => {
          const d = getCardData(card);
          const distEl = card.querySelector('[data-ona-sf-distance]');
          if (distEl) {
            if (isFinite(d.lat) && isFinite(d.lng)) {
              const dist = haversineKm(userPos.lat, userPos.lng, d.lat, d.lng);
              distEl.textContent = (dist < 100 ? dist.toFixed(1) : Math.round(dist)) + ' km';
            } else {
              distEl.textContent = '';
            }
          }
        });
      }

      const clearBtn = root.querySelector('[data-ona-sf-clear-filters]');
      if (clearBtn) {
        const sliderMax = distanceSlider ? parseFloat(distanceSlider.max) : Infinity;
        const distanceActive = isFinite(maxDistanceKm) && maxDistanceKm < sliderMax;
        const searchActive = searchInput && searchInput.value.trim() !== '';
        const hasFilters = activeTags.size > 0 || activeStates.size > 0 || distanceActive || searchActive || userPannedMap;
        clearBtn.hidden = !hasFilters;
      }

      if (countEl) {
        const noun = visibleAfterFilter.length === 1 ? 'store' : 'stores';
        countEl.innerHTML = '<span class="ona-sf__count-num">' + visibleAfterFilter.length + '</span> ' + noun + ' found in the current map view';
      }
      if (emptyEl) {
        emptyEl.hidden = visibleAfterFilter.length > 0;
        const emptySearchMsg = emptyEl.querySelector('[data-ona-sf-empty-search]');
        const emptyFilterMsg = emptyEl.querySelector('[data-ona-sf-empty-filter]');
        if (emptySearchMsg && emptyFilterMsg) {
          emptySearchMsg.hidden = !searchFailed;
          emptyFilterMsg.hidden = searchFailed;
        }
      }

      // Reset to page 1 unless preserving page
      if (!opts.preservePage) currentPage = 1;

      applyPagination(visibleAfterFilter);

      // Refresh custom scrollbar (display changes on child cards don't bubble through MutationObserver)
      if (window.__onaSfRefreshScrollbar) {
        if (visibleAfterFilter.length === 0 && listEl) listEl.scrollTop = 0;
        requestAnimationFrame(window.__onaSfRefreshScrollbar);
      }

      if (map) syncMarkers();
    }

    function isMobileViewport() {
      return window.matchMedia('(max-width: 999px)').matches;
    }
    function applyPagination(visibleAfterFilter) {
      const inMap = isMapView();
      // Paginate only in list view. Map view (both desktop and mobile) uses scrollable list.
      const shouldPaginate = !inMap;
      if (!shouldPaginate || visibleAfterFilter.length <= PAGE_SIZE) {
        visibleAfterFilter.forEach(c => { c.style.display = ''; });
        cards.forEach(c => { if (c.dataset.matchFilter !== '1') c.style.display = 'none'; });
        if (paginationEl) paginationEl.hidden = true;
        return;
      }
      const totalPages = Math.max(1, Math.ceil(visibleAfterFilter.length / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;
      const start = (currentPage - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE;
      cards.forEach(c => { c.style.display = 'none'; });
      visibleAfterFilter.slice(start, end).forEach(c => { c.style.display = ''; });

      if (paginationEl) {
        paginationEl.hidden = false;
        renderPageList(currentPage, totalPages);
        if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1;
        if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages;
      }
    }

    function renderPageList(current, total) {
      if (!pageListEl) return;
      // Build a compact list: 1 ... current-1 current current+1 ... total
      const items = new Set();
      items.add(1);
      items.add(total);
      for (let p = current - 1; p <= current + 1; p++) {
        if (p >= 1 && p <= total) items.add(p);
      }
      const sorted = Array.from(items).sort((a, b) => a - b);
      const html = [];
      let prev = 0;
      for (const p of sorted) {
        if (prev && p - prev > 1) {
          html.push('<li class="ona-sf__page-ellipsis">…</li>');
        }
        html.push(`<li class="${p === current ? 'is-active' : ''}"><button type="button" class="ona-sf__page-num" data-page="${p}">${p}</button></li>`);
        prev = p;
      }
      pageListEl.innerHTML = html.join('');
      pageListEl.querySelectorAll('.ona-sf__page-num').forEach(btn => {
        btn.addEventListener('click', () => {
          currentPage = parseInt(btn.dataset.page, 10);
          applyFilters({preservePage: true});
          scrollToListTop();
        });
      });
    }

    let bounceOverlay = null;
    function setActiveBounce(m) {
      // Remove previous overlay + restore previous marker
      if (bounceOverlay) {
        bounceOverlay.setMap(null);
        bounceOverlay = null;
      }
      if (activeBouncingMarker && activeBouncingMarker !== m) {
        // Show the previous marker again
        activeBouncingMarker.setOpacity(1);
      }
      activeBouncingMarker = m || null;
      if (!m || !markerIcon) return;
      // Hide the underlying marker so only our animated overlay is visible
      m.setOpacity(0);
      // Build a one-off OverlayView class lazily
      if (!window.__OnaSfBouncingOverlay) {
        function OvrCtor() { google.maps.OverlayView.apply(this, arguments); }
        OvrCtor.prototype = Object.create(google.maps.OverlayView.prototype);
        OvrCtor.prototype.constructor = OvrCtor;
        OvrCtor.prototype.onAdd = function() {
          const div = document.createElement('div');
          div.className = 'ona-sf__active-marker';
          div.innerHTML = '<img src="' + this._iconUrl + '" alt="">';
          this._div = div;
          this.getPanes().floatPane.appendChild(div);
        };
        OvrCtor.prototype.draw = function() {
          const proj = this.getProjection();
          if (!proj || !this._div) return;
          const pt = proj.fromLatLngToDivPixel(this._pos);
          this._div.style.left = (pt.x - 14) + 'px';
          this._div.style.top = (pt.y - 38) + 'px';
        };
        OvrCtor.prototype.onRemove = function() {
          if (this._div && this._div.parentNode) this._div.parentNode.removeChild(this._div);
          this._div = null;
        };
        window.__OnaSfBouncingOverlay = OvrCtor;
      }
      bounceOverlay = new window.__OnaSfBouncingOverlay();
      bounceOverlay._pos = m.getPosition();
      bounceOverlay._iconUrl = markerIcon;
      bounceOverlay.setMap(map);
    }
    function activateCard(id) {
      cards.forEach(c => c.classList.toggle('is-active', c.dataset.id === id));
      const target = cards.find(c => c.dataset.id === id);
      if (!target || target.style.display === 'none') return;
      // Scroll only inside the list container; target lands at the top of the scrollable area.
      const listRect = listEl.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = listEl.scrollTop + (targetRect.top - listRect.top);
      listEl.scrollTop = offset;
    }

    // Tag chips
    root.querySelectorAll('[data-ona-sf-tag]').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.onaSfTag;
        if (tag === '__all') {
          activeTags.clear();
          root.querySelectorAll('[data-ona-sf-tag]').forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
        } else {
          const allChip = root.querySelector('[data-ona-sf-tag="__all"]');
          if (allChip) allChip.classList.remove('is-active');
          if (activeTags.has(tag)) {
            activeTags.delete(tag);
            chip.classList.remove('is-active');
          } else {
            activeTags.add(tag);
            chip.classList.add('is-active');
          }
          if (activeTags.size === 0 && allChip) allChip.classList.add('is-active');
        }
        applyFilters();
      });
    });

    // State chips
    root.querySelectorAll('[data-ona-sf-state]').forEach(chip => {
      chip.addEventListener('click', () => {
        const st = chip.dataset.onaSfState;
        if (st === '__all') {
          activeStates.clear();
          root.querySelectorAll('[data-ona-sf-state]').forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
        } else {
          const allChip = root.querySelector('[data-ona-sf-state="__all"]');
          if (allChip) allChip.classList.remove('is-active');
          if (activeStates.has(st)) {
            activeStates.delete(st);
            chip.classList.remove('is-active');
          } else {
            activeStates.add(st);
            chip.classList.add('is-active');
          }
          if (activeStates.size === 0 && allChip) allChip.classList.add('is-active');
        }
        applyFilters();
      });
    });

    // Search input — Enter routes through the same unified geocodeAndUse flow as the button
    const searchClearBtn = root.querySelector('[data-ona-sf-search-clear]');
    function refreshSearchClearBtn() {
      if (!searchClearBtn) return;
      searchClearBtn.hidden = !(searchInput && searchInput.value);
    }
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const q = searchInput.value.trim();
        if (!q) return;
        geocodeAndUse(q);
      });
      searchInput.addEventListener('input', refreshSearchClearBtn);
    }
    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchFailed = false;
        refreshSearchClearBtn();
        applyFilters();
        if (searchInput) searchInput.focus();
      });
    }
    refreshSearchClearBtn();

    // Reset — multiple buttons share data-ona-sf-reset (toolbar + empty-state)
    function handleReset() {
        activeTags.clear();
        activeStates.clear();
        if (searchInput) { searchInput.value = ''; refreshSearchClearBtn && refreshSearchClearBtn(); }
        searchFailed = false;
        userPannedMap = false;
        mapBounds = null;
        // Restore original auto-detected location if we have it; else null
        userPos = initialUserPos ? { lat: initialUserPos.lat, lng: initialUserPos.lng } : null;
        maxDistanceKm = Infinity;
        if (distanceSlider) {
          distanceSlider.value = distanceSlider.max;
          updateSliderUI && updateSliderUI();
        }
        if (distanceFilter) distanceFilter.classList.toggle('is-active', !!userPos);
        if (distanceAnchorEl) distanceAnchorEl.textContent = userPos ? 'your location' : '—';
        root.querySelectorAll('[data-ona-sf-tag]').forEach(c => c.classList.remove('is-active'));
        const allChip = root.querySelector('[data-ona-sf-tag="__all"]');
        if (allChip) allChip.classList.add('is-active');
        root.querySelectorAll('[data-ona-sf-state]').forEach(c => c.classList.remove('is-active'));
        const allStateChip = root.querySelector('[data-ona-sf-state="__all"]');
        if (allStateChip) allStateChip.classList.add('is-active');
        applyFilters();
    }
    root.querySelectorAll('[data-ona-sf-reset]').forEach(btn => btn.addEventListener('click', handleReset));

    // Distance slider — visible always, but disabled until user position is known
    function computeMaxDistance(originLat, originLng) {
      let maxKm = 0;
      cards.forEach(card => {
        const d = getCardData(card);
        if (!isValidCoord(d.lat, d.lng)) return;
        const dist = haversineKm(originLat, originLng, d.lat, d.lng);
        if (dist > maxKm) maxKm = dist;
      });
      // Round up to nearest 100km, minimum 100
      return Math.max(100, Math.ceil(maxKm / 100) * 100);
    }
    function updateSliderTicks() {
      if (!distanceSlider) return;
      const ticksEl = root.querySelector('.ona-sf__rs-ticks');
      if (!ticksEl) return;
      const max = parseFloat(distanceSlider.max);
      const step = Math.ceil(max / 5 / 100) * 100; // ~5 ticks
      const values = [0];
      for (let v = step; v < max; v += step) values.push(v);
      values.push(max);
      ticksEl.innerHTML = values.map(v => `<span>${v} km</span>`).join('');
    }
    function updateSliderUI() {
      if (!distanceSlider) return;
      const min = parseFloat(distanceSlider.min);
      const max = parseFloat(distanceSlider.max);
      const val = parseFloat(distanceSlider.value);
      const pct = ((val - min) / (max - min)) * 100;
      const frac = (val - min) / (max - min);
      const trackWrap = distanceSlider.parentElement;
      if (trackWrap) {
        trackWrap.style.setProperty('--ona-sf-rs-pct', pct + '%');
        trackWrap.style.setProperty('--ona-sf-rs-frac', frac);
      }
      if (distanceFilter) {
        distanceFilter.style.setProperty('--ona-sf-rs-pct', pct + '%');
        distanceFilter.style.setProperty('--ona-sf-rs-frac', frac);
      }
      if (distanceBubble) distanceBubble.textContent = val + ' km';
      if (distanceValueEl) distanceValueEl.textContent = distanceSlider.value;
    }
    if (distanceSlider) {
      const initialMax = computeMaxDistance(fallbackLat, fallbackLng);
      distanceSlider.max = initialMax;
      distanceSlider.value = initialMax;
      updateSliderTicks();
      updateSliderUI();

      let isAnimating = false;
      let suppressInput = false;

      function applySliderChange() {
        maxDistanceKm = parseFloat(distanceSlider.value);
        if (!userPos) {
          userPos = {lat: fallbackLat, lng: fallbackLng};
          if (distanceFilter) distanceFilter.classList.add('is-active');
          if (distanceAnchorEl) distanceAnchorEl.textContent = 'Canberra';
        }
        updateSliderUI();
        applyFilters();
      }

      function animateThumbTo(from, to, duration) {
        if (isAnimating) return;
        isAnimating = true;
        const start = performance.now();
        function step(t) {
          const progress = Math.min((t - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          const value = Math.round(from + (to - from) * eased);
          suppressInput = true;
          distanceSlider.value = value;
          suppressInput = false;
          updateSliderUI();
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            isAnimating = false;
            applySliderChange();
          }
        }
        requestAnimationFrame(step);
      }

      // Intercept clicks on the track (not on the thumb) and animate instead of letting native snap
      distanceSlider.addEventListener('mousedown', e => {
        if (distanceSlider.disabled || isAnimating) return;
        const rect = distanceSlider.getBoundingClientRect();
        if (rect.width === 0) return;
        const min = parseFloat(distanceSlider.min);
        const max = parseFloat(distanceSlider.max);
        const currentValue = parseFloat(distanceSlider.value);
        const thumbX = ((currentValue - min) / (max - min)) * rect.width;
        const clickX = e.clientX - rect.left;
        const distFromThumb = Math.abs(clickX - thumbX);
        // 12 px tolerance around the thumb — within that, allow native drag
        if (distFromThumb <= 12) return;
        // Outside the thumb → cancel native jump, animate ourselves
        e.preventDefault();
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const target = Math.round(min + pct * (max - min));
        animateThumbTo(currentValue, target, 260);
      });

      distanceSlider.addEventListener('input', () => {
        if (suppressInput || isAnimating) return;
        applySliderChange();
      });
    }

    // Pagination buttons
    function scrollToListTop() {
      // Measure the sticky header height directly; fall back to CSS vars.
      let headerOffset = 0;
      const stickyEls = document.querySelectorAll('header-component, header.shopify-section-header-sticky, header[data-sticky], #header-group');
      stickyEls.forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position === 'sticky' || cs.position === 'fixed' || el.tagName.toLowerCase() === 'header-component') {
          const r = el.getBoundingClientRect();
          if (r.top <= 0 && r.height > headerOffset) headerOffset = r.height;
        }
      });
      if (!headerOffset) {
        headerOffset = parseFloat(getComputedStyle(document.body).getPropertyValue('--header-group-height')) ||
                       parseFloat(getComputedStyle(document.body).getPropertyValue('--header-height')) || 80;
      }
      const top = listEl.getBoundingClientRect().top + window.pageYOffset - headerOffset - 16;
      window.scrollTo({top, behavior: 'smooth'});
    }
    if (pagePrevBtn) {
      pagePrevBtn.addEventListener('click', () => {
        currentPage--;
        applyFilters({preservePage: true});
        scrollToListTop();
      });
    }
    if (pageNextBtn) {
      pageNextBtn.addEventListener('click', () => {
        currentPage++;
        applyFilters({preservePage: true});
        scrollToListTop();
      });
    }

    // mode: 'search' (activate viewport filter) or 'search' (just distance-sort, no viewport filter)
    function setUserPos(lat, lng, label, mode) {
      userPos = {lat, lng};
      if (distanceFilter) distanceFilter.classList.add('is-active');
      if (distanceAnchorEl) distanceAnchorEl.textContent = label || 'your location';
      if (distanceSlider) {
        const newMax = computeMaxDistance(lat, lng);
        distanceSlider.max = newMax;
        distanceSlider.value = newMax;
        updateSliderTicks();
      }
      maxDistanceKm = parseFloat(distanceSlider ? distanceSlider.value : Infinity);
      updateSliderUI();

      if (mode === 'nearby') {
        // Distance-sort only — no viewport filter
        userPannedMap = false;
        mapBounds = null;
        if (map) {
          map.setCenter({lat, lng});
          map.setZoom(13);
        }
        applyFilters();
        return;
      }
      // 'search' mode — activate viewport filter (default)
      userPannedMap = true; // set synchronously so view-toggle's auto-fit skips
      ensureMap().then(() => {
        const N = 5;
        const distances = [];
        cards.forEach(card => {
          const d = getCardData(card);
          if (!isValidCoord(d.lat, d.lng)) return;
          distances.push({ lat: d.lat, lng: d.lng, dist: haversineKm(lat, lng, d.lat, d.lng) });
        });
        distances.sort((a, b) => a.dist - b.dist);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({lat, lng});
        distances.slice(0, N).forEach(p => bounds.extend({lat: p.lat, lng: p.lng}));
        // Wait for layout so fitBounds uses correct container size
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            google.maps.event.trigger(map, 'resize');
            map.fitBounds(bounds, {top: 60, right: 60, bottom: 60, left: 60});
          });
        });
      });
      applyFilters();
    }
    function switchToMap() {
      const mapBtn = root.querySelector('[data-ona-sf-view="map"]');
      if (mapBtn && !mapBtn.classList.contains('is-active')) mapBtn.click();
    }
    let searchFailed = false;
    function isInAustralia(lat, lng) {
      // Rough AU bounding box including territories
      return lat >= -44 && lat <= -9 && lng >= 110 && lng <= 155;
    }
    function geocodeAndUse(query) {
      searchFailed = false;
      const q = query.trim().toLowerCase();
      // First try to match a store by title or address (text contains, case-insensitive)
      if (q) {
        for (const card of cards) {
          const title = (card.querySelector('.ona-sf__card-title')?.textContent || '').trim().toLowerCase();
          const searchText = card.dataset.searchText || '';
          if (title.includes(q) || searchText.includes(q)) {
            const d = getCardData(card);
            if (isValidCoord(d.lat, d.lng)) {
              switchToMap();
              setUserPos(d.lat, d.lng, d.title, 'search');
              return;
            }
          }
        }
      }
      loadGoogleMaps().then(() => {
        const RELIABLE_TYPES = new Set([
          'street_address', 'premise', 'route', 'intersection',
          'locality', 'sublocality', 'neighborhood', 'postal_code',
          'administrative_area_level_1', 'administrative_area_level_2',
          'administrative_area_level_3'
        ]);
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: query, componentRestrictions: { country: 'AU' } }, (results, status) => {
          if (status !== 'OK' || !results || !results[0]) {
            searchFailed = true;
            applyFilters();
            return;
          }
          const r = results[0];
          const types = r.types || [];
          const hasReliableType = types.some(t => RELIABLE_TYPES.has(t));
          const loc = r.geometry && r.geometry.location;
          if (!hasReliableType || !loc || !isInAustralia(loc.lat(), loc.lng())) {
            searchFailed = true;
            applyFilters();
            return;
          }
          switchToMap();
          setUserPos(loc.lat(), loc.lng(), r.formatted_address || query, 'search');
        });
      });
    }
    if (nearMeBtn) {
      nearMeBtn.addEventListener('click', () => {
        // If user typed something in the search box, treat the button as "Search"
        if (searchInput && searchInput.value.trim()) {
          geocodeAndUse(searchInput.value.trim());
          return;
        }
        if (!navigator.geolocation) {
          switchToMap();
          setUserPos(fallbackLat, fallbackLng, 'Canberra', 'search');
          return;
        }
        nearMeBtn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          pos => { nearMeBtn.disabled = false; switchToMap(); setUserPos(pos.coords.latitude, pos.coords.longitude, 'your location', 'nearby'); },
          () => { nearMeBtn.disabled = false; switchToMap(); setUserPos(fallbackLat, fallbackLng, 'Canberra', 'nearby'); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    // View toggle — start in map view by default
    layout.setAttribute('data-view', 'map');
    root.querySelectorAll('[data-ona-sf-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.onaSfView;
        root.querySelectorAll('[data-ona-sf-view]').forEach(b => b.classList.toggle('is-active', b === btn));
        layout.setAttribute('data-view', v);
        // Re-apply visibility (pagination off in map view, on in list view)
        applyFilters({preservePage: true});
        if (v === 'map') {
          ensureMap().then(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (!map) return;
                google.maps.event.trigger(map, 'resize');
                if (!userPannedMap) {
                  fitToVisibleMarkers();
                }
              });
            });
          });
        }
        // Update custom scrollbar when switching views
        if (window.__onaSfRefreshScrollbar) requestAnimationFrame(window.__onaSfRefreshScrollbar);
      });
    });

    function loadGoogleMaps() {
      if (window.google && window.google.maps) return Promise.resolve();
      if (mapInitPromise) return mapInitPromise;
      mapInitPromise = new Promise((resolve, reject) => {
        const cbName = '__onaSfGmapsCb_' + Date.now();
        window[cbName] = () => { resolve(); delete window[cbName]; };
        const s = document.createElement('script');
        s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&libraries=places&callback=' + cbName;
        s.async = true;
        s.defer = true;
        s.onerror = reject;
        document.head.appendChild(s);
      });
      return mapInitPromise;
    }
    function loadClusterer() {
      if (window.markerClusterer) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    function ensureMap() {
      if (map) return Promise.resolve();
      return loadGoogleMaps().then(() => {
        map = new google.maps.Map(mapEl, {
          center: userPos || {lat: -25.2744, lng: 133.7751},
          zoom: userPos ? 11 : 4,
          minZoom: 3,
          maxZoom: 18,
          disableDefaultUI: true,
          zoomControl: true,
          styles: STYLE_ARRAY,
          restriction: {
            latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
            strictBounds: false
          }
        });
        const iwMaxWidth = isMobileViewport() ? Math.min(window.innerWidth - 40, 400) : 320;
        infoWindow = new google.maps.InfoWindow({maxWidth: iwMaxWidth});
        infoWindow.addListener('closeclick', () => {
          // Return the active marker back to clusterer
          if (activeMarkerId && clusterer) {
            const prev = markers.get(activeMarkerId);
            if (prev) { prev.setMap(null); clusterer.addMarker(prev); }
          }
          activeMarkerId = null;
          setActiveBounce(null);
          cards.forEach(c => c.classList.remove('is-active'));
          applyFilters({preservePage: true});
        });

        // Only USER interactions activate viewport filter (not programmatic fits)
        map.addListener('dragstart', () => { userPannedMap = true; });
        mapEl.addEventListener('wheel', () => { userPannedMap = true; }, {passive: true});
        mapEl.addEventListener('dblclick', () => { userPannedMap = true; });
        mapEl.addEventListener('touchstart', () => { userPannedMap = true; }, {passive: true});

        // After idle, update bounds and re-filter (debounced).
        // Skip the very first idle so the initial auto-fit doesn't get treated as a user pan.
        let idleCount = 0;
        let idleTimer = null;
        map.addListener('idle', () => {
          idleCount++;
          mapBounds = map.getBounds();
          if (idleCount === 1) return; // initial render — leave filter alone
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => applyFilters({preservePage: true}), 50);
        });

        syncMarkers();
        attachAutocomplete();
        // Init clusterer once map is ready
        loadClusterer().then(() => {
          if (!window.markerClusterer || clusterer) return;
          // Custom burgundy cluster icon (SVG inline)
          const renderer = {
            render: ({count, position}) => {
              const size = count < 10 ? 40 : count < 50 ? 48 : count < 100 ? 56 : 64;
              const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#661a34" fill-opacity="0.92" stroke="#fff" stroke-width="2"/></svg>`;
              return new google.maps.Marker({
                position,
                icon: {
                  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
                  scaledSize: new google.maps.Size(size, size),
                  anchor: new google.maps.Point(size/2, size/2)
                },
                label: { text: String(count), color: '#fff', fontFamily: 'Karla, sans-serif', fontSize: '14px', fontWeight: '700' },
                zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
              });
            }
          };
          clusterer = new window.markerClusterer.MarkerClusterer({
            map,
            markers: Array.from(markers.values()).filter(m => m.getMap()),
            renderer
          });
        }).catch(() => {});
        return map;
      });
    }

    function buildInfoContent(d) {
      const pinIcon = '<svg class="ona-sf__iw-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      const clockIcon = '<svg class="ona-sf__iw-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      const directions = d.directionsUrl ? `<a href="${d.directionsUrl}" target="_blank" rel="noopener" class="ona-sf__iw-btn">Get directions</a>` : '';
      const website = d.websiteUrl ? `<a href="${d.websiteUrl}" target="_blank" rel="noopener" class="ona-sf__iw-btn ona-sf__iw-btn--secondary">Website</a>` : '';
      // hoursHtml from card already contains a child .ona-sf__card-hours-text with the actual time text.
      // Pull just the text portion to render inline beside the clock icon.
      let hoursTextHtml = '';
      if (d.hoursHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = d.hoursHtml;
        const textEl = tmp.querySelector('.ona-sf__card-hours-text');
        hoursTextHtml = textEl ? textEl.innerHTML : d.hoursHtml;
      }
      const hours = hoursTextHtml ? `<div class="ona-sf__iw-hours">${clockIcon}<div class="ona-sf__iw-hours-text">${hoursTextHtml}</div></div>` : '';
      const addr = `<p class="ona-sf__iw-addr">${pinIcon}<span>${escapeHtml(d.address)}</span></p>`;
      const actions = (directions || website) ? `<div class="ona-sf__iw-actions">${directions}${website}</div>` : '';
      return `<div class="ona-sf__iw"><h4>${escapeHtml(d.title)}</h4><div class="ona-sf__iw-body">${addr}${hours}</div>${actions}</div>`;
    }

    function syncMarkers() {
      if (!map) return;
      const newlyCreated = [];
      const showing = [];
      const hidden = [];
      cards.forEach(card => {
        const d = getCardData(card);
        const inFilter = card.dataset.matchFilter === '1';
        let m = markers.get(d.id);
        if (!m && inFilter && isValidCoord(d.lat, d.lng)) {
          m = new google.maps.Marker({
            position: {lat: d.lat, lng: d.lng},
            // When clusterer is active, marker.map is managed by it; otherwise attach directly
            map: clusterer ? null : map,
            title: d.title,
            icon: markerIcon ? {
              url: markerIcon,
              scaledSize: new google.maps.Size(28, 38),
              anchor: new google.maps.Point(14, 38)
            } : undefined
          });
          newlyCreated.push(m);
          m.addListener('click', () => {
            // Close any existing InfoWindow first so its DOM is rebuilt cleanly on next open
            infoWindow.close();
            // Detach active marker from clusterer so it stays alive while InfoWindow is open
            if (clusterer) {
              if (activeMarkerId && markers.get(activeMarkerId) !== m) {
                const prev = markers.get(activeMarkerId);
                if (prev) { prev.setMap(null); clusterer.addMarker(prev); }
              }
              clusterer.removeMarker(m);
              m.setMap(map);
            }
            activeMarkerId = d.id;
            setActiveBounce(m);
            const iwW = isMobileViewport() ? Math.min(window.innerWidth - 40, 400) : 320;
            infoWindow.setOptions({maxWidth: iwW});
            infoWindow.setContent(buildInfoContent(d));
            // Defer open one frame to let the close DOM teardown settle
            requestAnimationFrame(() => {
              infoWindow.open(map, m);
            });
            cards.forEach(c => c.classList.toggle('is-active', c.dataset.id === d.id));
            applyFilters({preservePage: true});
            const target = cards.find(c => c.dataset.id === d.id);
            if (!target) return;
            if (isMobileViewport()) {
              // Mobile: card already at top, snap instantly
              listEl.scrollTop = 0;
            } else {
              // PC: card keeps its position; smooth-scroll within list so it lands at the top
              const offset = listEl.scrollTop + (target.getBoundingClientRect().top - listEl.getBoundingClientRect().top);
              listEl.scrollTo({top: offset, behavior: 'smooth'});
            }
          });
          markers.set(d.id, m);
          if (inFilter) showing.push(m);
        } else if (m) {
          if (inFilter) {
            showing.push(m);
            if (!clusterer) m.setMap(map);
          } else {
            hidden.push(m);
            if (!clusterer) m.setMap(null);
          }
        }
      });
      // Freeze clusterer rebuild while InfoWindow is open (active marker set).
      // Touching markers' .map while InfoWindow is anchored makes it close prematurely.
      if (clusterer && !activeMarkerId) {
        clusterer.clearMarkers();
        clusterer.addMarkers(showing);
      }
      if (activeMarkerId) {
        const am = markers.get(activeMarkerId);
        if (am) {
          if (am.getMap() !== map) am.setMap(map);
          // Re-apply bounce overlay if it got lost in rebuild
          if (!bounceOverlay) setActiveBounce(am);
        }
      }
    }

    function fitToVisibleMarkers() {
      if (!map) return;
      const bounds = new google.maps.LatLngBounds();
      let any = false;
      markers.forEach(m => {
        if (m.getMap()) { bounds.extend(m.getPosition()); any = true; }
      });
      if (any) {
        map.fitBounds(bounds, {top: 60, right: 60, bottom: 60, left: 60});
      }
    }

    function attachAutocomplete() {
      if (!searchInput || !window.google?.maps?.places) return;
      if (searchInput.dataset.acAttached === '1') return;
      const ac = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'au' },
        fields: ['geometry', 'formatted_address', 'name']
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry) return;
        const label = place.name || place.formatted_address || searchInput.value;
        const mapBtn = root.querySelector('[data-ona-sf-view="map"]');
        if (mapBtn && !mapBtn.classList.contains('is-active')) mapBtn.click();
        setUserPos(place.geometry.location.lat(), place.geometry.location.lng(), label, 'search');
      });
      searchInput.dataset.acAttached = '1';
    }

    function focusMarker(id) {
      const m = markers.get(id);
      if (!map || !m) return;
      const pos = m.getPosition();
      map.panTo(pos);
      // Zoom in past clustering threshold so the marker shows individually
      const targetZoom = 16;
      if (map.getZoom() < targetZoom) map.setZoom(targetZoom);
      // Give clusterer one frame to recalc, then open InfoWindow
      setTimeout(() => {
        google.maps.event.trigger(m, 'click');
      }, 250);
    }
    cards.forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('a, button')) return;
        if (!isMapView()) return;
        focusMarker(card.dataset.id);
      });
    });

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    loadGoogleMaps().then(attachAutocomplete).catch(() => {});

    // Initial map view: ensure map is created and fit to all markers
    ensureMap().then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!map) return;
          google.maps.event.trigger(map, 'resize');
          if (!userPannedMap) fitToVisibleMarkers();
        });
      });
    });

    // Custom scrollbar with grab cursor (only shown when list is in map view + overflowing)
    let scrollBarEl, scrollThumbEl;
    (function initCustomScrollbar() {
      if (!listEl) return;
      const wrap = document.createElement('div');
      wrap.className = 'ona-sf__list-wrap';
      listEl.parentNode.insertBefore(wrap, listEl);
      wrap.appendChild(listEl);
      scrollBarEl = document.createElement('div');
      scrollBarEl.className = 'ona-sf__scrollbar';
      scrollThumbEl = document.createElement('div');
      scrollThumbEl.className = 'ona-sf__scrollbar-thumb';
      scrollBarEl.appendChild(scrollThumbEl);
      wrap.appendChild(scrollBarEl);

      function update() {
        const visible = listEl.clientHeight;
        const total = listEl.scrollHeight;
        // Only show in map view + when actually scrollable + on desktop (mobile uses page scroll)
        const inMap = isMapView();
        const shouldShow = inMap && total > visible + 4 && !isMobileViewport();
        scrollBarEl.classList.toggle('is-visible', shouldShow);
        if (!shouldShow) return;
        const trackH = scrollBarEl.clientHeight;
        const thumbH = Math.max(24, Math.floor((visible / total) * trackH));
        scrollThumbEl.style.height = thumbH + 'px';
        const maxScroll = total - visible;
        const pct = maxScroll > 0 ? listEl.scrollTop / maxScroll : 0;
        scrollThumbEl.style.top = (pct * (trackH - thumbH)) + 'px';
      }

      listEl.addEventListener('scroll', update);
      window.addEventListener('resize', update);
      // MutationObserver to re-update when cards change
      const mo = new MutationObserver(update);
      mo.observe(listEl, {childList: true, subtree: false, attributes: true, attributeFilter: ['style']});

      // Drag thumb
      let dragging = false, dragStartY = 0, dragStartScroll = 0;
      scrollThumbEl.addEventListener('mousedown', e => {
        dragging = true;
        scrollThumbEl.classList.add('is-dragging');
        dragStartY = e.clientY;
        dragStartScroll = listEl.scrollTop;
        e.preventDefault();
      });
      document.addEventListener('mousemove', e => {
        if (!dragging) return;
        const trackH = scrollBarEl.clientHeight;
        const thumbH = scrollThumbEl.clientHeight;
        const maxScroll = listEl.scrollHeight - listEl.clientHeight;
        const ratio = maxScroll / (trackH - thumbH);
        listEl.scrollTop = dragStartScroll + (e.clientY - dragStartY) * ratio;
      });
      document.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        scrollThumbEl.classList.remove('is-dragging');
      });

      // Initial paint + on view change
      update();
      // Expose for view-toggle / filter callers
      window.__onaSfRefreshScrollbar = update;
    })();

    // Re-apply pagination when crossing mobile/desktop breakpoint
    let lastIsMobile = isMobileViewport();
    window.addEventListener('resize', () => {
      const nowMobile = isMobileViewport();
      if (nowMobile !== lastIsMobile) {
        lastIsMobile = nowMobile;
        applyFilters({preservePage: true});
      }
    });

    applyFilters();

    // Auto-attempt geolocation on first load. If user denies / times out, leave userPos null
    // (slider will fall back to Canberra only when user actively drags it).
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          initialUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPos(pos.coords.latitude, pos.coords.longitude, 'your location', 'nearby');
        },
        () => {},
        { timeout: 6000, maximumAge: 600000 }
      );
    }
  }
})();
