import React from "react";

export function Badge({
  tone = "pill",
  variant = "brand",
  children
}: {
  tone?: "pill" | "tag";
  variant?: "brand" | "success" | "warn" | "danger" | "default";
  children: React.ReactNode;
}) {
  const base = tone === "tag" ? "tag" : "pill";
  const color =
    variant === "success" ? "pill-success" :
    variant === "warn" ? "pill-warn" :
    variant === "danger" ? "pill-danger" :
    variant === "brand" ? "pill-brand" : "pill";
  return <span className={`${base} ${color}`}>{children}</span>;
}

