import { useNavigate } from "react-router-dom";
import { modules } from "@/data/modules";
import { useAuth } from "@/contexts/AuthContext";

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isHospitalAdmin, isSuperAdmin, allowedModules } = useAuth();

  const visibleModules = modules.filter((mod) => {
    if (mod.id === "users-roles") return isHospitalAdmin || isSuperAdmin;
    if (isSuperAdmin || isHospitalAdmin) return true;
    return allowedModules.includes(mod.id);
  });

  return (
    <div className="h-full flex flex-col p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
      <div className="mb-4 lg:mb-6 flex-shrink-0">
        <h1 className="text-xl lg:text-2xl font-display font-bold text-foreground">
          Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.user_metadata?.full_name || user?.email}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome to EZY OP Dashboard</p>
      </div>

      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4 auto-rows-fr min-h-0">
        {visibleModules.map((mod, i) => (
          <button
            key={mod.id}
            onClick={() => navigate(mod.route)}
            className="group flex flex-col p-4 rounded-xl bg-card border border-border module-card-shadow hover:module-card-shadow-hover hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 text-left animate-fade-in"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
          >
            <div className={`w-10 h-10 rounded-lg ${mod.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <mod.icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{mod.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
