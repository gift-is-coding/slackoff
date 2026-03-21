"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "12px",
            fontFamily: "monospace",
            color: "#ef4444",
            background: "#0a0a0a",
          }}
        >
          <div style={{ fontSize: "1.2rem", fontWeight: 600 }}>
            Something went wrong
          </div>
          <div
            style={{ fontSize: "0.85rem", color: "#999", maxWidth: "480px", textAlign: "center" }}
          >
            {this.state.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "6px 18px",
              background: "transparent",
              border: "1px solid #444",
              color: "#ccc",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: "0.85rem",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
