import { useNavigate } from "react-router-dom";
import { modules } from "@/data/modules";
import { useAuth } from "@/contexts/AuthContext";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.name}
        </h1>
        <p className="text-muted-foreground mt-1">Welcome to EZY OP Dashboard</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {modules.map((mod, i) => (
          <button
            key={mod.id}
            onClick={() => navigate(mod.route)}
            className="group p-5 rounded-xl bg-card border border-border module-card-shadow hover:module-card-shadow-hover hover:border-primary/20 transition-all duration-200 text-left animate-fade-in"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
          >
            <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <mod.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{mod.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{mod.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
