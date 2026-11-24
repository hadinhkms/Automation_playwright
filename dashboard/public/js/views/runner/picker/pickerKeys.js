/**
 * dashboard/public/js/views/runner/picker/pickerKeys.js
 * Keyboard of the tree (APG "Tree View" with checkboxes, HANDOFF 5.4). Arrow keys never trap focus (Tab leaves).
 */
const visibleItems = (tree) => [...tree.querySelectorAll('[role="treeitem"]')].filter((el) => !el.parentElement.closest('ul[hidden]'));

export function handleTreeKey(e, tree, actions) {
  const item = e.target.closest && e.target.closest('[role="treeitem"]');
  if (!item || !tree.contains(item)) return false;
  const items = visibleItems(tree);
  const i = items.indexOf(item);
  const isGroup = item.getAttribute('aria-level') === '1';
  const open = item.getAttribute('aria-expanded') === 'true';
  const go = (el) => { if (el) actions.focus(el); };
  const handled = (fn) => { e.preventDefault(); fn(); return true; };
  switch (e.key) {
    case 'ArrowDown': return handled(() => go(items[i + 1]));
    case 'ArrowUp': return handled(() => go(items[i - 1]));
    case 'Home': return handled(() => go(items[0]));
    case 'End': return handled(() => go(items[items.length - 1]));
    case 'ArrowRight': return handled(() => { if (!isGroup) return; if (!open) actions.expand(item, true); else go(item.querySelector('[role="treeitem"]')); });
    case 'ArrowLeft': return handled(() => { if (isGroup) { if (open) actions.expand(item, false); } else go(item.parentElement.closest('[role="treeitem"]')); });
    case ' ': return handled(() => actions.toggle(item));
    case 'Enter': return handled(() => (isGroup ? actions.expand(item, !open) : actions.toggle(item)));
    case 'a': case 'A': if (!(e.ctrlKey || e.metaKey)) return false; return handled(() => actions.selectAll());
    case 'Escape': return handled(() => actions.focusSearch());
    default: return false;
  }
}
