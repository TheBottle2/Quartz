interface LogoProps {
  size?: number;
}

export function Logo({ size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <polygon points="368,384 470,384 470,800 368,800" fill="#5f8dd0" />
      <polygon points="470,384 554,384 554,800 470,800" fill="#b6d2f6" />
      <polygon points="554,384 656,384 656,800 554,800" fill="#33588d" />
      <polygon points="512,232 368,384 470,384" fill="#82b0ea" />
      <polygon points="512,232 470,384 554,384" fill="#e3efff" />
      <polygon points="512,232 554,384 656,384" fill="#547ec4" />
    </svg>
  );
}