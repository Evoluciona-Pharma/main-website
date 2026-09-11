import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RequestListDrawer } from './RequestDrawer';
import { RequestListProvider, useRequestList } from './RequestListContext';

const list = [
  { name: 'NAD+', cat: 'Longevity & Cellular Health', dose: '5 mL', quantity: 1, remove: () => {} },
];

function renderDrawer(onClose = () => {}) {
  return render(
    <RequestListDrawer open count={1} list={list} onAdd={() => {}} onQty={() => {}} onClose={onClose} />,
  );
}

/** The drawer used to be a bare <div>: focus never entered it, every control
    behind it stayed tabbable, and the page scrolled underneath. */
describe('RequestListDrawer', () => {
  it('exposes itself as a modal dialog named by its heading', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog', { name: 'Request list' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the drawer on open', async () => {
    renderDrawer();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Close request list' })).toHaveFocus(),
    );
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDrawer(onClose);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('traps Tab inside the panel', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const dialog = screen.getByRole('dialog');

    // Walk well past the number of controls in the panel; focus must never escape.
    for (let i = 0; i < 30; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('locks background scrolling while open and restores it after', () => {
    const { unmount } = renderDrawer();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('hides the overlay from assistive tech', () => {
    const { container } = renderDrawer();
    expect(container.querySelector('.fixed.inset-0')).toHaveAttribute('aria-hidden', 'true');
  });

  it('has no axe violations', async () => {
    const { container } = renderDrawer();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/** Pressing the primary CTA used to produce no perceptible feedback at all for
    a screen-reader user — the drawer slides in and the nav badge ticks up,
    neither of which is announced. */
describe('request list announcements', () => {
  function Harness() {
    const { add, remove } = useRequestList();
    return (
      <>
        <button onClick={() => add({ name: 'NAD+', program: 'Longevity', presentation: '5 mL' })}>
          Add NAD+
        </button>
        <button onClick={() => remove('NAD+')}>Remove NAD+</button>
      </>
    );
  }

  it('announces additions and removals with the running count', async () => {
    const user = userEvent.setup();
    render(
      <RequestListProvider>
        <Harness />
      </RequestListProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add NAD+' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'NAD+ added to your request list. 1 item in list.',
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Remove NAD+' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'NAD+ removed from your request list. 0 items in list.',
      ),
    );
  });
});
