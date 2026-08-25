import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("=== ErrorBoundary caught an error ===");
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    console.error("Component stack:", errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    // Colours here are deliberately hardcoded rather than tokenised. This is
    // the screen that renders when something has already failed — possibly the
    // token layer itself — so it must not depend on anything the app loads.
    //
    // The heading was #E08585. §15 allows red only for a destructive
    // confirmation, and a crash is not one: the point is to be legible and calm,
    // not alarming.
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#E8EDF2", background: "#0B1526", minHeight: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ color: "#E8EDF2" }}>Something's snagged. Try again.</h2>
          <p>Check the console for the full error (message, stack, and component stack are logged there).</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.8, marginTop: 16 }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, minHeight: 44, padding: "10px 18px", background: "#E8EDF2", color: "#0B1526", border: "none", borderRadius: 8, cursor: "pointer", font: "inherit" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
