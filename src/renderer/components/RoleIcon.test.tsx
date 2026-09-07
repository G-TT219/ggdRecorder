import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RoleIcon from './RoleIcon';
import { getRoleIconCandidates } from '../utils/role-icons';

describe('official role icons', () => {
  it('maps all currently known ids, including the new roles and mode aliases', () => {
    const missingIds = new Set([5, 53, 54, 58, 88, 105, 107]);
    for (let id = 1; id <= 113; id += 1) {
      expect(getRoleIconCandidates(id)).toHaveLength(missingIds.has(id) ? 0 : 1);
    }
    expect(getRoleIconCandidates(112)[0]).toBe(`${import.meta.env.BASE_URL}assets/role-icons/Swordsman.png`);
    expect(getRoleIconCandidates(113)[0]).toContain('/Magpie.png');
    expect(getRoleIconCandidates(35)).toEqual(getRoleIconCandidates(1));
    expect(getRoleIconCandidates(110)).toEqual([
      `${import.meta.env.BASE_URL}assets/role-icons/WitchDoctor.png`,
    ]);
    expect(getRoleIconCandidates(9999)).toEqual([]);
  });

  it('keeps a fallback until the lazy-loaded image is ready', () => {
    const { container } = render(<RoleIcon roleId={112} label="剑客" faction={1} />);
    const img = container.querySelector('img')!;
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(container.querySelector('.stats-role-icon-fallback')).toHaveTextContent('剑');
    fireEvent.load(img);
    expect(img).toHaveClass('is-loaded');
    expect(container.querySelector('.stats-role-icon-fallback')).toBeNull();
  });

  it('falls back to text without remote requests when the local image fails', () => {
    const { container } = render(<RoleIcon roleId={110} label="巫医" />);
    for (const candidate of getRoleIconCandidates(110)) {
      const img = container.querySelector('img')!;
      expect(img).toHaveAttribute('src', candidate);
      fireEvent.error(img);
    }
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.stats-role-icon-fallback')).toHaveTextContent('巫');
  });

  it('resets failed image state when the role changes', () => {
    const { container, rerender } = render(<RoleIcon roleId={112} label="剑客" />);
    while (container.querySelector('img')) fireEvent.error(container.querySelector('img')!);
    rerender(<RoleIcon roleId={113} label="喜鹊" />);
    expect(container.querySelector('img')).toHaveAttribute('src', getRoleIconCandidates(113)[0]);
    rerender(<RoleIcon roleId={9999} label="未知角色（9999）" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.stats-role-icon-fallback')).toHaveTextContent('?');
  });
});
