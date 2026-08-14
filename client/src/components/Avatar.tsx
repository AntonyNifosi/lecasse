interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

export function Avatar({ name, color, size = 'md' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`avatar${size === 'sm' ? ' avatar-sm' : ''}`} style={{ background: color }}>
      {initial}
    </span>
  );
}
