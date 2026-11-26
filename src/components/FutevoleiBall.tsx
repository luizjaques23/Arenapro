import type { SVGProps } from 'react';

export function FutevoleiBall({ className = 'w-10 h-10', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="50" cy="50" r="46" fill="#F8FAFC" stroke="#0F172A" strokeWidth="5" />
      <path
        d="M50 4 C58 22, 74 34, 95 39"
        stroke="#0F172A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 4 C42 22, 26 34, 5 39"
        stroke="#0F172A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 96 C58 78, 74 66, 95 61"
        stroke="#0F172A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 96 C42 78, 26 66, 5 61"
        stroke="#0F172A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 32 L67 44 L61 64 L39 64 L33 44 Z"
        fill="#F59E0B"
        stroke="#0F172A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M15 22 C24 30, 29 36, 33 44"
        stroke="#10B981"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M85 22 C76 30, 71 36, 67 44"
        stroke="#10B981"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M21 82 C28 74, 34 69, 39 64"
        stroke="#10B981"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M79 82 C72 74, 66 69, 61 64"
        stroke="#10B981"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
