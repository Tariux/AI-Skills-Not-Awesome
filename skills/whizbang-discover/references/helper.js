// Whizbang Visual Companion Helper - injected into every page
// Provides toggleSelect for options/cards and basic interaction tracking

(function() {
  'use strict';

  // Track selections for event logging
  const selections = new Map();

  window.toggleSelect = function(el) {
    const choice = el.dataset.choice;
    const wasSelected = el.classList.contains('selected');
    el.classList.toggle('selected');

    // Log selection event
    const event = {
      type: wasSelected ? 'deselect' : 'select',
      choice: choice,
      text: el.querySelector('h3')?.textContent || el.querySelector('.mockup-header')?.textContent || choice,
      timestamp: Date.now()
    };
    selections.set(choice, event);
    sendEvent(event);
  };

  // Send event to server via WebSocket
  function sendEvent(event) {
    if (window.ws && window.ws.readyState === WebSocket.OPEN) {
      window.ws.send(JSON.stringify(event));
    }
  }

  // Auto-initialize multi-select containers
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-multiselect]').forEach(container => {
      // Multi-select: clicks toggle independently
      container.querySelectorAll('.option, .card').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('button, input, a')) return;
          toggleSelect(el);
        });
      });
    });
  });

  // Expose for manual use
  window.whizbang = {
    getSelections: () => Array.from(selections.values()),
    sendEvent
  };
})();