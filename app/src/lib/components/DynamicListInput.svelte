<script lang="ts">
  import { X, GripVertical, Plus, ChevronUp, ChevronDown } from 'lucide-svelte';
  import { tick } from 'svelte';

  interface RecipeItem {
    id: string;
    text: string;
    order: number;
    checked?: boolean;
  }

  interface Props {
    items: RecipeItem[];
    placeholder?: string;
    label: string;
    required?: boolean;
    onChange: (items: RecipeItem[]) => void;
  }

  let { items, placeholder, label, required, onChange }: Props = $props();

  // Generate a unique ID for new items
  function generateId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add a new empty item at the end
  function addItem() {
    const newItem: RecipeItem = {
      id: generateId(),
      text: '',
      order: items.length,
    };
    const newItems = [...items, newItem];
    onChange(newItems);
    // Auto-focus the new item's input after render
    tick().then(() => {
      const inputs = document.querySelectorAll('.dynamic-list-input .item-input');
      const lastTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
      if (lastTextarea) {
        lastTextarea.focus();
        autoResize(lastTextarea);
      }
    });
  }

  // Remove an item by ID
  function removeItem(id: string) {
    const newItems = items
      .filter((item) => item.id !== id)
      .map((item, index) => ({ ...item, order: index }));
    onChange(newItems);
  }

  // Update item text
  function updateItem(id: string, text: string) {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, text } : item
    );
    onChange(newItems);
  }

  // Reorder functions
  function moveItemUp(id: string) {
    const index = items.findIndex((i) => i.id === id);
    if (index <= 0) return;

    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];

    // Update order properties
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    onChange(reordered);
  }

  function moveItemDown(id: string) {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1 || index >= items.length - 1) return;

    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];

    // Update order properties
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    onChange(reordered);
  }

  // Drag and drop state
  let draggedItem: RecipeItem | null = null;
  let dragOverIndex: number | null = null;

  function handleDragStart(event: DragEvent, item: RecipeItem) {
    draggedItem = item;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    dragOverIndex = null;

    if (!draggedItem) return;

    const dragIndex = items.findIndex((i) => i.id === draggedItem.id);
    if (dragIndex === dropIndex) return;

    const newItems = [...items];
    newItems.splice(dragIndex, 1);

    // Insert at drop position (adjust if dropping after the removed item)
    const insertIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newItems.splice(insertIndex, 0, draggedItem);

    // Update order properties
    const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
    onChange(reordered);

    draggedItem = null;
  }

  function handleDragEnd() {
    draggedItem = null;
    dragOverIndex = null;
  }

  // Touch-based reordering (since HTML5 drag doesn't work on mobile)
  let touchStartY = 0;
  let touchDraggedItem: RecipeItem | null = null;
  let touchStartTime = 0;
  const TOUCH_DRAG_THRESHOLD = 10; // pixels
  const TOUCH_TIME_THRESHOLD = 500; // ms

  function handleTouchStart(event: TouchEvent, item: RecipeItem) {
    if (event.touches.length !== 1) return;

    touchStartY = event.touches[0].clientY;
    touchDraggedItem = item;
    touchStartTime = Date.now();
  }

  function handleTouchMove(event: TouchEvent) {
    if (!touchDraggedItem || event.touches.length !== 1) return;

    const currentY = event.touches[0].clientY;
    const deltaY = Math.abs(currentY - touchStartY);

    // Only activate drag after threshold
    if (deltaY > TOUCH_DRAG_THRESHOLD && Date.now() - touchStartTime < TOUCH_TIME_THRESHOLD) {
      event.preventDefault();
      // Visual feedback could be added here
    }
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!touchDraggedItem) return;

    // Determine if this was a tap or a drag
    const deltaY = Math.abs((event.changedTouches[0]?.clientY || 0) - touchStartY);
    const deltaTime = Date.now() - touchStartTime;

    if (deltaY < TOUCH_DRAG_THRESHOLD || deltaTime > TOUCH_TIME_THRESHOLD) {
      // It's a tap, ignore
      touchDraggedItem = null;
      return;
    }

    // Calculate which item we dropped on based on touch end position
    const elements = document.elementsFromPoint(
      event.changedTouches[0]?.clientX || 0,
      event.changedTouches[0]?.clientY || 0
    );

    const itemRow = elements.find(el => el.classList.contains('item-row'));
    if (itemRow) {
      const dropIndex = parseInt(itemRow.getAttribute('data-index') || '-1');
      if (dropIndex !== -1 && dropIndex !== items.findIndex(i => i.id === touchDraggedItem.id)) {
        const dragIndex = items.findIndex(i => i.id === touchDraggedItem.id);
        const newItems = [...items];
        newItems.splice(dragIndex, 1);
        const insertIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
        newItems.splice(insertIndex, 0, touchDraggedItem);

        const reordered = newItems.map((item, idx) => ({ ...item, order: idx }));
        onChange(reordered);
      }
    }

    touchDraggedItem = null;
  }

  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent, id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Enter key: Add new item
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addItem();
    }

    // Backspace on empty item: Remove it and focus previous
    if (event.key === 'Backspace' && item.text === '') {
      event.preventDefault();
      const itemIndex = items.findIndex((i) => i.id === id);
      if (items.length > 1) {
        removeItem(id);
        // Focus the previous item's input after render
        tick().then(() => {
          const inputs = document.querySelectorAll('.dynamic-list-input .item-input');
          const targetIndex = Math.max(0, itemIndex - 1);
          const targetInput = inputs[targetIndex] as HTMLInputElement;
          if (targetInput) {
            targetInput.focus();
          }
        });
      }
    }
  }

  // Handle textarea input with auto-resize
  function handleTextareaInput(event: Event, id: string) {
    const target = event.target as HTMLTextAreaElement;
    updateItem(id, target.value);
    autoResize(target);
  }

  // Auto-resize textarea to fit content
  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }

  // Handle textarea keydown - prevent enter from creating newlines, use it to add item
  function handleTextareaKeydown(event: KeyboardEvent, id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Enter key: Add new item (but Shift+Enter allows newline in textarea)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      addItem();
    }

    // Backspace on empty item: Remove it and focus previous
    if (event.key === 'Backspace' && item.text === '') {
      event.preventDefault();
      const itemIndex = items.findIndex((i) => i.id === id);
      if (items.length > 1) {
        removeItem(id);
        // Focus the previous item's textarea after render
        tick().then(() => {
          const textareas = document.querySelectorAll('.dynamic-list-input .item-input');
          const targetIndex = Math.max(0, itemIndex - 1);
          const targetTextarea = textareas[targetIndex] as HTMLTextAreaElement;
          if (targetTextarea) {
            targetTextarea.focus();
            // Move cursor to end
            targetTextarea.setSelectionRange(targetTextarea.value.length, targetTextarea.value.length);
          }
        });
      }
    }
  }

  // Handle legacy input event
  function handleInput(event: Event, id: string) {
    const target = event.target as HTMLInputElement;
    updateItem(id, target.value);
  }
