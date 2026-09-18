import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Input } from "../components/ui/Input";
import Button from "../components/ui/Button";
import { errorMessage } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Chicken Wholesale & Supply</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your business dashboard</p>
        <form onSubmit={handleSubmit}>
          <Input label="Username" required value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="mt-6 text-xs text-gray-400 border-t pt-4">
          <p className="font-medium text-gray-500 mb-1">Demo accounts (password shown after username):</p>
          <p>admin / Admin@123 &middot; manager / Manager@123</p>
          <p>sales / Sales@123 &middot; cashier / Cashier@123</p>
          <p>storekeeper / Store@123 &middot; delivery / Delivery@123</p>
        </div>
      </div>
    </div>
  );
}
