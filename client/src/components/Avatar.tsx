interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
}

export function Avatar({ name, color, size = 'md' }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const sizeClass = size === 'sm' ? ' avatar-sm' : '';
  return (
    <span className={`avatar${sizeClass}`} style={{ background: color }}>
      {initial}
    </span>
  );
}
