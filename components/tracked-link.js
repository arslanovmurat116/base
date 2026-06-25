"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackMiniAppEvent } from "./miniapp-launch-client";

function isExternalHref(href) {
  return /^https?:\/\//i.test(String(href || ""));
}

export default function TrackedLink({
  href,
  className,
  children,
  eventLabel,
  eventSource = "ui",
  target,
  rel,
  ...props
}) {
  const pathname = usePathname();

  const handleClick = () => {
    void trackMiniAppEvent("button_click", {
      label: eventLabel || (typeof children === "string" ? children : "button"),
      source: eventSource,
      from: pathname,
      target: String(href || "")
    });
  };

  if (isExternalHref(href) || target === "_blank") {
    return (
      <a
        className={className}
        href={href}
        onClick={handleClick}
        rel={rel}
        target={target}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
