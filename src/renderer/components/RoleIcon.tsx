import { useState } from 'react';
import { getRoleIconCandidates } from '../utils/role-icons';
import './RoleIcon.css';

type RoleIconProps = { roleId: number; label: string; faction?: number };

function RoleIconImage({ roleId, label, faction }: RoleIconProps) {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const candidates = getRoleIconCandidates(roleId);
  const src = candidates[index];

  return (
    <i className={`stats-role-icon faction-${faction || 0}`} title={label} aria-hidden="true">
      {!loaded && <span className="stats-role-icon-fallback">{label.startsWith('未知') ? '?' : label.charAt(0) || '?'}</span>}
      {src && <img
        key={src}
        src={src}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        className={loaded ? 'is-loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => { setLoaded(false); setIndex(current => current + 1); }}
      />}
    </i>
  );
}

export default function RoleIcon(props: RoleIconProps) {
  // Reset failure/loading state when React reuses a row for another role.
  return <RoleIconImage key={props.roleId} {...props} />;
}
