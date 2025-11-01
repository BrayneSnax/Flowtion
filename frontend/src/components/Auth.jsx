import { useState } from "react";
import { Sparkles, Search, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const stateGradients = {
  germinating: "from-green-50 to-emerald-50",
  active: "from-orange-50 to-red-50",
  cooling: "from-blue-50 to-cyan-50",
  crystallized: "from-slate-50 to-gray-50",
  turbulent: "from-purple-50 to-pink-50"
};

export default function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? `${API}/auth/login` : `${API}/auth/register`;
      const data = isLogin ? { email, password } : { email, password, name };
      
      const response = await axios.post(endpoint, data);
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      toast.success(isLogin ? "Welcome back" : "Workspace created");
      onAuth();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 content-fade-in">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Layers className="w-12 h-12 text-indigo-600" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
              Notex
            </h1>
          </div>
          <p className="text-slate-600 text-lg">Your intuitive, non-linear workspace</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Germinating
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Cooling
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              Crystallized
            </span>
          </div>
        </div>

        <Card className="shadow-xl border-slate-200/60 backdrop-blur-sm bg-white/80 content-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl">{isLogin ? "Welcome back" : "Create workspace"}</CardTitle>
            <CardDescription>
              {isLogin ? "Enter your flow" : "Begin your journey"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" data-testid="name-label">Name</Label>
                  <Input
                    id="name"
                    data-testid="name-input"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="h-11"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" data-testid="email-label">Email</Label>
                <Input
                  id="email"
                  data-testid="email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" data-testid="password-label">Password</Label>
                <Input
                  id="password"
                  data-testid="password-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
                disabled={loading}
                data-testid="auth-submit-button"
              >
                {loading ? "Loading..." : (isLogin ? "Enter" : "Create workspace")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-blue-600 hover:text-blue-700 font-medium"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? "New here? Create workspace" : "Already have a workspace? Enter"}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>Powered by resonance, not hierarchy</p>
        </div>
      </div>
    </div>
  );
}