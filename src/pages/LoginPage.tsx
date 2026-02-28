import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn } from "lucide-react";
import ezyopLogo from "@/assets/ezyop-logo.png";

const LoginPage = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login(username, password)) {
      setError("Invalid username or password");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 login-gradient items-center justify-center p-12">
        <div className="text-center animate-fade-in">
          <img src={ezyopLogo} alt="EZY OP Logo" className="w-64 mx-auto mb-8 drop-shadow-lg" />
          <p className="text-primary-foreground/80 text-lg font-light max-w-sm mx-auto">
            Complete Hospital & Clinic Management System
          </p>
        </div>
      </div>

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <img src={ezyopLogo} alt="EZY OP Logo" className="w-32 mx-auto" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-display font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-1 text-sm">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="h-11"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive animate-fade-in">{error}</p>
            )}

            <Button type="submit" className="w-full h-11 font-medium" size="lg">
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-secondary border border-border">
            <p className="text-xs font-medium text-secondary-foreground mb-2">Sample Credentials</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">Admin:</span> admin / admin123</p>
              <p><span className="font-medium">Doctor:</span> doctor / doctor123</p>
              <p><span className="font-medium">Nurse:</span> nurse / nurse123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
