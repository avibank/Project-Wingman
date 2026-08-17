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
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#E8EDF2", background: "#0B1526", minHeight: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ color: "#E08585" }}>Something crashed</h2>
          <p>Check the console for the full error (message, stack, and component stack are logged there).</p>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.8, marginTop: 16 }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "8px 16px", background: "#6FA0F0", color: "#0E1830", border: "none", borderRadius: 8, cursor: "pointer" }}
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
