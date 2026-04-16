export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner">
      <strong>Error:</strong> {message}
    </div>
  );
}
