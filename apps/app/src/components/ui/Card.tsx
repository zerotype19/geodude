import { cn } from "./cn";
import React from "react";

export function Card({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("card", className)}>{children}</div>;
}

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <div className={cn("card-header", className)}>{children}</div>;

export const CardBody = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <div className={cn("card-body", className)}>{children}</div>;

export const CardFooter = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <div className={cn("card-footer", className)}>{children}</div>;

