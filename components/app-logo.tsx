import React from "react";

export function AppLogo({ source, className = "" }: { source: string; className?: string }) {
  const lower = source.toLowerCase();
  
  let content = null;

  if (lower.includes("wechat")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 11c-3.3 0-6-2.5-6-5.5S3.7 0 7 0s6 2.5 6 5.5-2.7 5.5-6 5.5zm11 1.5c-2.8 0-5-2-5-4.5s2.2-4.5 5-4.5 5 2 5 4.5-2.2 4.5-5 4.5z" stroke="#07C160" fill="#07C160" />
        <circle cx="5" cy="4" r=".5" fill="#fff" />
        <circle cx="9" cy="4" r=".5" fill="#fff" />
        <circle cx="16" cy="6" r=".5" fill="#fff" />
        <circle cx="20" cy="6" r=".5" fill="#fff" />
        <path d="M4.5 11l-2 2v-2" stroke="#07C160" />
        <path d="M15.5 12.5l-2 2v-2" stroke="#07C160" />
      </svg>
    );
  } else if (lower.includes("slack")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 14h3v3a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3zm0-2a3 3 0 0 1-3-3 3 3 0 0 1 3-3h3v3a3 3 0 0 1-3 3z" fill="#E01E5A" />
        <path d="M10 5V2a3 3 0 0 1 3-3 3 3 0 0 1 3 3v3h-3a3 3 0 0 1-3-3zm2 0a3 3 0 0 1 3 3 3 3 0 0 1-3 3V8a3 3 0 0 1-3-3z" fill="#36C5F0" />
        <path d="M19 10h-3V7a3 3 0 0 1 3-3 3 3 0 0 1 3 3 3 3 0 0 1-3 3zm0 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3h-3v-3a3 3 0 0 1 3-3z" fill="#2EB67D" />
        <path d="M14 19v3a3 3 0 0 1-3 3 3 3 0 0 1-3-3v-3h3a3 3 0 0 1 3 3zm-2 0a3 3 0 0 1-3-3 3 3 0 0 1 3-3v3a3 3 0 0 1 3 3z" fill="#ECB22E" />
      </svg>
    );
  } else if (lower.includes("teams")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" fill="#5A5EB9" stroke="#5A5EB9" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" fill="#5A5EB9" stroke="#5A5EB9" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="#5A5EB9" stroke="#5A5EB9" />
        <path d="M2 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" fill="#5A5EB9" stroke="#5A5EB9" />
        <text x="12" y="16" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">T</text>
      </svg>
    );
  } else if (lower.includes("email") || lower.includes("outlook")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="#0078D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  } else if (lower.includes("feishu")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="#00D6B9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#00D6B9" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    );
  } else if (lower.includes("wework")) {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="#0066FF" />
        <text x="12" y="15" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">W</text>
      </svg>
    );
  } else {
    content = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }

  return (
    <span className={`app-logo ${className}`} style={{ display: "inline-flex", width: "16px", height: "16px", marginRight: "6px", verticalAlign: "middle" }}>
      {content}
    </span>
  );
}
