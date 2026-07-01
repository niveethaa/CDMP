import HomePage from "./pages/HomePage";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";
 
export default function App() {
  return (
    <ErrorBoundary label="the donation map platform">
      <HomePage />
    </ErrorBoundary>
  );
}