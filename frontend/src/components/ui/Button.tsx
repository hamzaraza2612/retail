import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300",
  secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
};

export default function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  const sizeClass = size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-4 py-2 text-sm";
  return (
    <button
      className={`${sizeClass} rounded-md font-medium transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
