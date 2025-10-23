import React from "react";
import { cn } from "./cn";

export function Button({
  variant = "primary",
  className,
  ...props
}: {
  variant?: "primary" | "soft" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = variant === "soft" ? "btn-soft" : variant === "ghost" ? "btn-ghost" : "btn-primary";
  return <button className={cn("btn", v, className)} {...props} />;
}