</script>

<div class="dynamic-list-input">
  <label class="list-label">
    {label}
    {#if required}<span class="required">*</span>{/if}
  </label>

  <div class="items-container">
    {#if items.length === 0}
      <div class="empty-state">
        <span class="empty-text">No {label.toLowerCase()} yet. Click "Add {label}" to get started.</span>
      </div>
    {:else}
      {#each [...items].sort((a, b) => a.order - b.order) as item (item.id)}
        {@const isFirst = item.order === 0}
        {@const isLast = item.order === items.length - 1}
        <div
          class="item-row"
          class:dragging={draggedItem?.id === item.id}
          class:drag-over={dragOverIndex === item.order}
          draggable="true"
          ondragstart={(e) => handleDragStart(e, item)}
          ondragover={(e) => handleDragOver(e, item.order)}
          ondragleave={handleDragLeave}
          ondrop={(e) => handleDrop(e, item.order)}
          ondragend={handleDragEnd}
          ontouchstart={(e) => handleTouchStart(e, item)}
          ontouchmove={handleTouchMove}
          ontouchend={handleTouchEnd}
          data-index={item.order}
          role="listitem"
          aria-grabbed={draggedItem?.id === item.id}
        >
          <span class="drag-handle" aria-hidden="true">
            <GripVertical size={18} />
          </span>

          <textarea
            class="item-input"
            value={item.text}
            {placeholder}
            oninput={(e) => handleTextareaInput(e, item.id)}
            onkeydown={(e) => handleTextareaKeydown(e, item.id)}
            aria-label="{label} item {item.order + 1}"
            rows="1"
          ></textarea>

          <div class="reorder-buttons">
            <button
              type="button"
              class="move-up-btn"
              onclick={() => moveItemUp(item.id)}
              disabled={isFirst}
              aria-label="Move {label} up"
              title="Move up"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              class="move-down-btn"
              onclick={() => moveItemDown(item.id)}
              disabled={isLast}
              aria-label="Move {label} down"
              title="Move down"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          {#if items.length > 1}
            <button
              type="button"
              class="remove-btn"
              onclick={() => removeItem(item.id)}
              aria-label="Remove {label.toLowerCase()} item {item.order + 1}"
              title="Remove item"
            >
              <X size={18} />
            </button>
          {/if}

          {#if isLast}
            <button
              type="button"
              class="add-inline-btn"
              onclick={addItem}
              aria-label="Add {label.toLowerCase()}"
              title="Add {label}"
            >
              <Plus size={18} />
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  {#if items.length === 0}
    <button type="button" class="add-btn" onclick={addItem}>
      <Plus size={18} />
      <span>Add {label}</span>
    </button>
  {/if}
</div>

<style>
  .dynamic-list-input {
    width: 100%;
  }

  .list-label {
    display: block;
    font-weight: var(--font-semibold);
    margin-bottom: var(--spacing-3);
    color: var(--color-text);
    font-size: var(--text-sm);
  }

  .required {
    color: var(--color-error);
    margin-left: var(--spacing-1);
  }

  .items-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-3);
  }

  .empty-state {
    padding: var(--spacing-4);
    background: var(--color-bg-subtle);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    text-align: center;
  }

  .empty-text {
    color: var(--color-text-light);
    font-size: var(--text-sm);
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-1) var(--spacing-2);
    transition: var(--transition-normal);
    touch-action: none; /* Prevent scroll during touch drag */
  }

  .item-row:hover {
    border-color: var(--color-border-light);
    box-shadow: var(--shadow-sm);
  }

  .item-row:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(224, 122, 82, 0.1);
  }

  .item-row.dragging {
    opacity: 0.5;
    transform: scale(0.98);
  }

  .item-row.drag-over {
    border-color: var(--color-primary);
    border-style: dashed;
  }

  .drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-light);
    cursor: grab;
    padding: var(--spacing-1);
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .drag-handle:hover {
    color: var(--color-text);
    background: var(--color-bg-subtle);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .move-up-btn,
  .move-down-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    padding: 0;
    border: none;
    background: var(--color-bg-subtle);
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .move-up-btn:hover:not(:disabled),
  .move-down-btn:hover:not(:disabled) {
    background: var(--color-border);
    color: var(--color-text);
  }

  .move-up-btn:disabled,
  .move-down-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .move-up-btn:focus-visible,
  .move-down-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .item-input {
    flex: 1;
    min-width: 0;
    padding: var(--spacing-2) var(--spacing-3);
    border: none;
    background: transparent;
    font-size: var(--text-base);
    font-family: inherit;
    color: var(--color-text);
    outline: none;
    min-height: 44px;
    resize: none;
    overflow: hidden;
    line-height: 1.5;
    max-height: 200px;
    field-sizing: content;
  }

  .item-input::placeholder {
    color: var(--color-text-light);
    opacity: 0.6;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: #fef2f2;
    color: var(--color-error);
  }

  .remove-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .add-inline-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-text-light);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
    flex-shrink: 0;
  }

  .add-inline-btn:hover {
    background: rgba(34, 197, 94, 0.1);
    color: var(--color-success, #22c55e);
  }

  .add-inline-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .reorder-buttons {
    display: flex;
    flex-direction: row;
    gap: 2px;
    flex-shrink: 0;
  }

  .add-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-1);
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-light);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: var(--transition-normal);
    min-height: 32px;
  }

  .add-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: rgba(224, 122, 82, 0.05);
  }

  .add-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .add-btn:active {
    transform: translateY(1px);
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .item-row {
      padding: var(--spacing-1) var(--spacing-2);
    }

    .item-input {
      font-size: 16px; /* Prevent iOS zoom on focus */
      min-height: 48px;
    }

    .drag-handle {
      display: none; /* Hide drag handle on mobile for cleaner UI */
    }

    .move-up-btn,
    .move-down-btn {
      width: 32px;
      height: 32px;
    }

    .remove-btn {
      width: 48px;
      height: 48px;
    }

    .add-inline-btn {
      width: 48px;
      height: 48px;
      min-width: 48px;
      min-height: 48px;
    }

    .add-btn {
      width: auto;
      min-height: 36px;
      padding: var(--spacing-2) var(--spacing-4);
    }
  }

  @media (max-width: 480px) {
    .items-container {
      gap: var(--spacing-3);
    }

    .item-row {
      padding: var(--spacing-2);
    }

    .empty-state {
      padding: var(--spacing-3);
    }

    .move-up-btn,
    .move-down-btn {
      width: 32px;
      height: 32px;
    }
  }
</style>
